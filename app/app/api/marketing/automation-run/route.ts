import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import crypto from 'crypto'
import { getPlatformSettings } from '@/lib/platform-config'

export const dynamic = 'force-dynamic'

// ---------- helpers ----------

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function buildSubject(automation: AutomationRow, restaurant: RestaurantRef): string {
  if (automation.subject_template) {
    return automation.subject_template.replace(/\[restaurant\.name\]/g, restaurant.name)
  }
  switch (automation.trigger_type) {
    case 'post_order': return `Danke für Ihre Bestellung bei ${restaurant.name}!`
    case 'inactivity_14d': return `Wir vermissen Sie! Exklusives Angebot von ${restaurant.name}`
    case 'birthday': return `Herzlichen Glückwunsch von ${restaurant.name}!`
    case 'seasonal': return `Frohe Feiertage von ${restaurant.name}!`
    case 'scheduled': return `${restaurant.name} hat Neuigkeiten für Sie`
    default: return `Nachricht von ${restaurant.name}`
  }
}

function buildBody(automation: AutomationRow, restaurant: RestaurantRef): string {
  if (automation.body_template) {
    return automation.body_template
      .replace(/\[restaurant\.name\]/g, restaurant.name)
      .replace(/\[discount_percent\]/g, String(automation.discount_percent ?? 10))
  }
  const discount = automation.discount_percent ?? 10
  switch (automation.trigger_type) {
    case 'post_order':
      return `Vielen Dank für Ihre Bestellung bei ${restaurant.name}!\n\nWie war Ihr Erlebnis? Wir freuen uns über Ihr Feedback.`
    case 'inactivity_14d':
      return `Wir vermissen Sie bei ${restaurant.name}!\n\nAls treuer Gast erhalten Sie ${discount}% Rabatt auf Ihren nächsten Besuch.`
    case 'birthday':
      return `Herzlichen Glückwunsch zum Geburtstag!\n\n${restaurant.name} wünscht Ihnen alles Gute und schenkt Ihnen ${discount}% Rabatt.`
    case 'seasonal':
      return `Frohe Feiertage von ${restaurant.name}!\n\nWir wünschen Ihnen eine schöne Zeit mit Ihren Liebsten.`
    case 'scheduled':
      return `${restaurant.name} hat Neuigkeiten für Sie.\n\nBesuchen Sie uns und überzeugen Sie sich selbst!`
    default:
      return `Nachricht von ${restaurant.name}.`
  }
}

/** Returns true if today matches a known seasonal event. */
function isSeasonalMatch(today: Date): boolean {
  const month = today.getMonth() + 1 // 1-based
  const day = today.getDate()
  if (month === 2 && day === 14) return true          // Valentinstag
  if (month === 12 && day >= 23 && day <= 26) return true // Weihnachten
  if (month === 12 && day === 31) return true          // Silvester
  if (month === 1 && day === 1) return true            // Neujahr
  return false
}

// ---------- types ----------

type RestaurantRef = { id: string; name: string; plan: string }

type AutomationRow = {
  id: string
  restaurant_id: string
  trigger_type: string
  trigger_config: Record<string, unknown>
  subject_template: string | null
  body_template: string | null
  discount_percent: number | null
  active: boolean
  last_run_at: string | null
  restaurants: RestaurantRef
}

type Subscriber = {
  id: string
  email: string
  restaurant_id: string
  last_order_at: string | null
  opted_in_at: string | null
  birthday: string | null
  subscribed: boolean
}

// ---------- main handler ----------

