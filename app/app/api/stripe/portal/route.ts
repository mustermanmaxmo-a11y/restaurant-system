import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const BodySchema = z.object({
  return_url: z.string().url().optional(),
})

export async function POST(request: NextRequest) {
  // Verify Supabase session from Authorization header
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
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

  // Read customer_id from DB — never trust the client
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('stripe_customer_id')
    .eq('owner_id', user.id)
    .single()

  if (!restaurant?.stripe_customer_id) {
    return NextResponse.json({ error: 'Kein Stripe-Kunde gefunden' }, { status: 404 })
  }

  const parsed = BodySchema.safeParse(await request.json())
  const { return_url } = parsed.success ? parsed.data : {}

  // Validate return_url — only allow redirects within our own app
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const safeReturnUrl = return_url?.startsWith(appUrl)
    ? return_url
    : appUrl + '/admin/billing'

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const session = await stripe.billingPortal.sessions.create({
    customer: restaurant.stripe_customer_id,
    return_url: safeReturnUrl,
  })

  return NextResponse.json({ url: session.url })
}
