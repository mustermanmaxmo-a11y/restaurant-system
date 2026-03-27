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
    const userId = session.metadata?.user_id
    const plan = (session.metadata?.plan as 'basic' | 'pro') || 'basic'
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

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const customerId = subscription.customer as string

    await supabaseAdmin
      .from('restaurants')
      .update({ active: false })
      .eq('stripe_customer_id', customerId)
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription
    const customerId = subscription.customer as string
    const priceId = subscription.items.data[0]?.price.id

    const plan = priceId === process.env.STRIPE_PRICE_PRO ? 'pro' : 'basic'
    const active = subscription.status === 'active'

    await supabaseAdmin
      .from('restaurants')
      .update({ plan, active })
      .eq('stripe_customer_id', customerId)
  }

  return NextResponse.json({ received: true })
}

export const runtime = 'nodejs'
