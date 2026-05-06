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

    // Guest order payment via Stripe Checkout redirect
    if (session.mode === 'payment' && session.metadata?.order_id && !session.metadata?.split_token) {
      await supabaseAdmin
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', session.metadata.order_id)
    }

    // Split payment via Stripe Checkout redirect
    if (session.mode === 'payment' && session.metadata?.split_token) {
      const personNames: string[] = JSON.parse(session.metadata.person_names ?? '[]')
      if (personNames.length > 0) {
        const { data: split } = await supabaseAdmin
          .from('bill_splits')
          .select('id, payment_statuses')
          .eq('share_token', session.metadata.split_token)
          .single()

        if (split) {
          const updated: Record<string, string> = { ...(split.payment_statuses ?? {}) }
          for (const name of personNames) updated[name] = 'paid'
          await supabaseAdmin
            .from('bill_splits')
            .update({ payment_statuses: updated })
            .eq('id', split.id)
        }
      }
    }

    if (session.mode === 'subscription') {
      // Subscription checkout — update restaurant plan
      const userId = session.metadata?.user_id
      const plan = (session.metadata?.plan as 'starter' | 'pro') || 'starter'
      const customerId = session.customer as string
      const subscriptionId = session.subscription as string

      if (userId) {
        // Idempotency: only update if subscription not already set (prevents double-processing)
        await supabaseAdmin
          .from('restaurants')
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan,
            active: true,
          })
          .eq('owner_id', userId)
          .is('stripe_subscription_id', null)
      }
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
    const isTerminal = pi.payment_method_types?.includes('card_present')
    const restaurantId = pi.metadata?.restaurant_id

    if (isTerminal && restaurantId) {
      await supabaseAdmin.from('external_transactions').upsert({
        restaurant_id: restaurantId,
        source: 'stripe_terminal',
        external_id: pi.id,
        amount: pi.amount / 100,
        currency: pi.currency.toUpperCase(),
        paid_at: new Date(pi.created * 1000).toISOString(),
      }, { onConflict: 'external_id', ignoreDuplicates: true })
    }

    // Guest checkout — mark whole order as paid
    if (pi.metadata?.order_id) {
      await supabaseAdmin
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', pi.metadata.order_id)
    }

    // Split checkout — mark each person as paid
    if (pi.metadata?.split_token && pi.metadata?.person_names) {
      const personNames: string[] = JSON.parse(pi.metadata.person_names)
      const { data: split } = await supabaseAdmin
        .from('bill_splits')
        .select('id, payment_statuses')
        .eq('share_token', pi.metadata.split_token)
        .single()

      if (split) {
        const updated: Record<string, string> = { ...(split.payment_statuses ?? {}) }
        for (const name of personNames) updated[name] = 'paid'
        await supabaseAdmin
          .from('bill_splits')
          .update({ payment_statuses: updated })
          .eq('id', split.id)
      }
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
