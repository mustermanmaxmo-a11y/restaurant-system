import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const BodySchema = z.object({
  plan: z.enum(['basic', 'pro']),
})

export async function POST(request: NextRequest) {
  // Verify Supabase session from Authorization header
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Ungültige Session' }, { status: 401 })
  }

  const parsed = BodySchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültiger Plan' }, { status: 400 })
  }
  const { plan } = parsed.data

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const priceId = plan === 'pro' ? process.env.STRIPE_PRICE_PRO! : process.env.STRIPE_PRICE_BASIC!
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/admin?welcome=true`,
    cancel_url: `${appUrl}/admin/setup?cancelled=true`,
    metadata: { user_id: user.id, plan },
    subscription_data: { metadata: { user_id: user.id, plan } },
    customer_email: user.email,
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
