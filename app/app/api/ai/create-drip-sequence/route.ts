import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { resolveAiKey } from '@/lib/ai-key'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabaseSSR = await createSupabaseServerSSR()
  const { data: { user } } = await supabaseSSR.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { description } = await request.json()
  if (!description?.trim()) return NextResponse.json({ error: 'description required' }, { status: 400 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: restaurant } = await supabase.from('restaurants').select('id, name').eq('owner_id', user.id).maybeSingle()
  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 403 })

  // Rate-Limit: begrenzt teure KI-Generierung pro Restaurant (Kostenschutz).
  if (!(await rateLimit(`create-drip-sequence:${restaurant.id}`, 20, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte warte eine Stunde.' }, { status: 429 })
  }

  const apiKey = await resolveAiKey(restaurant.id)
  if (!apiKey) return NextResponse.json({ error: 'KI-Feature requires Pro plan.' }, { status: 402 })

  const anthropic = new Anthropic({ apiKey })

  const systemPrompt = `Du bist ein Email-Marketing-Experte für Restaurants. Erstelle eine Win-Back Drip-Sequenz.

Antworte NUR mit einem validen JSON-Objekt ohne Markdown-Blöcke:
{
  "name": "Name der Sequenz",
  "trigger_days": Zahl (wann der Drip startet, Standard: 14),
  "steps": [
    {
      "position": 1,
      "delay_days": 0,
      "subject": "Email-Betreff (max 60 Zeichen)",
      "headline": "Headline (max 50 Zeichen)",
      "body_text": "Text (max 150 Zeichen)",
      "discount_type": "percent" | "fixed" | null,
      "discount_value": Zahl | null,
      "expires_days": 7
    }
  ]
}

Regeln:
- 2-4 Steps sinnvoll, erster Step delay_days=0 (startet sofort nach trigger_days)
- Spätere Steps haben delay_days=7 (eine Woche Pause)
- Erster Step: freundliche Erinnerung, kein Rabatt nötig
- Zweiter Step: kleiner Rabatt (5-10%)
- Dritter Step (falls vorhanden): größerer Rabatt (10-15%) als letzter Versuch
- Texte auf Deutsch, warmherzig und einladend`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: description.trim() }],
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const sequence = JSON.parse(cleaned)

    return NextResponse.json({ sequence })
  } catch {
    return NextResponse.json({ error: 'KI-Generierung fehlgeschlagen.' }, { status: 500 })
  }
}
