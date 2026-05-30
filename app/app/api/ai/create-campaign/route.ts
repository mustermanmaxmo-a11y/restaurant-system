import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { resolveAiKey } from '@/lib/ai-key'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabaseSSR = await createSupabaseServerSSR()
  const { data: { user } } = await supabaseSSR.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { description } = await request.json()
  if (!description?.trim()) return NextResponse.json({ error: 'description required' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 403 })

  const apiKey = await resolveAiKey(restaurant.id)
  if (!apiKey) return NextResponse.json({ error: 'KI-Feature requires Pro plan.' }, { status: 402 })

  const anthropic = new Anthropic({ apiKey })

  const systemPrompt = `Du bist ein Marketing-Experte für Restaurants. Erstelle eine Kampagnen-Konfiguration basierend auf der Beschreibung des Betreibers.

Antworte NUR mit einem validen JSON-Objekt, ohne Markdown-Code-Blöcke oder weitere Erklärungen:
{
  "trigger_type": "birthday" | "first_order_anniversary" | "custom_event",
  "send_date": "YYYY-MM-DD" (nur für custom_event, sonst null),
  "subject": "Email-Betreff (max 60 Zeichen)",
  "headline": "Große Headline in der Email (max 50 Zeichen)",
  "body_text": "Einladender Fließtext (max 150 Zeichen)",
  "discount_type": "percent" | "fixed" | null,
  "discount_value": Zahl oder null,
  "expires_days": Zahl (Standard: 7)
}

Regeln:
- trigger_type: birthday für Geburtstags-Kampagnen, first_order_anniversary für Jahrestags-Kampagnen, custom_event für einmalige Aktionen
- Wenn ein Datum genannt wird → custom_event + send_date setzen
- Wenn "Geburtstag" → birthday
- Wenn "Jahrestag" oder "Jubiläum" ohne Datum → first_order_anniversary, AUSSER es wird ein konkretes Restaurant-Datum genannt → dann custom_event
- Rabatt: Wenn % → percent, wenn € → fixed. Ohne Rabattnennung → null
- Texte auf Deutsch, freundlich und einladend
- Kein JSON außer dem Objekt selbst`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: description.trim() }],
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    // Strip potential markdown code blocks
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const campaign = JSON.parse(cleaned)

    return NextResponse.json({ campaign })
  } catch {
    return NextResponse.json({ error: 'KI-Generierung fehlgeschlagen. Bitte versuche es erneut.' }, { status: 500 })
  }
}
