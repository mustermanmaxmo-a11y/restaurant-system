import { NextRequest, NextResponse } from 'next/server'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail } from '@/lib/marketing/sendEmail'
import { buildRatingEmailHtml } from '@/lib/marketing/ratingEmail'
import { getPlatformSettings } from '@/lib/platform-config'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

async function handler(request: NextRequest) {
  let body: { orderId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const orderId = body.orderId
  if (typeof orderId !== 'string' || !orderId) {
    return NextResponse.json({ error: 'orderId_required' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  // Load order + restaurant + subscriber in a single query
  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, status, customer_id, customer_name, restaurant_id, rating_email_sent_at,
      restaurants!inner(name, logo_url, primary_color, rating_email_enabled),
      marketing_subscribers!orders_customer_id_fkey(id, email, opted_in_at, unsubscribed_at)
    `)
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return NextResponse.json({ skipped: 'order_not_found' })
  if (order.status !== 'served') return NextResponse.json({ skipped: 'not_served' })
  if (order.rating_email_sent_at !== null) return NextResponse.json({ skipped: 'already_sent' })
  if (!order.customer_id) return NextResponse.json({ skipped: 'no_subscriber' })

  const restaurant = (order.restaurants as unknown) as {
    name: string
    logo_url: string | null
    primary_color: string | null
    rating_email_enabled: boolean | null
  }
  if (!restaurant?.rating_email_enabled) {
    return NextResponse.json({ skipped: 'feature_disabled' })
  }

  const subscriber = (order.marketing_subscribers as unknown) as {
    id: string
    email: string
    opted_in_at: string | null
    unsubscribed_at: string | null
  } | null
  if (!subscriber) return NextResponse.json({ skipped: 'subscriber_not_found' })
  if (!subscriber.opted_in_at) return NextResponse.json({ skipped: 'never_opted_in' })
  if (subscriber.unsubscribed_at) return NextResponse.json({ skipped: 'unsubscribed' })

  // Dedup: skip if already rated in-app or via prior email click
  const { count: ratingCount } = await supabase
    .from('order_ratings')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId)
  if ((ratingCount ?? 0) > 0) return NextResponse.json({ skipped: 'already_rated' })

  // Build email
  const settings = await getPlatformSettings()
  const unsubscribeSecret = settings.unsubscribe_secret
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? 'fallback'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const unsubToken = crypto.createHmac('sha256', unsubscribeSecret)
    .update(`unsub:${subscriber.email}:${order.restaurant_id}`)
    .digest('hex').slice(0, 32)
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?e=${encodeURIComponent(subscriber.email)}&r=${order.restaurant_id}&t=${unsubToken}`

  const { subject, html, text, headers } = buildRatingEmailHtml({
    order: { id: order.id, customer_name: order.customer_name },
    restaurant,
    unsubscribeSecret,
    appUrl,
    unsubscribeUrl,
  })

  // Resolve from address — getPlatformSettings() does not expose resend_from_email,
  // so use RESEND_FROM env var with Resend default fallback.
  const fromEmail = process.env.RESEND_FROM ?? 'onboarding@resend.dev'
  const fromName = restaurant.name

  // Use immediate send (not queue) — rating emails are time-sensitive and
  // QStash already handled the delay. Queueing here would add up to 24h
  // additional lag on Vercel Hobby (cron runs daily). If Resend transiently
  // fails, we don't update rating_email_sent_at, so a future re-trigger
  // (e.g. manual replay) would retry the send.
  try {
    await sendEmail({
      restaurantId: order.restaurant_id,
      fromEmail,
      fromName,
      toEmail: subscriber.email,
      toSubscriberId: subscriber.id,
      subject,
      html,
      text,
      headers,
      immediate: true,
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'send_failed', detail: e instanceof Error ? e.message : 'unknown' },
      { status: 500 }
    )
  }

  // Mark sent
  await supabase
    .from('orders')
    .update({ rating_email_sent_at: new Date().toISOString() })
    .eq('id', orderId)

  // Log marketing event
  await supabase.from('marketing_events').insert({
    restaurant_id: order.restaurant_id,
    subscriber_id: order.customer_id,
    event_type: 'rating_email_sent',
    props: { order_id: orderId },
  })

  return NextResponse.json({ sent: true })
}

// QStash signature verification wraps the handler
export const POST = verifySignatureAppRouter(handler)
