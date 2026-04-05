import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { resolveAiKey } from '@/lib/ai-key'

// Security: No customer PII. Only reservation counts, aggregate order history, menu item names/quantities.

export async function POST(request: NextRequest) {
  // Auth check: validate session cookie via Supabase anon client
  const supabaseAnon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  let userId: string | null = null
  if (token) {
    const { data: { user } } = await supabaseAnon.auth.getUser(token)
    userId = user?.id ?? null
  }

  if (!userId) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }

  const body = await request.json()
  const { restaurantId, targetDate, guestCountOverride } = body as {
    restaurantId: string
    targetDate: string
    guestCountOverride?: number
  }

  if (!restaurantId || !targetDate) {
    return NextResponse.json({ error: 'restaurantId und targetDate erforderlich' }, { status: 400 })
  }

  if (guestCountOverride != null && (!Number.isInteger(guestCountOverride) || guestCountOverride < 1 || guestCountOverride > 10000)) {
    return NextResponse.json({ error: 'Gästeanzahl muss eine ganze Zahl zwischen 1 und 10000 sein' }, { status: 400 })
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || isNaN(new Date(targetDate).getTime())) {
    return NextResponse.json({ error: 'Ungültiges Datum' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: restaurant } = await supabase
    .from('restaurants').select('id, name').eq('id', restaurantId).single()
  if (!restaurant) return NextResponse.json({ error: 'Restaurant nicht gefunden' }, { status: 404 })

  const apiKey = await resolveAiKey(restaurantId)
  if (!apiKey) return NextResponse.json({ error: 'KI nicht verfügbar. Bitte Pro-Plan buchen.' }, { status: 503 })

  const target = new Date(targetDate)
  const targetWeekday = target.getDay()

  const historicalDates: string[] = []
  for (let i = 1; i <= 4; i++) {
    const d = new Date(target)
    d.setDate(d.getDate() - i * 7)
    historicalDates.push(d.toISOString().split('T')[0])
  }

  const [
    { data: reservations },
    { data: menuItems },
    { data: menuItemIngredients },
    { data: ingredients },
    { data: specials },
  ] = await Promise.all([
    supabase.from('reservations').select('guests').eq('restaurant_id', restaurantId).eq('date', targetDate).neq('status', 'cancelled'),
    supabase.from('menu_items').select('id, name, price').eq('restaurant_id', restaurantId).eq('available', true),
    supabase.from('menu_item_ingredients').select('menu_item_id, ingredient_id, quantity_per_serving'),
    supabase.from('ingredients').select('id, name, unit').eq('restaurant_id', restaurantId),
    supabase.from('daily_specials').select('menu_item_id, label').eq('restaurant_id', restaurantId).eq('active', true),
  ])

  const historicalOrdersResults = await Promise.all(
    historicalDates.map(date =>
      supabase.from('orders').select('items').eq('restaurant_id', restaurantId)
        .gte('created_at', `${date}T00:00:00.000Z`)
        .lte('created_at', `${date}T23:59:59.999Z`)
        .neq('status', 'cancelled')
    )
  )

  const historicalCounts = historicalOrdersResults.map(r => r.data?.length || 0).filter(n => n > 0)
  const avgHistoricalOrders = historicalCounts.length
    ? Math.round(historicalCounts.reduce((a, b) => a + b, 0) / historicalCounts.length)
    : 0

  const itemFrequency: Record<string, number> = {}
  const totalHistoricalOrders = historicalCounts.reduce((a, b) => a + b, 0)
  historicalOrdersResults.forEach(r => {
    ;(r.data || []).forEach(order => {
      ;(order.items as { name: string; qty: number }[] || []).forEach(item => {
        itemFrequency[item.name] = (itemFrequency[item.name] || 0) + item.qty
      })
    })
  })

  const reservedGuests = (reservations || []).reduce((sum, r) => sum + (r.guests || 0), 0)
  const estimatedGuests = guestCountOverride ?? (reservedGuests + avgHistoricalOrders)
  const confidence = historicalCounts.length >= 3 ? 'high' : historicalCounts.length >= 1 ? 'medium' : 'low'

  const ingMap = Object.fromEntries((ingredients || []).map(i => [i.id, i]))

  const menuText = (menuItems || []).map(item => {
    const ings = (menuItemIngredients || []).filter(mi => mi.menu_item_id === item.id)
    if (!ings.length) return `- ${item.name}: keine Zutatenverknüpfung`
    const ingStr = ings.map(mi => {
      const ing = ingMap[mi.ingredient_id]
      return ing ? `${ing.name}: ${mi.quantity_per_serving}${ing.unit}` : ''
    }).filter(Boolean).join(', ')
    const histFreq = itemFrequency[item.name]
    const freqStr = histFreq && totalHistoricalOrders
      ? ` [historisch: ${(histFreq / (totalHistoricalOrders / historicalDates.length)).toFixed(1)}x pro Schicht]`
      : ''
    return `- ${item.name}${freqStr}: ${ingStr}`
  }).join('\n')

  const specialsText = (specials || [])
    .map(s => (menuItems || []).find(m => m.id === s.menu_item_id))
    .filter(Boolean)
    .map(m => m!.name)
    .join(', ')

  const days = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag']
  const historicalStr = historicalCounts.length
    ? `Letzte ${historicalCounts.length} ${days[targetWeekday]}e: ${historicalCounts.join(', ')} Bestellungen (Ø ${avgHistoricalOrders})`
    : 'Keine historischen Daten'

  const prompt = `Restaurant: "${restaurant.name}" | Zieldatum: ${days[targetWeekday]}, ${target.toLocaleDateString('de-DE')}

RESERVIERUNGEN: ${reservedGuests} Personen reserviert
HISTORISCHE DATEN: ${historicalStr}
ERWARTETE GÄSTE: ${estimatedGuests}${guestCountOverride ? ' (manuell korrigiert)' : ' (KI-Schätzung)'}

MENÜ MIT ZUTATEN PRO PORTION:
${menuText || '(Keine Rezeptverknüpfungen vorhanden)'}

AKTIVE TAGESANGEBOTE: ${specialsText || 'keine'}

Erstelle die Vorbereitungsliste als JSON (kein anderer Text):
{
  "estimated_guests": ${estimatedGuests},
  "confidence": "${confidence}",
  "reasoning": "kurze Begründung der Schätzung",
  "prep_items": [
    {"ingredient": "Zutatname", "unit": "Einheit", "quantity": 0.0, "note": "optionale Notiz"}
  ],
  "specials_note": "Empfehlung zu Tagesangeboten oder leer"
}

Regeln:
- quantity: Menge für geschätzte ${estimatedGuests} Gäste + 10% Puffer
- Berechne basierend auf historischer Bestellhäufigkeit der Gerichte
- Nur Zutaten mit Rezeptverknüpfungen in prep_items
- Alles auf Deutsch`

  const anthropic = new Anthropic({ apiKey })

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: 'Du bist ein Küchen-Planungsassistent. Antworte ausschließlich mit validem JSON.',
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Analyse momentan nicht verfügbar' }, { status: 500 })

    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch {
    return NextResponse.json({ error: 'Analyse momentan nicht verfügbar' }, { status: 500 })
  }
}
