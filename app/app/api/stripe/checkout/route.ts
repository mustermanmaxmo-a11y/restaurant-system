import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  const body = await request.json()
  const { plan, user_id, user_email } = body as {
    plan: 'basic' | 'pro'
    user_id: string
    user_email: string
  }

  if (!user_id) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  }

  const priceId = plan === 'pro'
    ? process.env.STRIPE_PRICE_PRO!
    : process.env.STRIPE_PRICE_BASIC!

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/admin?welcome=true`,
    cancel_url: `${appUrl}/admin/setup?cancelled=true`,
    metadata: {
      user_id,
      plan,
    },
    subscription_data: {
      metadata: {
        user_id,
        plan,
      },
    },
    customer_email: user_email,
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
