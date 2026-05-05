import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { resolveAiKey } from '@/lib/ai-key'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { restaurantId } = body

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId required' }, { status: 400 })
  }

  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!await rateLimit(`prep-plan:${restaurantId}`, 10, 3_600_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen.' }, { status: 429 })
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .single()

  if (!restaurant) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const today = new Date().toISOString().split('T')[0]
  const todayDate = new Date()
  const weekday = todayDate.getDay()

  // Past 4 same-weekdays
  const pastDates = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(todayDate)
    d.setDate(d.getDate() - (i + 1) * 7)
    return d.toISOString().split('T')[0]
  })

  const [{ data: reservations }, { data: todaySpecials }, { data: historicOrders }] = await Promise.all([
    supabase
      .from('reservations')
      .select('id, party_size, reservation_time, date')
      .eq('restaurant_id', restaurantId)
      .eq('date', today)
      .neq('status', 'cancelled'),
    supabase
      .from('daily_specials')
      .select('name, description, price')
      .eq('restaurant_id', restaurantId)
      .eq('active', true),
    supabase
      .from('orders')
      .select('items, total, created_at')
      .eq('restaurant_id', restaurantId)
      .in('created_at', pastDates.map(d => [d + 'T00:00:00', d + 'T23:59:59']).flat())
      .gte('created_at', pastDates[pastDates.length - 1] + 'T00:00:00')
      .neq('status', 'cancelled'),
  ])

  // Aggregate historic item counts
  const itemCounts: Record<string, number> = {}
  for (const order of historicOrders ?? []) {
    const orderDate = order.created_at.split('T')[0]
    if (pastDates.includes(orderDate)) {
      const items = order.items as { name: string; qty: number }[]
      for (const item of items) {
        itemCounts[item.name] = (itemCounts[item.name] ?? 0) + item.qty
      }
    }
  }
  const avgDivisor = Math.max(pastDates.length, 1)
  const avgItems = Object.entries(itemCounts)
    .map(([name, total]) => ({ name, avgQty: Math.round(total / avgDivisor) }))
    .sort((a, b) => b.avgQty - a.avgQty)
    .slice(0, 15)

  const guestCount = (reservations ?? []).reduce((s, r) => s + (r.party_size ?? 1), 0)
  const DAYS_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

  const prompt = `Du bist ein erfahrener Küchenchef und planst die Mise en Place für heute, ${DAYS_DE[weekday]}, ${today}.

Restaurantname: ${restaurant.name}
Reservierungen heute: ${(reservations ?? []).length} Tische, insgesamt ${guestCount} Gäste
Tagesspecials heute: ${(todaySpecials ?? []).map(s => s.name).join(', ') || 'keine'}
Historische Durchschnittswerte (letzte 4 ${DAYS_DE[weekday]}e):
${avgItems.map(i => `- ${i.name}: Ø ${i.avgQty} Portionen`).join('\n') || '- Keine historischen Daten'}

Erstelle einen realistischen Vorbereitungsplan für Mittag und Abend. Antworte NUR mit diesem JSON (keine Markdown-Blöcke):
{
  "shifts": [
    {
      "name": "Mittagsschicht",
      "time": "10:00–14:00",
      "items": [
        {"name": "Itemname", "qty": 12, "confidence": "Sicher"},
        {"name": "Itemname", "qty": 8, "confidence": "Geschätzt"}
      ]
    },
    {
      "name": "Abendschicht",
      "time": "16:00–22:00",
      "items": [
        {"name": "Itemname", "qty": 20, "confidence": "Sicher"}
      ]
    }
  ],
  "insight": "Ein kurzer Hinweis auf besondere Faktoren (z.B. Freitag = höhere Nachfrage, Tagesspecial beachten)"
}
confidence ist "Sicher" wenn historische Daten vorhanden, sonst "Geschätzt".`

  const apiKey = await resolveAiKey(restaurantId)
  if (!apiKey) return NextResponse.json({ error: 'Kein AI-Key konfiguriert.' }, { status: 503 })

  const anthropic = new Anthropic({ apiKey })
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = (message.content[0] as { type: string; text: string }).text.trim()
  let planData
  try {
    planData = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'KI-Antwort konnte nicht verarbeitet werden.' }, { status: 500 })
  }

  await supabase.from('daily_prep_plans').upsert(
    { restaurant_id: restaurantId, plan_date: today, plan_data: planData, generated_at: new Date().toISOString() },
    { onConflict: 'restaurant_id,plan_date' }
  )

  return NextResponse.json({ ok: true, plan: planData })
}
