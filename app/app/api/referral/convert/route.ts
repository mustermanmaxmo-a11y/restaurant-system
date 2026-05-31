import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { generateDiscountCode } from '@/lib/marketing/generateDiscountCode'
import { logEvent } from '@/lib/marketing/events'

// Max age for a referral conversion claim: 30 minutes after order creation.
// Prevents replay attacks where an attacker reuses an observed orderId later.
const MAX_ORDER_AGE_MS = 30 * 60 * 1000

export async function POST(req: NextRequest) {
  const { orderId, referrerCode, restaurantId, customerEmail } = await req.json()
  if (!orderId || !referrerCode || !restaurantId || !customerEmail) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  // 1. Check referral is enabled for this restaurant
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('referral_enabled, referral_reward_type, referral_reward_points, referral_reward_discount_percent')
    .eq('id', restaurantId)
    .single()

  if (!restaurant?.referral_enabled) {
    return NextResponse.json({ ok: false, reason: 'referral_disabled' })
  }

  // 2. Load the order — must belong to this restaurant, be recent, and not yet attributed
  const { data: order } = await supabase
    .from('orders')
    .select('id, customer_email, referred_by_code, created_at, restaurant_id')
    .eq('id', orderId)
    .single()

  if (!order || order.restaurant_id !== restaurantId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Verify the caller actually placed this order (knows the email)
  if (
    !order.customer_email ||
    order.customer_email.toLowerCase() !== customerEmail.toLowerCase().trim()
  ) {
    return NextResponse.json({ ok: false, reason: 'email_mismatch' })
  }

  // Reject stale claims — prevents replaying an old orderId
  const orderAge = Date.now() - new Date(order.created_at).getTime()
  if (orderAge > MAX_ORDER_AGE_MS) {
    return NextResponse.json({ ok: false, reason: 'order_too_old' })
  }

  // Idempotency: already attributed?
  if (order.referred_by_code) {
    return NextResponse.json({ ok: true, reason: 'already_converted' })
  }

  // 3. Find referrer subscriber by code
  const { data: referrer } = await supabase
    .from('marketing_subscribers')
    .select('id, email')
    .eq('restaurant_id', restaurantId)
    .eq('referral_code', referrerCode.toUpperCase())
    .maybeSingle()

  if (!referrer) {
    return NextResponse.json({ ok: false, reason: 'code_not_found' })
  }

  // Prevent self-referral
  if (order.customer_email.toLowerCase() === referrer.email.toLowerCase()) {
    return NextResponse.json({ ok: false, reason: 'self_referral' })
  }

  // 4. Idempotency via referral_conversions (belt + suspenders)
  const { data: existing } = await supabase
    .from('referral_conversions')
    .select('id')
    .eq('referred_order_id', orderId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, reason: 'already_converted' })
  }

  // 5. Mark attribution on order
  await supabase
    .from('orders')
    .update({ referred_by_code: referrerCode.toUpperCase() })
    .eq('id', orderId)

  // 6. Grant reward(s)
  const rewardType = restaurant.referral_reward_type
  let rewardDiscountCodeId: string | null = null

  if (rewardType === 'points' || rewardType === 'both') {
    await supabase.rpc('credit_referral_points', {
      p_subscriber_id: referrer.id,
      p_restaurant_id: restaurantId,
      p_points: restaurant.referral_reward_points ?? 50,
    }).catch(() => {
      // Non-fatal: loyalty may not be enabled for this restaurant
    })
  }

  if (rewardType === 'discount' || rewardType === 'both') {
    const pct = restaurant.referral_reward_discount_percent ?? 10
    const code = generateDiscountCode('REF')
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    const { data: codeRow } = await supabase
      .from('discount_codes')
      .insert({
        restaurant_id: restaurantId,
        subscriber_id: referrer.id,
        code,
        discount_type: 'percent',
        discount_value: pct,
        expires_at: expiresAt,
      })
      .select('id')
      .single()
    if (codeRow) rewardDiscountCodeId = codeRow.id
  }

  // 7. Create conversion record
  await supabase.from('referral_conversions').insert({
    restaurant_id: restaurantId,
    referrer_subscriber_id: referrer.id,
    referred_order_id: orderId,
    reward_type: rewardType,
    reward_discount_code_id: rewardDiscountCodeId,
  })

  await logEvent({
    restaurantId,
    eventType: 'referred_friend',
    subscriberId: referrer.id,
    props: { order_id: orderId, reward_type: rewardType },
  })

  return NextResponse.json({ ok: true })
}
