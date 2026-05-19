import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY!)
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
    .select('name, email_marketing_enabled')
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
    .select('email, name')
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

  // Send emails in batches of 50
  let sent = 0
  for (const sub of subscribers) {
    const unsub_token = crypto
      .createHmac('sha256', process.env.EMAIL_API_SECRET ?? 'secret')
      .update(`${sub.email}:${restaurantId}`)
      .digest('hex')
      .slice(0, 32)

    const unsubLink = `${baseUrl}/unsubscribe/${unsub_token}?email=${encodeURIComponent(sub.email)}&rid=${restaurantId}`

    const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h2>${restaurant.name}</h2>
  <div style="white-space:pre-wrap;line-height:1.6">${campaign.body}</div>
  <hr style="margin:32px 0;border:none;border-top:1px solid #eee">
  <p style="color:#999;font-size:12px">
    Du erhältst diese Email weil du dich für Angebote von ${restaurant.name} angemeldet hast.<br>
    <a href="${unsubLink}" style="color:#999">Abmelden</a>
  </p>
</div>`

    try {
      await resend.emails.send({
        from: FROM,
        to: sub.email,
        subject: campaign.subject,
        html,
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
