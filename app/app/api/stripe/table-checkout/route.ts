import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const BodySchema = z.object({
  order_id:    z.string().uuid(),
  guest_token: z.string().uuid(),
  token:       z.string().min(1).max(200), // QR table token — used for return URL
})

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers)
  if (!rateLimit(`table-checkout:${ip}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte warte kurz.' }, { status: 429 })
  }

  const parsed = BodySchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Fehlende oder ungültige Parameter' }, { status: 400 })
  }
  const { order_id, guest_token, token } = parsed.data

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, total, restaurant_id, status, guest_token')
    .eq('id', order_id)
    .eq('guest_token', guest_token)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 })
  }

  if (order.status !== 'pending_payment') {
    return NextResponse.json({ error: 'Bestellung bereits bezahlt oder storniert' }, { status: 400 })
  }

  const { data: restaurant } = await supabaseAdmin
    .from('restaurants')
    .select('name')
    .eq('id', order.restaurant_id)
    .single()

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card', 'paypal'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(order.total * 100),
          product_data: { name: `Bestellung bei ${restaurant?.name ?? 'Restaurant'}` },
        },
        quantity: 1,
      },
    ],
    metadata: { order_id, token },
    success_url: `${appUrl}/order/${token}?payment=success&order_id=${order_id}`,
    cancel_url:  `${appUrl}/order/${token}?cancelled=true`,
  })

  return NextResponse.json({ url: session.url })
}
