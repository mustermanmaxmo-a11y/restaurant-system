import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/marketing/sendEmail'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.N8N_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: restaurants } = await adminClient
    .from('restaurants')
    .select('id, name, slug, crm_rule_inactive, crm_rule_almost_goal, crm_rule_welcome')
    .eq('active', true)
    .or('crm_rule_inactive.eq.true,crm_rule_almost_goal.eq.true,crm_rule_welcome.eq.true')

  let totalSent = 0

  for (const resto of restaurants ?? []) {
    const { data: members } = await adminClient
      .from('loyalty_members')
      .select('id, user_id, stamp_count, created_at')
      .eq('restaurant_id', resto.id)

    const { data: authUsers } = await adminClient.auth.admin.listUsers()
    const emailMap: Record<string, string> = {}
    for (const u of authUsers.users ?? []) {
      if (u.email) emailMap[u.id] = u.email
    }

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    for (const member of members ?? []) {
      const email = emailMap[member.user_id]
      if (!email) continue

      const memberCreatedAt = new Date(member.created_at)
      const daysSinceJoin = Math.floor((today.getTime() - memberCreatedAt.getTime()) / 86400000)

      // Check already sent today (uses sent_date column for reliable dedup)
      const { data: alreadySent } = await adminClient
        .from('reengagement_log')
        .select('id')
        .eq('member_id', member.id)
        .eq('sent_date', todayStr)
        .limit(1)

      if (alreadySent && alreadySent.length > 0) continue

      let ruleFired: string | null = null
      let subject = ''
      let body = ''

      if (resto.crm_rule_welcome && daysSinceJoin === 1) {
        ruleFired = 'welcome'
        subject = `Willkommen bei ${resto.name}! 🎉`
        body = `Hallo!\n\nVielen Dank für deinen ersten Besuch bei ${resto.name}. Wir freuen uns, dich als Gast zu haben!\n\nDeinen Stempel-Stand kannst du jederzeit auf unserer Bestellseite einsehen.\n\nBis bald!\nDas Team von ${resto.name}`
      } else if (resto.crm_rule_inactive && daysSinceJoin > 30) {
        ruleFired = 'inactive_30d'
        subject = `Wir vermissen dich! 🍽️`
        body = `Hallo!\n\nEs ist eine Weile her, seit du zuletzt bei ${resto.name} warst. Du hast aktuell ${member.stamp_count} Stempel gesammelt.\n\nKomm vorbei und setz den nächsten Stempel!\n\nBis bald!\nDas Team von ${resto.name}`
      } else if (resto.crm_rule_almost_goal && member.stamp_count >= 8 && daysSinceJoin > 14) {
        ruleFired = 'almost_goal'
        subject = `Fast am Ziel! Noch ein paar Stempel... 🌟`
        body = `Hallo!\n\nDu hast bereits ${member.stamp_count} Stempel bei ${resto.name} gesammelt — du bist fast am Ziel!\n\nKomm vorbei und sichere dir deine Belohnung.\n\nBis bald!\nDas Team von ${resto.name}`
      }

      if (!ruleFired) continue

      const unsubLink = `${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe?rid=${resto.id}&email=${encodeURIComponent(email)}`

      try {
        const fullText = body + `\n\n---\nAbmelden: ${unsubLink}`
        const html = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111;white-space:pre-wrap;">${fullText.replace(/</g, '&lt;')}</div>`
        await sendEmail({
          restaurantId: resto.id,
          fromEmail: 'noreply@restaurantos.app',
          fromName: resto.name,
          toEmail: email,
          toSubscriberId: null,
          subject,
          html,
          campaignId: null,
        })

        await adminClient.from('reengagement_log').insert({
          restaurant_id: resto.id,
          member_id: member.id,
          rule: ruleFired,
          sent_date: todayStr,
          sent_at: new Date().toISOString(),
        })
        totalSent++
      } catch {
        // continue with next member
      }
    }
  }

  return NextResponse.json({ ok: true, sent: totalSent })
}
