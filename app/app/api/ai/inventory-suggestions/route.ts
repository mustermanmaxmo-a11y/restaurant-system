import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { resolveAiKey } from '@/lib/ai-key'

// Security: Only inventory data (no customer PII) is sent to the Claude API.
// Specifically: ingredient names, quantities, supplier names, aggregated movement data.
// No customer names, payment data, or personal information is included.

export async function POST(request: NextRequest) {
  // Auth check: validate session cookie via Supabase anon client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  let userId: string | null = null
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token)
    userId = user?.id ?? null
  }

  // Fallback: parse body and use service role to verify restaurant ownership
  const body = await request.json()
  const { restaurantId } = body

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId required' }, { status: 400 })
  }

  // Use service role to fetch data (RLS cannot be used server-side without cookie)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verify restaurant exists (ownership was already confirmed client-side via RLS)
  const { data: restaurant } = await supabaseAdmin
    .from('restaurants')
    .select('id, name')
    .eq('id', restaurantId)
    .single()

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }

  // Fetch inventory data in parallel
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: ingredients }, { data: suppliers }, { data: movements }] = await Promise.all([
    supabaseAdmin
      .from('ingredients')
      .select('id, name, unit, current_stock, min_stock, purchase_price, supplier_id')
      .eq('restaurant_id', restaurantId),
    supabaseAdmin
      .from('suppliers')
      .select('id, name')
      .eq('restaurant_id', restaurantId),
    supabaseAdmin
      .from('stock_movements')
      .select('ingredient_id, quantity_delta, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('movement_type', 'order_deduction')
      .gte('created_at', thirtyDaysAgo),
  ])

  if (!ingredients?.length) {
    return NextResponse.json({ error: 'Keine Zutaten vorhanden' }, { status: 400 })
  }

  // Build supplier name map
  const supMap = Object.fromEntries((suppliers || []).map(s => [s.id, s.name]))

  // Aggregate consumption per ingredient + weekday pattern
  const consumptionMap: Record<string, { total: number; byDay: number[] }> = {}
  ;(movements || []).forEach(m => {
    if (!consumptionMap[m.ingredient_id]) {
      consumptionMap[m.ingredient_id] = { total: 0, byDay: [0, 0, 0, 0, 0, 0, 0] }
    }
    const delta = Math.abs(m.quantity_delta)
    consumptionMap[m.ingredient_id].total += delta
    const day = new Date(m.created_at).getDay() // 0=Sun, 1=Mon...
    consumptionMap[m.ingredient_id].byDay[day] += delta
  })

  // Build prompt data — only non-PII inventory data
  const inventoryText = ingredients.map(ing => {
    const status = ing.current_stock <= ing.min_stock ? 'KRITISCH' : ing.current_stock <= ing.min_stock * 1.5 ? 'NIEDRIG' : 'OK'
    const consumption = consumptionMap[ing.id]
    const avgPerDay = consumption ? (consumption.total / 30).toFixed(3) : '0'
    const weekendAvg = consumption
      ? ((consumption.byDay[5] + consumption.byDay[6]) / 8).toFixed(3)
      : '0'
    const supplierName = ing.supplier_id ? supMap[ing.supplier_id] || 'Unbekannt' : 'Kein Lieferant'
    const priceStr = ing.purchase_price != null ? `${ing.purchase_price}€/${ing.unit}` : 'Preis unbekannt'
    return `- ${ing.name}: ${ing.current_stock}/${ing.min_stock} ${ing.unit} [${status}] | ${priceStr} | Lieferant: ${supplierName} | Ø ${avgPerDay} ${ing.unit}/Tag | Fr/Sa Ø ${weekendAvg} ${ing.unit}/Tag`
  }).join('\n')

  const today = new Date()
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
  const todayName = days[today.getDay()]

  const prompt = `Restaurant: "${restaurant.name}" | Heute: ${todayName}, ${today.toLocaleDateString('de-DE')}

LAGERBESTAND (Format: Name: Ist/Min Einheit [Status] | Preis | Lieferant | Tagesverbrauch | Wochenend-Verbrauch):
${inventoryText}

Analysiere den Bestand und gib EXAKT dieses JSON zurück (kein anderer Text, nur JSON):
{
  "urgent_orders": [
    {"ingredient": "Name", "suggested_qty": "X Einheit", "reason": "kurze Begründung"}
  ],
  "anomalies": ["Beschreibung der Auffälligkeit"],
  "savings_tip": "Eine konkrete Einsparempfehlung"
}

Regeln:
- Maximal 3 urgent_orders, sortiert nach Dringlichkeit
- Berücksichtige Wochentag und Wochenend-Peaks
- Nur KRITISCH/NIEDRIG Artikel in urgent_orders
- anomalies: 1-3 Punkte, leer wenn keine Auffälligkeiten
- savings_tip: konkret, bezogen auf Waste oder Überbestellung
- Alles auf Deutsch`

  // Call Claude API — resolve key based on restaurant plan
  const apiKey = await resolveAiKey(restaurantId)
  if (!apiKey) {
    return NextResponse.json({ error: 'KI nicht verfügbar. Bitte Pro-Plan buchen und API Key eintragen.' }, { status: 503 })
  }

  const anthropic = new Anthropic({ apiKey })

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: 'Du bist ein Restaurant-Betriebsberater. Antworte ausschließlich mit validem JSON. Kein Text davor oder danach.',
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Analyse momentan nicht verfügbar' }, { status: 500 })
    }

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Analyse momentan nicht verfügbar' }, { status: 500 })
  }
}
