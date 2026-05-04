import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { sendPushToRestaurant, sendPushToPlatform } from '@/lib/push'

function isValidSecret(header: string | null): boolean {
  const expected = process.env.PUSH_WEBHOOK_SECRET
  if (!expected || !header) return false
  const provided = header.startsWith('Bearer ') ? header.slice(7) : ''
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  if (!isValidSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { type, table, record } = body

  if (!record || typeof type !== 'string' || typeof table !== 'string') {
    return NextResponse.json({ ok: true })
  }

  if (table === 'orders' && type === 'INSERT') {
    await sendPushToRestaurant(record.restaurant_id, ['dashboard', 'admin'], {
      title: '🆕 Neue Bestellung',
      body: `Tisch ${record.table_number || '–'} • ${record.order_type || 'Dine-in'}`,
      url: '/staff',
      tag: `order-${record.id}`,
    })
  }

  if (table === 'service_calls' && type === 'INSERT') {
    const isCheckout = record.type === 'checkout'
    await sendPushToRestaurant(record.restaurant_id, ['dashboard'], {
      title: isCheckout ? '💸 Rechnungsanfrage' : '🔔 Serviceruf',
      body: `Tisch ${record.table_number || record.table_id || '–'}`,
      url: '/staff',
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
