import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const restaurantId = request.nextUrl.searchParams.get('state')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!code || !restaurantId) {
    return NextResponse.redirect(`${appUrl}/admin/settings?stripe=error`)
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })

  let stripeAccountId: string
  try {
    const response = await stripe.oauth.token({ grant_type: 'authorization_code', code })
    stripeAccountId = response.stripe_user_id!
  } catch {
    return NextResponse.redirect(`${appUrl}/admin/settings?stripe=error`)
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  await adminClient
    .from('restaurants')
    .update({ stripe_connect_account_id: stripeAccountId })
    .eq('id', restaurantId)

  return NextResponse.redirect(`${appUrl}/admin/settings?stripe=connected`)
}
