import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers)
  if (!await rateLimit(`guest-checkout:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen.' }, { status: 429 })
  }

  const { orderId } = await request.json()
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: order } = await adminClient
    .from('orders')
    .select('id, total, restaurant_id, payment_status')
    .eq('id', orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Order nicht gefunden' }, { status: 404 })
  if (order.payment_status === 'paid') return NextResponse.json({ error: 'Bereits bezahlt' }, { status: 400 })

  const { data: resto } = await adminClient
    .from('restaurants')
    .select('name, online_payments_enabled, stripe_connect_account_id')
    .eq('id', order.restaurant_id)
    .single()

  if (!resto?.online_payments_enabled || !resto?.stripe_connect_account_id) {
    return NextResponse.json({ error: 'Online-Zahlung nicht verfügbar' }, { status: 400 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: Math.round(order.total * 100),
        product_data: {
          name: `Bestellung ${order.id.slice(0, 8)}`,
          description: resto.name,
        },
      },
    }],
    payment_intent_data: {
      transfer_data: { destination: resto.stripe_connect_account_id },
      metadata: { order_id: order.id, restaurant_id: order.restaurant_id },
    },
    metadata: { order_id: order.id },
    success_url: `${appUrl}/bestellen?paid=1`,
    cancel_url: `${appUrl}/bestellen`,
  })

  return NextResponse.json({ url: session.url })
}
