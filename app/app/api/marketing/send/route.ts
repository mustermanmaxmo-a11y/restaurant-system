import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'
import crypto from 'crypto'
import { buildEmail, resolveEmailStyle, type EmailContext } from '@/lib/email-base-templates'
import { sendEmail } from '@/lib/marketing/sendEmail'

const FROM = process.env.RESEND_FROM ?? 'onboarding@resend.dev'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { restaurantId, campaignId } = body

  if (!restaurantId || !campaignId) {
    return NextResponse.json({ error: 'restaurantId and campaignId required' }, { status: 400 })
  }

  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!await rateLimit(`marketing-send:${restaurantId}`, 5, 3_600_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen.' }, { status: 429 })
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name, slug, logo_url, primary_color, email_marketing_enabled, design_package, email_style_override, contact_email, contact_address')
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .single()

  if (!restaurant || !restaurant.email_marketing_enabled) {
    return NextResponse.json({ error: 'Email-Marketing nicht aktiviert.' }, { status: 403 })
  }

  const { data: campaign } = await supabase
    .from('marketing_campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!campaign || campaign.status === 'sent') {
    return NextResponse.json({ error: 'Kampagne nicht gefunden oder bereits versendet.' }, { status: 404 })
  }

  // Load subscribers based on target
  let query = supabase
    .from('marketing_subscribers')
    .select('id, email, name')
    .eq('restaurant_id', restaurantId)
    .is('unsubscribed_at', null)

  if (campaign.target === 'loyalty') {
    const { data: members } = await supabase
      .from('loyalty_members')
      .select('user_id')
      .eq('restaurant_id', restaurantId)
    if (members && members.length > 0) {
      const { data: auUsers } = await supabase.auth.admin.listUsers()
      const memberEmails = auUsers?.users
        .filter(u => members.some(m => m.user_id === u.id))
        .map(u => u.email!)
        .filter(Boolean) ?? []
      if (memberEmails.length > 0) {
        query = query.in('email', memberEmails)
      }
    }
  }

  const { data: subscribers } = await query.limit(500)
  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ error: 'Keine Abonnenten gefunden.' }, { status: 400 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.restaurantos.app'
  const primaryColor = restaurant.primary_color ?? '#ea580c'
  const style = resolveEmailStyle({
    designPackage: restaurant.design_package,
    emailStyleOverride: restaurant.email_style_override,
  })

  // Send emails in batches
  let sent = 0
  for (const sub of subscribers) {
    const unsub_token = crypto
      .createHmac('sha256', process.env.EMAIL_API_SECRET ?? 'secret')
      .update(`${sub.email}:${restaurantId}`)
      .digest('hex')
      .slice(0, 32)

    const unsubLink = `${baseUrl}/unsubscribe/${unsub_token}?email=${encodeURIComponent(sub.email)}&rid=${restaurantId}`
    const ctaUrl = `${baseUrl}/bestellen/${restaurant.slug ?? ''}`
    const customerName = (sub.name && sub.name.trim()) || sub.email.split('@')[0]

    const ctx: EmailContext = {
      restaurantName: restaurant.name,
      logoUrl: restaurant.logo_url,
      customerName,
      primaryColor,
      heroText: campaign.subject,
      bodyText: campaign.body,
      ctaText: 'Jetzt bestellen',
      ctaUrl,
      unsubscribeUrl: unsubLink,
      addressLine: restaurant.contact_address,
    }
    const html = buildEmail(style, 'manual', ctx)

    try {
      await sendEmail({
        restaurantId,
        fromEmail: FROM,
        fromName: restaurant.name,
        toEmail: sub.email,
        toSubscriberId: sub.id ?? null,
        replyTo: restaurant.contact_email ?? undefined,
        subject: campaign.subject,
        html,
        // RFC 8058 one-click unsubscribe — required by Gmail/Yahoo bulk sender policy
        headers: {
          'List-Unsubscribe': `<${unsubLink}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
        campaignId,
      })
      sent++
    } catch { /* continue on error */ }
  }

  await supabase
    .from('marketing_campaigns')
    .update({ status: 'sent', sent_at: new Date().toISOString(), recipient_count: sent })
    .eq('id', campaignId)

  return NextResponse.json({ sent })
}
