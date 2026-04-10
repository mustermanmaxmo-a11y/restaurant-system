import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return NextResponse.json({ error: 'Webhook signature invalid' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    if (session.mode === 'subscription') {
      // Subscription checkout — update restaurant plan
      const userId = session.metadata?.user_id
      const plan = (session.metadata?.plan as 'starter' | 'pro') || 'starter'
      const customerId = session.customer as string
      const subscriptionId = session.subscription as string

      if (userId) {
        await supabaseAdmin
          .from('restaurants')
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan,
            active: true,
          })
          .eq('owner_id', userId)
      }
    }
    if (session.mode === 'payment' && session.metadata?.order_id) {
      // Payment confirmed — activate the order for the kitchen
      await supabaseAdmin
        .from('orders')
        .update({ status: 'new' })
        .eq('id', session.metadata.order_id)
        .eq('status', 'pending_payment')
    }

    // Gruppenanteil online bezahlt
    if (session.mode === 'payment' && session.metadata?.type === 'group_payment') {
      const groupId = session.metadata.group_id
      const memberName = session.metadata.member_name

      await supabaseAdmin
        .from('group_payments')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('group_id', groupId)
        .eq('member_name', memberName)

      // Prüfen ob alle Members eine Wahl getroffen haben (kein 'pending' mehr)
      const { data: allPayments } = await supabaseAdmin
        .from('group_payments')
        .select('status')
        .eq('group_id', groupId)

      const allCommitted = allPayments?.every(p => p.status !== 'pending')

      if (allCommitted) {
        // Atomic transition: only one concurrent request wins
        const { count } = await supabaseAdmin
          .from('order_groups')
          .update({ status: 'ordering' }, { count: 'exact' })
          .eq('id', groupId)
          .eq('status', 'submitted')

        if (count === 1) {
          const { data: group } = await supabaseAdmin
            .from('order_groups')
            .select('id, restaurant_id, table_id')
            .eq('id', groupId)
            .single()

          if (group) {
            const { data: groupItems } = await supabaseAdmin
              .from('group_items')
              .select('item_id, name, price, qty, added_by')
              .eq('group_id', groupId)

            if (groupItems && groupItems.length > 0) {
              const aggregated: Record<string, { item_id: string; name: string; price: number; qty: number }> = {}
              const byPerson: Record<string, string[]> = {}

              groupItems.forEach(gi => {
                if (aggregated[gi.item_id]) {
                  aggregated[gi.item_id].qty += gi.qty
                } else {
                  aggregated[gi.item_id] = { item_id: gi.item_id, name: gi.name, price: gi.price, qty: gi.qty }
                }
                if (!byPerson[gi.added_by]) byPerson[gi.added_by] = []
                byPerson[gi.added_by].push(`${gi.qty}× ${gi.name}`)
              })

              const groupNote = Object.entries(byPerson)
                .map(([name, items]) => `${name}: ${items.join(', ')}`)
                .join(' | ')

              const total = groupItems.reduce((s: number, i: { price: number; qty: number }) => s + i.price * i.qty, 0)

              await supabaseAdmin.from('orders').insert({
                restaurant_id: group.restaurant_id,
                order_type: 'dine_in',
                table_id: group.table_id,
                status: 'new',
                items: Object.values(aggregated),
                note: `[Gruppenbestellung] ${groupNote}`,
                total: Math.round(total * 100) / 100,
                customer_name: memberName,
              })
            }
          }
        }
      }
    }
  }

  if (event.type === 'checkout.session.expired') {
    // Order payment abandoned — mark order as cancelled
    const session = event.data.object as Stripe.Checkout.Session
    if (session.mode === 'payment' && session.metadata?.order_id) {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', session.metadata.order_id)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const customerId = subscription.customer as string

    await supabaseAdmin
      .from('restaurants')
      .update({ active: false, plan: 'expired' })
      .eq('stripe_customer_id', customerId)
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent
    // Nur Terminal-Zahlungen (card_present = physisches Kartenlesegerät)
    const isTerminal = pi.payment_method_types?.includes('card_present')
    const restaurantId = pi.metadata?.restaurant_id
    if (isTerminal && restaurantId) {
      await supabaseAdmin.from('external_transactions').insert({
        restaurant_id: restaurantId,
        source: 'stripe_terminal',
        external_id: pi.id,
        amount: pi.amount / 100,
        currency: pi.currency.toUpperCase(),
        paid_at: new Date(pi.created * 1000).toISOString(),
      })
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription
    const customerId = subscription.customer as string
    const priceId = subscription.items.data[0]?.price.id

    const plan = priceId === process.env.STRIPE_PRICE_PRO ? 'pro' : 'starter'
    const active = subscription.status === 'active'

    await supabaseAdmin
      .from('restaurants')
      .update({ plan, active })
      .eq('stripe_customer_id', customerId)
  }

  return NextResponse.json({ received: true })
}

export const runtime = 'nodejs'
