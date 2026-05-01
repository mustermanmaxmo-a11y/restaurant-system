import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { resolveAiKey } from '@/lib/ai-key'
import { rateLimit } from '@/lib/rate-limit'

export interface ProfitabilityResult {
  itemId: string
  status: 'green' | 'yellow' | 'red'
  reason: string
  ordersPerWeek: number
  estimatedMarginPct: number | null
}

export interface ProfitabilityResponse {
  items: ProfitabilityResult[]
  recommendations: string[]
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

  if (!await rateLimit(`menu-profitability:${restaurantId}`, 10, 3_600_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte später erneut versuchen.' }, { status: 429 })
  }

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

  const [
    { data: menuItems, error: menuErr },
    { data: orders, error: ordersErr },
    { data: ingredients, error: ingErr },
    { data: mii, error: miiErr },
  ] = await Promise.all([
    admin.from('menu_items').select('id, name, price').eq('restaurant_id', restaurantId).eq('available', true),
    admin.from('orders').select('items').eq('restaurant_id', restaurantId).gte('created_at', fourWeeksAgo).neq('status', 'cancelled'),
    admin.from('ingredients').select('id, name, purchase_price, unit').eq('restaurant_id', restaurantId),
    admin.from('menu_item_ingredients').select('menu_item_id, ingredient_id, quantity_per_serving'),
  ])

  if (menuErr || ordersErr || ingErr || miiErr) {
    return NextResponse.json({ error: 'Datenabruf fehlgeschlagen' }, { status: 500 })
  }

  const orderCounts: Record<string, number> = {}
  ;(orders ?? []).forEach(order => {
    const items = Array.isArray(order.items) ? (order.items as { item_id?: string; name: string; qty: number }[]) : []
    items.forEach(item => {
      if (!item?.item_id) return
      orderCounts[item.item_id] = (orderCounts[item.item_id] ?? 0) + item.qty
    })
  })

  const ingMap = Object.fromEntries((ingredients ?? []).map(i => [i.id, i]))
  const itemCosts: Record<string, number> = {}
  ;(mii ?? []).forEach(link => {
    const ing = ingMap[link.ingredient_id]
    if (!ing?.purchase_price) return
    itemCosts[link.menu_item_id] = (itemCosts[link.menu_item_id] ?? 0) + (ing.purchase_price * link.quantity_per_serving)
  })

  const itemData = (menuItems ?? []).map(item => {
    const weeklyOrders = Math.round((orderCounts[item.id] ?? 0) / 4)
    const cost = itemCosts[item.id]
    const marginPct = cost != null ? Math.round(((item.price - cost) / item.price) * 100) : null
    return `ID:${item.id} | ${item.name} | Preis: €${item.price} | Kosten: ${cost != null ? '€' + cost.toFixed(2) : 'unbekannt'} | Marge: ${marginPct != null ? marginPct + '%' : 'unbekannt'} | Bestellungen/Woche: ${weeklyOrders}`
  }).join('\n')

  const anthropic = new Anthropic({ apiKey })

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: 'Du bist ein Restaurant-Controller. Antworte ausschließlich mit validem JSON.',
      messages: [{
        role: 'user',
        content: `Analysiere die Profitabilität dieser Menü-Gerichte und gib eine Ampel-Bewertung:

${itemData}

Bewertungsregeln:
- green: Gute Marge (>50%) UND häufig bestellt (>3x/Woche)
- yellow: Beliebt aber geringe Marge (<40%) ODER geringe Marge bei unbekannten Kosten
- red: Selten bestellt (<1x/Woche) UND geringe oder unbekannte Marge → Streichkandidat

Antworte als JSON:
{
  "items": [
    {
      "itemId": "uuid",
      "status": "green|yellow|red",
      "reason": "Kurze Begründung auf Deutsch (max. 8 Wörter)",
      "ordersPerWeek": 0,
      "estimatedMarginPct": null
    }
  ],
  "recommendations": ["...", "...", "..."]
}`,
      }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ items: [], recommendations: [] })

    const result: ProfitabilityResponse = JSON.parse(match[0])
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Analyse momentan nicht verfügbar' }, { status: 500 })
  }
}
