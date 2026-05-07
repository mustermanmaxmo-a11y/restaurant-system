import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveAiKey } from '@/lib/ai-key'
import { rateLimit } from '@/lib/rate-limit'
import { validateDesignConfig } from '@/lib/design-config-validate'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SYSTEM_PROMPT = `Du bist ein Design-Assistent für Restaurant-Websites. Du hilfst dabei, das visuelle Design (Farben, Schriften, Ecken) anzupassen.

Antworte IMMER auf Deutsch. Antworte kurz und konkret (1-2 Sätze).
Wenn der Nutzer eine Designänderung wünscht, gib am Ende deiner Antwort einen JSON-Block zurück:

{"delta": {"feld": "wert", ...}}

Verfügbare Felder und erlaubte Werte:
- primary_color: Hex-Farbe (#rrggbb) — Akzentfarbe, Hauptfarbe
- bg_color: Hex-Farbe (#rrggbb) — Hintergrundfarbe
- surface_color: Hex-Farbe (#rrggbb) — Karten/Flächen-Farbe
- header_color: Hex-Farbe (#rrggbb) — Header-Hintergrund
- button_color: Hex-Farbe (#rrggbb) — Button-Farbe
- card_color: Hex-Farbe (#rrggbb) — Karten-Hintergrund
- text_color: Hex-Farbe (#rrggbb) — Textfarbe
- font_pair: "syne-dmsans" | "playfair-lato" | "inter-inter" | "space-dmsans" | "merriweather-source" | "noto-noto"
- layout_variant: "cards" | "list" | "grid" | "large-cards"
- border_radius: "sharp" | "rounded" | "pill"
- hover_effect: "scale" | "glow" | "underline" | "color-shift" | "none"
- animation_style: "fade" | "slide" | "none"
- card_style: "elevated" | "flat" | "outlined" | "ghost"

Wenn mehrere Farben zusammenpassen müssen (z.B. "mach es dunkler"), ändere alle relevanten Farben gleichzeitig.
Wenn keine Designänderung gewünscht wird, lass das delta weg.

Beispiel:
Nutzer: "Mach die Akzentfarbe blau"
Antwort: Ich setze die Akzentfarbe auf ein klares Blau.
{"delta": {"primary_color": "#3B82F6", "button_color": "#3B82F6"}}

Antworte NUR auf designbezogene Anfragen. Bei anderen Fragen: kurz ablehnen.`

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  let body: {
    restaurant_id?: string
    messages?: { role: string; content: string }[]
    current_design_config?: Record<string, unknown>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { restaurant_id, messages, current_design_config } = body

  if (!restaurant_id || !UUID_RE.test(restaurant_id)) {
    return NextResponse.json({ error: 'restaurant_id erforderlich' }, { status: 400 })
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages erforderlich' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, owner_id')
    .eq('id', restaurant_id)
    .single()
  if (!restaurant || restaurant.owner_id !== user.id) {
    return NextResponse.json({ error: 'Restaurant nicht gefunden' }, { status: 404 })
  }

  if (!await rateLimit(`design-chat:${restaurant_id}`, 20, 3_600_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte in einer Stunde erneut versuchen.' }, { status: 429 })
  }

  const apiKey = await resolveAiKey(restaurant_id)
  if (!apiKey) {
    return NextResponse.json({ error: 'KI-Design-Assistent ist nur im Pro- oder Enterprise-Plan verfügbar.' }, { status: 403 })
  }

  const anthropic = new Anthropic({ apiKey })

  const contextPrefix = current_design_config
    ? `Aktuelles Design: ${JSON.stringify(current_design_config)}\n\n`
    : ''

  const claudeMessages = messages.map((m, i) => ({
    role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: i === 0 && m.role === 'user' ? contextPrefix + m.content : m.content,
  }))

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: claudeMessages,
    })

    const responseText = response.content[0]?.type === 'text' ? response.content[0].text : ''

    let delta: Record<string, unknown> | undefined
    const jsonMatch = responseText.match(/\{"delta"\s*:\s*(\{[\s\S]*?\})\s*\}/)
    if (jsonMatch) {
      try {
        const raw = JSON.parse(`{"delta":${jsonMatch[1]}}`) as { delta: Record<string, unknown> }
        const validated = validateDesignConfig(raw.delta)
        if (Object.keys(validated).length > 0) delta = validated as Record<string, unknown>
      } catch {
        // ignore parse error
      }
    }

    const message = responseText.replace(/\s*\{"delta"[\s\S]*?\}\s*$/, '').trim()

    return NextResponse.json({ message: message || 'Design wird angepasst.', delta })
  } catch (err) {
    console.error('Design chat failed:', err)
    return NextResponse.json({ error: 'KI-Assistent momentan nicht verfügbar' }, { status: 500 })
  }
}
