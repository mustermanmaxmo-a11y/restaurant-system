import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { resolveAiKey } from '@/lib/ai-key'

// Security: No customer PII. Only ingredient names, prices, supplier names, dish names/prices.

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { restaurantId } = body

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId erforderlich' }, { status: 400 })
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

  const [
    { data: ingredients },
    { data: suppliers },
    { data: supplierPrices },
    { data: menuItems },
    { data: menuItemIngredients },
  ] = await Promise.all([
    supabase.from('ingredients').select('id, name, unit, purchase_price').eq('restaurant_id', restaurantId),
    supabase.from('suppliers').select('id, name').eq('restaurant_id', restaurantId),
    supabase.from('supplier_prices').select('supplier_id, ingredient_id, price_per_unit, updated_at').eq('restaurant_id', restaurantId),
    supabase.from('menu_items').select('id, name, price').eq('restaurant_id', restaurantId).eq('available', true),
    supabase.from('menu_item_ingredients').select('menu_item_id, ingredient_id, quantity_per_serving'),
  ])

  if (!ingredients?.length) {
    return NextResponse.json({ error: 'Keine Zutaten vorhanden' }, { status: 400 })
  }

  const supplierMap = Object.fromEntries((suppliers || []).map(s => [s.id, s.name]))
  const ingMap = Object.fromEntries((ingredients || []).map(i => [i.id, i]))

  const priceMatrix: Record<string, { supplierId: string; supplierName: string; price: number; updatedAt: string }[]> = {}
  ;(supplierPrices || []).forEach(sp => {
    if (!priceMatrix[sp.ingredient_id]) priceMatrix[sp.ingredient_id] = []
    priceMatrix[sp.ingredient_id].push({
      supplierId: sp.supplier_id,
      supplierName: supplierMap[sp.supplier_id] || 'Unbekannt',
      price: sp.price_per_unit,
      updatedAt: sp.updated_at,
    })
  })

  const dishMargins: { name: string; price: number; cost: number; margin: number }[] = []
  ;(menuItems || []).forEach(item => {
    const itemIngs = (menuItemIngredients || []).filter(mi => mi.menu_item_id === item.id)
    if (!itemIngs.length) return
    const cost = itemIngs.reduce((sum, mi) => {
      const ing = ingMap[mi.ingredient_id]
      if (!ing) return sum
      const price = ing.purchase_price ?? 0
      return sum + price * mi.quantity_per_serving
    }, 0)
    if (cost > 0) {
      const margin = ((item.price - cost) / item.price) * 100
      dishMargins.push({ name: item.name, price: item.price, cost: parseFloat(cost.toFixed(3)), margin: parseFloat(margin.toFixed(1)) })
    }
  })

  const ingredientsText = (ingredients || []).map(ing => {
    const prices = priceMatrix[ing.id] || []
    const pricesStr = prices.length
      ? prices.map(p => `${p.supplierName}: ${p.price}€/${ing.unit}`).join(', ')
      : `Aktueller Preis: ${ing.purchase_price != null ? `${ing.purchase_price}€/${ing.unit}` : 'unbekannt'}`
    return `- ${ing.name} (${ing.unit}): ${pricesStr}`
  }).join('\n')

  const marginsText = dishMargins
    .sort((a, b) => a.margin - b.margin)
    .map(d => `- ${d.name}: VK ${d.price}€, EK ~${d.cost}€, Marge ${d.margin}%`)
    .join('\n')

  const prompt = `Restaurant: "${restaurant.name}"

ZUTATEN MIT LIEFERANTENPREISEN:
${ingredientsText}

GERICHTE MIT KALKULIERTEN MARGEN:
${marginsText || '(Keine Rezeptverknüpfungen vorhanden — Margen nicht berechenbar)'}

Analysiere und antworte EXAKT als JSON (kein anderer Text):
{
  "supplier_recommendations": [
    {"ingredient": "Name", "best_supplier": "Lieferant", "saving": "X€/Einheit", "reason": "kurze Begründung"}
  ],
  "margin_alerts": [
    {"dish": "Gerichtname", "margin": "XX%", "issue": "kurze Beschreibung des Problems"}
  ],
  "price_trends": ["Beobachtung zu Preistrend"],
  "savings_potential": "Konkrete Gesamteinschätzung des Sparpotenzials"
}

Regeln:
- supplier_recommendations: Nur wenn mehrere Lieferanten für dieselbe Zutat vorhanden und Preisunterschied > 5%
- margin_alerts: Nur Gerichte mit Marge unter 40% oder offensichtlich problematisch
- price_trends: 1-2 Punkte, nur wenn auffällig
- savings_potential: ein konkreter Satz
- Alles auf Deutsch`

  const anthropic = new Anthropic({ apiKey })

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: 'Du bist ein Restaurant-Betriebsberater. Antworte ausschließlich mit validem JSON.',
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Analyse momentan nicht verfügbar' }, { status: 500 })

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json({ ...result, dishMargins })
  } catch {
    return NextResponse.json({ error: 'Analyse momentan nicht verfügbar' }, { status: 500 })
  }
}
