import { NextRequest, NextResponse } from 'next/server'
import { sendPushToRestaurant, sendPushToPlatform } from '@/lib/push'

export async function POST(req: NextRequest) {
  // Verify webhook secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.PUSH_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { type, table, record } = body  // Supabase webhook payload

  if (!record) return NextResponse.json({ ok: true })

  if (table === 'orders' && type === 'INSERT') {
    await sendPushToRestaurant(record.restaurant_id, ['dashboard', 'admin'], {
      title: '🆕 Neue Bestellung',
      body: `Tisch ${record.table_number || '–'} • ${record.order_type || 'Dine-in'}`,
      url: '/dashboard',
      tag: `order-${record.id}`,
    })
  }

  if (table === 'service_calls' && type === 'INSERT') {
    const isCheckout = record.type === 'checkout'
    await sendPushToRestaurant(record.restaurant_id, ['dashboard'], {
      title: isCheckout ? '💸 Rechnungsanfrage' : '🔔 Serviceruf',
      body: `Tisch ${record.table_number || record.table_id || '–'}`,
      url: '/dashboard',
      tag: `call-${record.id}`,
      requireInteraction: true,
    })
  }

  if (table === 'reservations' && type === 'INSERT') {
    await sendPushToRestaurant(record.restaurant_id, ['admin'], {
      title: '📅 Neue Reservierung',
      body: `${record.name || 'Gast'} • ${record.guests || 1} Personen`,
      url: '/admin/reservations',
      tag: `reservation-${record.id}`,
    })
  }

  if (table === 'design_requests' && type === 'INSERT') {
    await sendPushToPlatform({
      title: '🎨 Neuer Design-Request',
      body: record.restaurant_name || 'Ein Restaurant hat eine Design-Anfrage gestellt',
      url: '/platform/design-requests',
      tag: `design-req-${record.id}`,
    })
  }

  if (table === 'team_registration_requests' && type === 'INSERT') {
    await sendPushToPlatform({
      title: '👤 Neue Team-Anfrage',
      body: record.email || 'Jemand möchte dem Team beitreten',
      url: '/platform/team',
      tag: `team-req-${record.id}`,
    })
  }

  if (table === 'restaurants' && type === 'INSERT') {
    await sendPushToPlatform({
      title: '🍴 Neues Restaurant',
      body: record.name || 'Ein neues Restaurant hat sich registriert',
      url: '/platform/restaurants',
      tag: `restaurant-${record.id}`,
    })
  }

  return NextResponse.json({ ok: true })
}
