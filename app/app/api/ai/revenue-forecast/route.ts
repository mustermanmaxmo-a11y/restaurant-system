import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { resolveAiKey } from '@/lib/ai-key'

export interface ForecastDay {
  date: string       // YYYY-MM-DD
  dayName: string    // "Montag"
  predictedRevenue: number
  confidence: 'low' | 'medium' | 'high'
  note: string
}

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
  const [{ data: orders, error: ordersErr }, { data: reservations, error: resErr }] = await Promise.all([
    admin
      .from('orders')
      .select('total, created_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', fourWeeksAgo)
      .neq('status', 'cancelled'),
    admin
      .from('reservations')
      .select('date, guests')
      .eq('restaurant_id', restaurantId)
      .neq('status', 'cancelled')
      .gte('date', new Date().toISOString().split('T')[0]),
  ])

  if (ordersErr || resErr) {
    return NextResponse.json({ error: 'Datenabruf fehlgeschlagen' }, { status: 500 })
  }

  const DAYS_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
  const byWeekday: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  ;(orders ?? []).forEach(o => {
    const d = new Date(o.created_at).getDay()
    byWeekday[d].push(o.total ?? 0)
  })
  const avgByWeekday = Object.fromEntries(
    Object.entries(byWeekday).map(([day, revenues]) => [
      day,
      revenues.length > 0 ? revenues.reduce((a, b) => a + b, 0) / revenues.length : null,
    ])
  )

  const resByDate: Record<string, number> = {}
  ;(reservations ?? []).forEach(r => {
    resByDate[r.date] = (resByDate[r.date] ?? 0) + r.guests
  })

  const next7: { date: string; dayName: string; dayIndex: number; avgRevenue: number | null; reservedGuests: number }[] = []
  for (let i = 1; i <= 7; i++) {
    const d = new Date(Date.now() + i * 24 * 60 * 60 * 1000)
    const dateStr = d.toISOString().split('T')[0]
    next7.push({
      date: dateStr,
      dayName: DAYS_DE[d.getDay()],
      dayIndex: d.getDay(),
      avgRevenue: avgByWeekday[d.getDay()] as number | null,
      reservedGuests: resByDate[dateStr] ?? 0,
    })
  }

  const dataHint = next7.map(d =>
    `${d.dayName} (${d.date}): Historisch Ø ${d.avgRevenue != null ? '€' + d.avgRevenue.toFixed(0) : 'keine Daten'} | Reservierungen: ${d.reservedGuests} Gäste`
  ).join('\n')

  const anthropic = new Anthropic({ apiKey })

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: 'Du bist ein Restaurant-Umsatzanalyst. Antworte ausschließlich mit validem JSON.',
      messages: [{
        role: 'user',
        content: `Erstelle eine Umsatzprognose für die nächsten 7 Tage basierend auf historischen Daten und Reservierungen.

${dataHint}

Antworte als JSON-Array mit exakt 7 Einträgen:
[
  {
    "date": "YYYY-MM-DD",
    "dayName": "Wochentag",
    "predictedRevenue": 0,
    "confidence": "low|medium|high",
    "note": "Kurze Begründung auf Deutsch (max. 10 Wörter)"
  }
]

Regeln:
- confidence "high" wenn historische Daten vorhanden UND Reservierungen bekannt
- confidence "medium" wenn nur historische Daten vorhanden
- confidence "low" wenn keine historischen Daten
- predictedRevenue: realistischer Wert basierend auf Ø-Umsatz und Reservierungsvolumen
- note: präzise, umsetzbar`,
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return NextResponse.json({ forecast: [] })

    const forecast: ForecastDay[] = JSON.parse(match[0])
    return NextResponse.json({ forecast })
  } catch {
    return NextResponse.json({ error: 'Prognose momentan nicht verfügbar' }, { status: 500 })
  }
}
