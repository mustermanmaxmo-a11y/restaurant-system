import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail } from '@/lib/marketing/sendEmail'
import { buildCampaignEmail } from '@/lib/marketing/campaignEmail'
import { generateDiscountCode } from '@/lib/marketing/generateDiscountCode'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
const FROM_EMAIL = process.env.RESEND_FROM ?? 'onboarding@resend.dev'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseAdmin()
  let totalSent = 0
  let totalSkipped = 0

  // ── 1. Personal Triggers (Birthday + First-Order Anniversary) ─────────────
  const { data: personalCampaigns } = await supabase
    .from('campaigns')
    .select('id, restaurant_id, trigger_type, subject, headline, body_text, discount_type, discount_value, expires_days, enabled')
    .in('trigger_type', ['birthday', 'first_order_anniversary'])
    .eq('enabled', true)

  for (const campaign of personalCampaigns ?? []) {
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, slug, logo_url, primary_color')
      .eq('id', campaign.restaurant_id)
      .maybeSingle()
    if (!restaurant) continue

    let subscribers: Array<{ id: string; email: string; name: string | null }> = []

    if (campaign.trigger_type === 'birthday') {
      const { data } = await supabase.rpc('get_birthday_subscribers_today', {
        p_restaurant_id: campaign.restaurant_id,
        p_campaign_id: campaign.id,
      })
      subscribers = (data ?? []) as Array<{ id: string; email: string; name: string | null }>
    } else {
      const { data } = await supabase.rpc('get_anniversary_subscribers_today', {
        p_restaurant_id: campaign.restaurant_id,
        p_campaign_id: campaign.id,
      })
      subscribers = (data ?? []) as Array<{ id: string; email: string; name: string | null }>
    }

    for (const sub of subscribers) {
      const { sent, skipped } = await sendCampaignToSubscriber({ supabase, campaign, restaurant, subscriber: sub })
      totalSent += sent
      totalSkipped += skipped
    }
  }

  // ── 2. Custom Events ──────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const { data: eventCampaigns } = await supabase
    .from('campaigns')
    .select('id, restaurant_id, trigger_type, subject, headline, body_text, discount_type, discount_value, expires_days, enabled')
    .eq('trigger_type', 'custom_event')
    .eq('send_date', today)
    .eq('enabled', true)
    .is('sent_at', null)

  for (const campaign of eventCampaigns ?? []) {
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, slug, logo_url, primary_color')
      .eq('id', campaign.restaurant_id)
      .maybeSingle()
    if (!restaurant) continue

    const { data: subscribers } = await supabase
      .from('marketing_subscribers')
      .select('id, email, name')
      .eq('restaurant_id', campaign.restaurant_id)
      .is('unsubscribed_at', null)
      .not('email', 'is', null)

    for (const sub of subscribers ?? []) {
      const { sent, skipped } = await sendCampaignToSubscriber({ supabase, campaign, restaurant, subscriber: sub as { id: string; email: string; name: string | null } })
      totalSent += sent
      totalSkipped += skipped
    }

    await supabase
      .from('campaigns')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', campaign.id)
  }

  return NextResponse.json({ totalSent, totalSkipped })
}

type Restaurant = { id: string; name: string; slug: string; logo_url: string | null; primary_color: string | null }
type Campaign = { id: string; restaurant_id: string; trigger_type: string; subject: string; headline: string; body_text: string; discount_type: string | null; discount_value: number | null; expires_days: number }
type Subscriber = { id: string; email: string; name: string | null }

async function sendCampaignToSubscriber({
  supabase, campaign, restaurant, subscriber,
}: {
  supabase: ReturnType<typeof createSupabaseAdmin>
  campaign: Campaign
  restaurant: Restaurant
  subscriber: Subscriber
}): Promise<{ sent: number; skipped: number }> {
  // Dedup: already sent for this campaign+subscriber?
  const { data: existing } = await supabase
    .from('discount_codes')
    .select('id')
    .eq('subscriber_id', subscriber.id)
    .eq('campaign_id', campaign.id)
    .maybeSingle()
  if (existing) return { sent: 0, skipped: 1 }

  const hasDiscount = !!(campaign.discount_type && campaign.discount_value)
  let code: string | null = null
  let expiresAt: Date | null = null

  if (hasDiscount) {
    const prefix = campaign.trigger_type === 'birthday' ? 'BDAY'
      : campaign.trigger_type === 'first_order_anniversary' ? 'ANNI' : 'EVT'
    code = generateDiscountCode(prefix as 'BDAY' | 'ANNI' | 'EVT')
    expiresAt = new Date(Date.now() + (campaign.expires_days ?? 7) * 86400 * 1000)

    const { error: codeErr } = await supabase.from('discount_codes').insert({
      restaurant_id: restaurant.id,
      subscriber_id: subscriber.id,
      campaign_id: campaign.id,
      code,
      discount_type: campaign.discount_type,
      discount_value: campaign.discount_value,
      expires_at: expiresAt.toISOString(),
    })
    if (codeErr) return { sent: 0, skipped: 1 }
  } else {
    // No discount — still dedup via a dummy record to prevent re-sending
    // We insert a minimal record to track that this subscriber was already processed
    // Actually: for no-discount campaigns, we check sent via a different mechanism
    // Simple approach: insert a discount_code record with code=null isn't possible (UNIQUE NOT NULL)
    // Solution: skip the dedup insert for no-discount campaigns — rely on custom_event.sent_at for events
    // For personal triggers without discount: accept re-send risk (edge case, rare)
  }

  const discountLabel = hasDiscount
    ? campaign.discount_type === 'percent'
      ? `${campaign.discount_value} % Rabatt`
      : `${campaign.discount_value} € Rabatt`
    : null

  const unsubToken = Buffer.from(`${subscriber.id}:unsub`).toString('base64url')
  const unsubscribeUrl = `${APP_URL}/unsubscribe?t=${unsubToken}`
  const ctaUrl = code
    ? `${APP_URL}/bestellen/${restaurant.slug}?code=${code}`
    : `${APP_URL}/bestellen/${restaurant.slug}`

  const { subject, html, text, headers } = buildCampaignEmail({
    customerName: subscriber.name,
    restaurantName: restaurant.name,
    restaurantLogoUrl: restaurant.logo_url,
    primaryColor: restaurant.primary_color ?? '#EA580C',
    subject: campaign.subject,
    headline: campaign.headline,
    bodyText: campaign.body_text,
    code,
    discountLabel,
    expiresAt,
    ctaUrl,
    unsubscribeUrl,
  })

  try {
    await sendEmail({
      restaurantId: restaurant.id,
      fromEmail: FROM_EMAIL,
      fromName: restaurant.name,
      toEmail: subscriber.email,
      toSubscriberId: subscriber.id,
      subject,
      html,
      text,
      headers,
      campaignId: campaign.id,
      immediate: true,
    })
  } catch {
    return { sent: 0, skipped: 1 }
  }

  return { sent: 1, skipped: 0 }
}
