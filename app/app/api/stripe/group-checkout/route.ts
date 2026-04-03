import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const BodySchema = z.object({
  group_id: z.string().uuid(),
  member_name: z.string().min(1).max(100),
})

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers)
  if (!rateLimit(`group-checkout:${ip}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte warte kurz.' }, { status: 429 })
  }

  const body = await request.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }
  const { group_id, member_name } = parsed.data

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: group } = await supabase
    .from('order_groups')
    .select('id, status, restaurant_id, table_id')
    .eq('id', group_id)
    .eq('status', 'submitted')
    .single()

  if (!group) {
    return NextResponse.json({ error: 'Group not found or not submitted' }, { status: 404 })
  }

  const { data: existingPayment } = await supabase
    .from('group_payments')
    .select('status')
    .eq('group_id', group_id)
    .eq('member_name', member_name)
    .single()

  if (existingPayment && existingPayment.status !== 'pending') {
    return NextResponse.json({ error: 'Already paid or committed' }, { status: 409 })
  }

  // Items: eigene + ggf. übernommene Members (Variante B)
  const { data: coveredMembers } = await supabase
    .from('group_payments')
    .select('member_name')
    .eq('group_id', group_id)
    .eq('covered_by', member_name)

  const membersToCharge = [member_name, ...(coveredMembers?.map(c => c.member_name) ?? [])]

  const { data: items } = await supabase
    .from('group_items')
    .select('name, price, qty')
    .eq('group_id', group_id)
    .in('added_by', membersToCharge)

  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'No items for this member' }, { status: 404 })
  }

  // Redirect-URL: für Dine-In /order/[token], für Delivery/Pickup /bestellen/[slug]
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('slug')
    .eq('id', group.restaurant_id)
    .single()

  const { data: table } = await supabase
    .from('tables')
    .select('qr_token')
    .eq('id', group.table_id ?? '')
    .single()

  const base = table?.qr_token
    ? `${process.env.NEXT_PUBLIC_APP_URL}/order/${table.qr_token}`
    : `${process.env.NEXT_PUBLIC_APP_URL}/bestellen/${restaurant?.slug}`

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'paypal'],
      line_items: items.map(i => ({
        price_data: {
          currency: 'eur',
          product_data: { name: i.name },
          unit_amount: Math.round(i.price * 100),
        },
        quantity: i.qty,
      })),
      metadata: {
        type: 'group_payment',
        group_id: group.id,
        member_name,
      },
      success_url: `${base}?group_paid=${group_id}&member=${encodeURIComponent(member_name)}`,
      cancel_url: `${base}?group_cancel=${group_id}`,
    })
  } catch (err) {
    console.error('Stripe session creation failed:', err)
    return NextResponse.json({ error: 'Payment session failed' }, { status: 500 })
  }

  const total = items.reduce((s, i) => s + i.price * i.qty, 0)

  const { error: upsertError } = await supabase.from('group_payments').upsert({
    group_id: group.id,
    member_name,
    stripe_session_id: session.id,
    amount: Math.round(total * 100) / 100,
    status: 'pending',
  }, { onConflict: 'group_id,member_name' })

  if (upsertError) {
    console.error('group_payments upsert failed:', upsertError)
    return NextResponse.json({ error: 'Failed to save payment record' }, { status: 500 })
  }

  return NextResponse.json({ url: session.url })
}
