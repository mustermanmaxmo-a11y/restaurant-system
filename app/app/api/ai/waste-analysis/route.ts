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

  if (!await rateLimit(`waste-analysis:${restaurantId}`, 10, 3_600_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen.' }, { status: 429 })
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name, plan')
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .single()

  if (!restaurant) return NextResponse.json({ error: 'Nicht gefunden.' }, { status: 404 })

  const aiKey = await resolveAiKey(restaurantId)
  if (!aiKey) {
    return NextResponse.json({ error: 'KI nicht verfügbar.' }, { status: 402 })
  }

  // Load waste logs with ingredient info (last 90 days)
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
  const { data: logs } = await supabase
    .from('waste_log')
    .select('quantity, reason, note, logged_at, ingredient_id, ingredients(name, unit, purchase_price)')
    .eq('restaurant_id', restaurantId)
    .gte('logged_at', since)
    .order('logged_at', { ascending: false })
    .limit(200)

  if (!logs || logs.length === 0) {
    return NextResponse.json({ insights: [], summary: 'Noch keine Verlustdaten vorhanden. Trage Verluste im Inventar-Bereich ein um eine KI-Analyse zu erhalten.' })
  }

  // Aggregate data
  type IngAgg = { name: string; unit: string; totalQty: number; totalCost: number; count: number; reasons: string[]; byDay: Record<number, number> }
  const byIngredient: Record<string, IngAgg> = {}
  for (const log of logs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ingRaw = log.ingredients as any
    const ing = Array.isArray(ingRaw) ? ingRaw[0] : ingRaw as { name: string; unit: string; purchase_price: number | null } | null
    if (!ing) continue
    if (!byIngredient[log.ingredient_id]) {
      byIngredient[log.ingredient_id] = { name: ing.name, unit: ing.unit, totalQty: 0, totalCost: 0, count: 0, reasons: [], byDay: {} }
    }
    const agg = byIngredient[log.ingredient_id]
    agg.totalQty += log.quantity
    agg.totalCost += log.quantity * (ing.purchase_price ?? 0)
    agg.count++
    agg.reasons.push(log.reason)
    const dow = new Date(log.logged_at).getDay()
    agg.byDay[dow] = (agg.byDay[dow] ?? 0) + log.quantity
  }

  const totalCost = Object.values(byIngredient).reduce((s, v) => s + v.totalCost, 0)
  const summary = Object.values(byIngredient)
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 10)
    .map(v => `- ${v.name}: ${v.totalQty.toFixed(2)} ${v.unit} (${v.count}× eingetragen, ca. ${v.totalCost.toFixed(2)} €). Häufigster Grund: ${v.reasons.sort((a,b) => v.reasons.filter(r => r===b).length - v.reasons.filter(r => r===a).length)[0] ?? 'unbekannt'}`)
    .join('\n')

  const anthropic = new Anthropic({ apiKey: aiKey })

  const prompt = `Du bist ein Restaurant-Beratungsexperte für Lebensmittelverschwendung.

Restaurant: "${restaurant.name}"
Zeitraum: letzte 90 Tage
Gesamtverluste: ca. ${totalCost.toFixed(2)} €

Top-Verlustpositionen:
${summary}

Analysiere diese Daten und liefere GENAU dieses JSON (keine Backticks, kein Markdown):
{
  "total_waste_cost": ${totalCost.toFixed(2)},
  "potential_savings": <geschätzte Ersparnis wenn Empfehlungen umgesetzt in €, Zahl>,
  "insights": [
    {
      "title": "<kurzer Titel>",
      "description": "<1-2 Sätze Analyse>",
      "action": "<konkrete Handlungsempfehlung>",
      "savings": <geschätzte Ersparnis für diesen Punkt in €, Zahl>,
      "ingredient": "<Zutatenname>"
    }
  ]
}

Maximal 4 Insights. Fokus auf größte Einsparpotenziale. Nur Fakten aus den Daten, keine Annahmen.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
  try {
    const parsed = JSON.parse(text)
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ insights: [], summary: text })
  }
}
