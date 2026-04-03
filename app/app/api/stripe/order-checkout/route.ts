import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const BodySchema = z.object({
  order_id:    z.string().uuid(),
  guest_token: z.string().uuid(),
  slug:        z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
})

export async function POST(request: NextRequest) {
  // 20 checkout attempts per IP per 10 minutes
  const ip = getClientIp(request.headers)
  if (!rateLimit(`order-checkout:${ip}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte warte kurz.' }, { status: 429 })
  }

  const parsed = BodySchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Fehlende oder ungültige Parameter' }, { status: 400 })
  }
  const { order_id, guest_token, slug } = parsed.data

  // Read total from DB — never trust the client
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, total, restaurant_id, status, guest_token')
    .eq('id', order_id)
    .eq('guest_token', guest_token)  // caller must know the guest_token
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 })
  }

  if (order.status !== 'pending_payment') {
    return NextResponse.json({ error: 'Bestellung bereits bezahlt oder storniert' }, { status: 400 })
  }

  // Fetch restaurant name for display
  const { data: restaurant } = await supabaseAdmin
    .from('restaurants')
    .select('name')
    .eq('id', order.restaurant_id)
    .single()

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(order.total * 100), // total is stored in euros
          product_data: { name: `Bestellung bei ${restaurant?.name ?? slug}` },
        },
        quantity: 1,
      },
    ],
    metadata: { order_id, slug },
    success_url: `${appUrl}/bestellen/${slug}?order_id=${order_id}&payment=success`,
    cancel_url: `${appUrl}/bestellen/${slug}?cancelled=true`,
  })

  return NextResponse.json({ url: session.url })
}
