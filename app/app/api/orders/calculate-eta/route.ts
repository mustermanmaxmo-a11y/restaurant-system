import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_PREP_MINUTES = 15

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { restaurantId, orderItems, orderType } = body as {
    restaurantId: string
    orderItems: { item_id: string; qty: number }[]
    orderType: 'dine_in' | 'pickup' | 'delivery'
  }

  if (!restaurantId || !orderItems?.length || !orderType) {
    return NextResponse.json({ error: 'restaurantId, orderItems, orderType required' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: presence } = await admin
    .from('staff_presence')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('role', 'kitchen')
    .is('checked_out_at', null)

  const activeKitchenStaff = Math.max(presence?.length ?? 0, 1)

  const itemIds = orderItems.map(i => i.item_id)
  const { data: menuItems } = await admin
    .from('menu_items')
    .select('id, prep_time')
    .in('id', itemIds)

  const prepTimeMap: Record<string, number> = {}
  ;(menuItems ?? []).forEach(m => {
    prepTimeMap[m.id] = m.prep_time ?? DEFAULT_PREP_MINUTES
  })

  const orderPrepMinutes = orderItems.reduce((sum, item) => {
    return sum + (prepTimeMap[item.item_id] ?? DEFAULT_PREP_MINUTES) * item.qty
  }, 0)

  const { data: openOrders } = await admin
    .from('orders')
    .select('items, status')
    .eq('restaurant_id', restaurantId)
    .in('status', ['new', 'cooking'])

  let queueMinutes = 0
  ;(openOrders ?? []).forEach(order => {
    const items = Array.isArray(order.items) ? (order.items as { item_id?: string; qty: number }[]) : []
    items.forEach(item => {
      const prepTime = item.item_id ? (prepTimeMap[item.item_id] ?? DEFAULT_PREP_MINUTES) : DEFAULT_PREP_MINUTES
      queueMinutes += prepTime * item.qty
    })
  })

  const kitchenEta = Math.ceil((queueMinutes + orderPrepMinutes) / activeKitchenStaff)

  if (orderType !== 'delivery') {
    return NextResponse.json({ etaMinutes: kitchenEta })
  }

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('delivery_buffer_minutes')
    .eq('id', restaurantId)
    .single()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: deliveries } = await admin
    .from('orders')
    .select('created_at, status')
    .eq('restaurant_id', restaurantId)
    .eq('order_type', 'delivery')
    .eq('status', 'served')
    .gte('created_at', thirtyDaysAgo)

  const staticBuffer = restaurant?.delivery_buffer_minutes ?? 25

  let deliveryBuffer = staticBuffer
  if ((deliveries?.length ?? 0) >= 10) {
    deliveryBuffer = staticBuffer
  }

  return NextResponse.json({ etaMinutes: kitchenEta + deliveryBuffer })
}
