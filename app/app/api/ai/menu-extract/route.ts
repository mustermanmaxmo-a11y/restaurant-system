import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { resolveAiKey } from '@/lib/ai-key'
import { rateLimit } from '@/lib/rate-limit'

// Security: Nur der hochgeladene Dateiinhalt (PDF/Foto der Speisekarte) wird
// an Claude gesendet. Keine Kundendaten, keine PII.

const MAX_BYTES = 15 * 1024 * 1024 // 15 MB
const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type AllowedImage = typeof ALLOWED_IMAGE[number]

const DIETARY_KEYS = ['vegetarisch', 'vegan', 'glutenfrei', 'laktosefrei', 'scharf', 'neu']
const ALLERGEN_LIST = [
  'Gluten', 'Nüsse', 'Milch', 'Eier', 'Fisch', 'Meeresfrüchte',
  'Soja', 'Sellerie', 'Senf', 'Sesam', 'Lupinen', 'Weichtiere',
]

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const file = form.get('file')
  const restaurantId = form.get('restaurantId')
  const existingCategoriesRaw = form.get('existingCategories')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Keine Datei empfangen' }, { status: 400 })
  }
  if (typeof restaurantId !== 'string' || !restaurantId) {
    return NextResponse.json({ error: 'restaurantId erforderlich' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Leere Datei' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Datei zu groß (max. 15 MB)' }, { status: 400 })
  }

  const isPdf = file.type === 'application/pdf'
  const isImage = (ALLOWED_IMAGE as readonly string[]).includes(file.type)
  if (!isPdf && !isImage) {
    return NextResponse.json({ error: 'Nur PDF, JPG, PNG, GIF oder WebP erlaubt' }, { status: 400 })
  }

  // Verify ownership via service role (Restaurant muss dem eingeloggten User gehören)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: restaurant } = await supabaseAdmin
    .from('restaurants')
    .select('id, owner_id')
    .eq('id', restaurantId)
    .single()
  if (!restaurant || restaurant.owner_id !== user.id) {
    return NextResponse.json({ error: 'Restaurant nicht gefunden' }, { status: 404 })
  }

  if (!await rateLimit(`menu-extract:${restaurantId}`, 5, 3_600_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte in einer Stunde erneut versuchen.' }, { status: 429 })
  }

  const apiKey = await resolveAiKey(restaurantId)
  if (!apiKey) {
    return NextResponse.json({
      error: 'KI-Import ist nur im Pro- oder Enterprise-Plan verfügbar. Bitte Plan upgraden und Anthropic API-Key eintragen.',
    }, { status: 503 })
  }

  let existingCategories: string[] = []
  if (typeof existingCategoriesRaw === 'string' && existingCategoriesRaw) {
    try {
      const parsed = JSON.parse(existingCategoriesRaw)
      if (Array.isArray(parsed)) existingCategories = parsed.filter(c => typeof c === 'string')
    } catch {
      // ignore — wir machen ohne Kategorien-Hinweis weiter
    }
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')

  const prompt = `Du bekommst eine Speisekarte (als PDF oder Foto). Extrahiere ALLE Gerichte strukturiert.

Gib EXAKT dieses JSON zurück — kein Text davor oder danach, keine Markdown-Fences:
{
  "categories": ["Vorspeisen", "Hauptspeisen", ...],
  "items": [
    { "name": "...", "description": "...", "price": 9.50, "category": "...", "tags": [...], "allergens": [...] }
  ]
}

REGELN:
- price: Zahl in Euro, z.B. 9.50 (keine Währungszeichen, kein Komma als Dezimaltrennzeichen)
- description: kurze Beschreibung, oder null wenn keine da ist
- tags: NUR aus [${DIETARY_KEYS.map(k => `"${k}"`).join(',')}] — leite aus Symbolen (V, Ve, 🌱, *), Beschreibung ("ohne Gluten", "scharf") oder Markierungen ab. Leeres Array wenn nichts passt.
- allergens: NUR aus [${ALLERGEN_LIST.map(a => `"${a}"`).join(',')}] — wenn eine Allergen-Legende mit Ziffern (nach DE-Lebensmittelkennzeichnung) sichtbar ist, dementsprechend mappen. Leeres Array wenn unklar.
- category: ${existingCategories.length > 0 ? `Passe den Kategorienamen WENN SINNVOLL GENAU an einen dieser bestehenden an: ${existingCategories.map(c => `"${c}"`).join(', ')}. Wenn keine Übereinstimmung passt, gib den Namen aus der Karte zurück.` : 'Gib den Kategorienamen aus der Karte zurück.'}
- categories: Liste ALLER Kategorienamen in Reihenfolge wie sie in den items vorkommen, ohne Duplikate
- Keine Getränkegrößen als separate Items (z.B. "Cola 0.3L" + "Cola 0.5L" → nimm nur die Standardgröße oder die kleinere)
- Keine Überschriften, Hinweise, Öffnungszeiten, AGB-Texte oder Marketing-Sprüche als Items
- Wenn du keine Speisekarte erkennst, gib { "categories": [], "items": [] } zurück`

  const anthropic = new Anthropic({ apiKey })

  try {
    const contentBlock: Anthropic.DocumentBlockParam | Anthropic.ImageBlockParam = isPdf
      ? {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        }
      : {
          type: 'image',
          source: { type: 'base64', media_type: file.type as AllowedImage, data: base64 },
        }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: 'Du bist ein Restaurant-Daten-Extraktor. Du antwortest ausschließlich mit validem JSON. Kein Fließtext, keine Markdown-Fences, keine Erklärungen.',
      messages: [
        {
          role: 'user',
          content: [
            contentBlock,
            { type: 'text', text: prompt },
          ],
        },
      ],
    })

    const responseText = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Speisekarte konnte nicht gelesen werden' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0]) as unknown

    // Validate shape
    if (!parsed || typeof parsed !== 'object') {
      return NextResponse.json({ error: 'Ungültige Antwort vom KI-Modell' }, { status: 500 })
    }
    const obj = parsed as { categories?: unknown; items?: unknown }
    if (!Array.isArray(obj.items) || !Array.isArray(obj.categories)) {
      return NextResponse.json({ error: 'Ungültige Antwort vom KI-Modell' }, { status: 500 })
    }

    const items = obj.items
      .filter((i: unknown): i is Record<string, unknown> => typeof i === 'object' && i !== null)
      .map(i => ({
        name: String(i.name || '').trim(),
        description: i.description ? String(i.description).trim() : null,
        price: typeof i.price === 'number' ? i.price : parseFloat(String(i.price || '0').replace(',', '.')),
        category: String(i.category || '').trim(),
        tags: Array.isArray(i.tags) ? i.tags.filter((t): t is string => typeof t === 'string' && DIETARY_KEYS.includes(t)) : [],
        allergens: Array.isArray(i.allergens) ? i.allergens.filter((a): a is string => typeof a === 'string' && ALLERGEN_LIST.includes(a)) : [],
      }))
      .filter(i => i.name && i.category && i.price > 0)

    const categories = Array.from(new Set(items.map(i => i.category)))

    return NextResponse.json({ categories, items })
  } catch (err) {
    console.error('Menu extraction failed:', err)
    return NextResponse.json({ error: 'KI-Import momentan nicht verfügbar' }, { status: 500 })
  }
}