export async function POST(request: NextRequest) {
  const platformSettings = await getPlatformSettings()
  const authHeader = request.headers.get('authorization')
  const secret = platformSettings.marketing_automation_secret
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getAdminClient()
  const resend = new Resend(process.env.RESEND_API_KEY)
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const currentMonth = today.getMonth() + 1
  const currentDay = today.getDate()
  const currentWeekday = today.getDay() // 0=Sun … 6=Sat

  const twoHoursAgo = new Date(today.getTime() - 2 * 60 * 60 * 1000).toISOString()
  const fourHoursAgo = new Date(today.getTime() - 4 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Get all active automations across all restaurants
  const { data: automations, error: autoError } = await supabase
    .from('marketing_automations')
    .select('*, restaurants(id, name, plan)')
    .eq('active', true)

  if (autoError) {
    return NextResponse.json({ error: autoError.message }, { status: 500 })
  }

  let processed = 0
  let sent = 0
  let errors = 0

  for (const automation of (automations ?? []) as AutomationRow[]) {
    const restaurant = automation.restaurants
    if (!restaurant) continue

    processed++

    // 2. Determine eligible subscribers based on trigger_type
    let eligibleSubscribers: Subscriber[] = []

    if (automation.trigger_type === 'post_order') {
      // Ordered in the last 2-4 hours (capture recent orders, not instant duplicates)
      const { data } = await supabase
        .from('marketing_subscribers')
        .select('id, email, restaurant_id, last_order_at, birthday, subscribed')
        .eq('restaurant_id', restaurant.id)
        .eq('subscribed', true)
        .gte('last_order_at', fourHoursAgo)
        .lte('last_order_at', twoHoursAgo)
      eligibleSubscribers = (data ?? []) as Subscriber[]

    } else if (automation.trigger_type === 'inactivity_14d') {
      // last_order_at older than 14 days ago, OR never ordered but subscribed 14+ days ago
      // (prevents brand-new subscribers from immediately qualifying)
      const { data } = await supabase
        .from('marketing_subscribers')
        .select('id, email, restaurant_id, last_order_at, opted_in_at, birthday, subscribed')
        .eq('restaurant_id', restaurant.id)
        .eq('subscribed', true)
        .or(`last_order_at.lt.${fourteenDaysAgo},and(last_order_at.is.null,opted_in_at.lt.${fourteenDaysAgo})`)
      eligibleSubscribers = (data ?? []) as Subscriber[]

    } else if (automation.trigger_type === 'birthday') {
      // Birthday month + day matches today — filter in JS (Supabase lacks EXTRACT in .filter)
      const { data } = await supabase
        .from('marketing_subscribers')
        .select('id, email, restaurant_id, last_order_at, birthday, subscribed')
        .eq('restaurant_id', restaurant.id)
        .eq('subscribed', true)
        .not('birthday', 'is', null)
      eligibleSubscribers = ((data ?? []) as Subscriber[]).filter(sub => {
        if (!sub.birthday) return false
        const bday = new Date(sub.birthday)
        return bday.getUTCMonth() + 1 === currentMonth && bday.getUTCDate() === currentDay
      })

    } else if (automation.trigger_type === 'seasonal') {
      if (!isSeasonalMatch(today)) continue
      const { data } = await supabase
        .from('marketing_subscribers')
        .select('id, email, restaurant_id, last_order_at, birthday, subscribed')
        .eq('restaurant_id', restaurant.id)
        .eq('subscribed', true)
      eligibleSubscribers = (data ?? []) as Subscriber[]

    } else if (automation.trigger_type === 'scheduled') {
      const config = automation.trigger_config ?? {}
      const targetWeekday = typeof config.weekday === 'number' ? config.weekday : null
      if (targetWeekday !== null && currentWeekday !== targetWeekday) continue
      const { data } = await supabase
        .from('marketing_subscribers')
        .select('id, email, restaurant_id, last_order_at, birthday, subscribed')
        .eq('restaurant_id', restaurant.id)
        .eq('subscribed', true)
      eligibleSubscribers = (data ?? []) as Subscriber[]

    } else {
      continue
    }

    if (eligibleSubscribers.length === 0) {
      // Still update last_run_at
      await supabase
        .from('marketing_automations')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', automation.id)
      continue
    }

    // 3. Build email content once per automation
    const subject = buildSubject(automation, restaurant)
    const body = buildBody(automation, restaurant)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://restaurantos.app'

    for (const subscriber of eligibleSubscribers) {
      // Deduplication via reengagement_log.
      // reengagement_log schema: id, restaurant_id, member_id (FK loyalty_members nullable), rule, sent_date, sent_at
      // We use rule = `auto_<automation.id>_<subscriber.id>` to uniquely identify per-subscriber sends.
      // member_id is kept null (marketing_subscribers != loyalty_members).
      const dedupeRule = `auto_${automation.id}_${subscriber.id}`

      const { data: alreadySent } = await supabase
        .from('reengagement_log')
        .select('id')
        .eq('restaurant_id', restaurant.id)
        .eq('rule', dedupeRule)
        .gte('sent_date', todayStr)
        .maybeSingle()

      if (alreadySent) continue

      // DSGVO: use HMAC token instead of raw email in URL (prevents PII exposure in logs/referrers)
      const unsubSecret = platformSettings.unsubscribe_secret ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'fallback'
      const unsubToken = crypto
        .createHmac('sha256', unsubSecret)
        .update(`${restaurant.id}:${subscriber.email}`)
        .digest('hex')
        .slice(0, 32)
      const unsubLink = `${appUrl}/unsubscribe?rid=${restaurant.id}&token=${unsubToken}`
      const htmlBody = `<p>${body.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p><hr style="border:none;border-top:1px solid #eee;margin:20px 0"/><p style="font-size:12px;color:#aaa">Sie erhalten diese E-Mail als Gast von ${restaurant.name}. <a href="${unsubLink}" style="color:#aaa">Abmelden</a></p>`

      try {
        await resend.emails.send({
          from: `${restaurant.name} <noreply@restaurantos.app>`,
          to: subscriber.email,
          subject,
          html: htmlBody,
        })

        // Log send for deduplication
        await supabase.from('reengagement_log').insert({
          restaurant_id: restaurant.id,
          member_id: null,
          rule: dedupeRule,
          sent_date: todayStr,
          sent_at: new Date().toISOString(),
        })

        sent++
      } catch {
        errors++
      }
    }

    // 4. Update last_run_at
    await supabase
      .from('marketing_automations')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', automation.id)
  }

  return NextResponse.json({ processed, sent, errors })
}
