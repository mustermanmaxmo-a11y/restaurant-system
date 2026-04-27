import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { resolveAiKey } from '@/lib/ai-key'
import type { ShiftDay } from '@/types/database'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { restaurantId } = body

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = await resolveAiKey(restaurantId)
  if (!apiKey) {
    return NextResponse.json(
      { error: 'KI nicht verfügbar. Bitte Pro-Plan buchen und API Key eintragen.' },
      { status: 403 }
    )
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
  const todayStr = new Date().toISOString().split('T')[0]
  const in7DaysStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [{ data: orders, error: ordersErr }, { data: reservations, error: resErr }] = await Promise.all([
    admin
      .from('orders')
      .select('created_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', fourWeeksAgo)
      .neq('status', 'cancelled'),
    admin
      .from('reservations')
      .select('date, guests')
      .eq('restaurant_id', restaurantId)
      .gte('date', todayStr)
      .lte('date', in7DaysStr)
      .neq('status', 'cancelled'),
  ])

  if (ordersErr || resErr) {
    return NextResponse.json({ error: 'Datenabruf fehlgeschlagen' }, { status: 500 })
  }

  const DAYS_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

  const heatmap: Record<string, number> = {}
  ;(orders ?? []).forEach(o => {
    const d = new Date(o.created_at)
    const key = `${d.getDay()}-${d.getHours()}`
    heatmap[key] = (heatmap[key] ?? 0) + 1
  })

  const heatmapText = DAYS_DE.map((dayName, idx) => {
    const hours = Array.from({ length: 24 }, (_, h) => ({ h, count: heatmap[`${idx}-${h}`] ?? 0 }))
      .filter(x => x.count > 0)
      .map(x => `${x.h}:00 Uhr (${x.count}x)`)
      .join(', ')
    return `${dayName}: ${hours || 'keine Bestellungen'}`
  }).join('\n')

  const resText = (reservations ?? []).length > 0
    ? (reservations ?? []).map(r =>
        `${r.date} (${DAYS_DE[new Date(r.date + 'T12:00:00').getDay()]}): ${r.guests} Gäste`
      ).join('\n')
    : 'Keine Reservierungen in den nächsten 7 Tagen.'

  const nextDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000)
    return { date: d.toISOString().split('T')[0], day: DAYS_DE[d.getDay()] }
  })
  const nextDaysText = nextDays.map(d => `${d.day} (${d.date})`).join(', ')

  const anthropic = new Anthropic({ apiKey })

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: 'Du bist ein erfahrener Restaurant-Personalplaner. Antworte ausschließlich mit validem JSON.',
      messages: [{
        role: 'user',
        content: `Erstelle einen Schichtplan für die nächsten 7 Tage basierend auf historischer Auslastung und Reservierungen.

Historische Bestellungen pro Wochentag und Stunde (letzte 4 Wochen):
${heatmapText}

Kommende Reservierungen:
${resText}

Plane für diese Tage: ${nextDaysText}

Antworte als JSON-Array mit exakt 7 Einträgen:
[
  {
    "day": "Montag",
    "date": "YYYY-MM-DD",
    "shifts": [
      {
        "start": "11:00",
        "end": "15:00",
        "kitchen": 1,
        "waiter": 2,
        "note": "Kurze Begründung auf Deutsch (max. 8 Wörter)"
      }
    ]
  }
]

Regeln:
- Typische Schichten: Mittag (11:00–15:00) und Abend (17:00–22:00)
- Wenn Wochentag historisch schwach: nur eine Abendschicht
- Wenn Wochentag stark (Freitag/Samstag): beide Schichten mit mehr Personal
- kitchen = Anzahl Köche (min. 1, max. 5)
- waiter = Anzahl Servicekräfte (min. 1, max. 6)
- note: kurze Begründung basierend auf den Daten`,
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return NextResponse.json({ days: [] })

    const days: ShiftDay[] = JSON.parse(match[0])
    return NextResponse.json({ days })
  } catch {
    return NextResponse.json({ error: 'Plan momentan nicht verfügbar' }, { status: 500 })
  }
}
