import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

export async function POST(request: NextRequest) {
  const stripe = getStripe()
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  }

  const body = await request.json()
  const { plan } = body as { plan: 'basic' | 'pro' }

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
      user_id: session.user.id,
      plan,
    },
    subscription_data: {
      metadata: {
        user_id: session.user.id,
        plan,
      },
    },
    customer_email: session.user.email,
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
