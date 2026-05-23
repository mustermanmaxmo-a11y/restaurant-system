import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { getPlatformSettings } from '@/lib/platform-config'
import { renderEmailTemplate } from '@/lib/email-template-renderer'
import { sendEmail } from '@/lib/marketing/sendEmail'
import {
  getBaseTemplateForTrigger,
  DISCOUNT_BLOCK,
  buildLogoBlock,
  buildEmail,
  resolveEmailStyle,
  type EmailContext,
  type TriggerType,
} from '@/lib/email-base-templates'

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

function buildPlainBody(automation: AutomationRow, restaurant: RestaurantRef): string {
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

type RestaurantRef = {
  id: string
  name: string
  slug: string
  plan: string
  logo_url?: string | null
  design_config?: { primary_color?: string } | null
  design_package?: string | null
  email_style_override?: string | null
  contact_email?: string | null
  contact_address?: string | null
  primary_color?: string | null
}

type AutomationRow = {
  id: string
  restaurant_id: string
  trigger_type: string
  trigger_config: Record<string, unknown>
  subject_template: string | null
  body_template: string | null
  discount_percent: number | null
  template_id: string | null
  segment: string | null
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
  order_count?: number | null
  total_spent?: number | null
}

type EmailTemplateRow = {
  id: string
  subject_template: string
  body_html: string
  style: string | null
  uses_style: boolean | null
}

type OrderLookup = {
  id: string
  customer_email: string | null
  customer_name: string | null
  items: Array<{ name: string; qty: number; price?: number }> | null
}

// ---------- core logic (exported for Vercel Cron) ----------

export async function runMarketingAutomations(): Promise<{ processed: number; sent: number; errors: number }> {
  const platformSettings = await getPlatformSettings()
  const supabase = getAdminClient()
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const currentMonth = today.getMonth() + 1
  const currentDay = today.getDate()
  const currentWeekday = today.getDay() // 0=Sun … 6=Sat

  const twoHoursAgo = new Date(today.getTime() - 2 * 60 * 60 * 1000).toISOString()
  const fourHoursAgo = new Date(today.getTime() - 4 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Get all active automations across all restaurants
  const { data: automations, error: autoError } = await supabase
    .from('marketing_automations')
    .select('*, restaurants(id, name, slug, plan, logo_url, design_config, design_package, email_style_override, contact_email, contact_address, primary_color)')
    .eq('active', true)

  if (autoError) throw new Error(autoError.message)

  let processed = 0
  let sent = 0
  let errors = 0

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://restaurantos.app'

  for (const automation of (automations ?? []) as AutomationRow[]) {
    const restaurant = automation.restaurants
    if (!restaurant) continue

    processed++

    // 2. Determine eligible subscribers based on trigger_type
    let eligibleSubscribers: Subscriber[] = []

    if (automation.trigger_type === 'post_order') {
      const { data } = await supabase
        .from('marketing_subscribers')
        .select('id, email, restaurant_id, last_order_at, birthday, subscribed, order_count, total_spent')
        .eq('restaurant_id', restaurant.id)
        .eq('subscribed', true)
        .gte('last_order_at', fourHoursAgo)
        .lte('last_order_at', twoHoursAgo)
      eligibleSubscribers = (data ?? []) as Subscriber[]

    } else if (automation.trigger_type === 'inactivity_14d') {
      const { data } = await supabase
        .from('marketing_subscribers')
        .select('id, email, restaurant_id, last_order_at, opted_in_at, birthday, subscribed, order_count, total_spent')
        .eq('restaurant_id', restaurant.id)
        .eq('subscribed', true)
        .or(`last_order_at.lt.${fourteenDaysAgo},and(last_order_at.is.null,opted_in_at.lt.${fourteenDaysAgo})`)
      eligibleSubscribers = (data ?? []) as Subscriber[]

    } else if (automation.trigger_type === 'birthday') {
      const { data } = await supabase
        .from('marketing_subscribers')
        .select('id, email, restaurant_id, last_order_at, birthday, subscribed, order_count, total_spent')
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
        .select('id, email, restaurant_id, last_order_at, birthday, subscribed, order_count, total_spent')
        .eq('restaurant_id', restaurant.id)
        .eq('subscribed', true)
      eligibleSubscribers = (data ?? []) as Subscriber[]

    } else if (automation.trigger_type === 'scheduled') {
      const config = automation.trigger_config ?? {}
      const targetWeekday = typeof config.weekday === 'number' ? config.weekday : null
      if (targetWeekday !== null && currentWeekday !== targetWeekday) continue
      const { data } = await supabase
        .from('marketing_subscribers')
        .select('id, email, restaurant_id, last_order_at, birthday, subscribed, order_count, total_spent')
        .eq('restaurant_id', restaurant.id)
        .eq('subscribed', true)
      eligibleSubscribers = (data ?? []) as Subscriber[]

    } else {
      continue
    }

    // Segment filter
    const segment = automation.segment ?? 'all'
    if (segment !== 'all') {
      eligibleSubscribers = eligibleSubscribers.filter(sub => {
        const count = sub.order_count ?? 0
        const spent = Number(sub.total_spent ?? 0)
        if (segment === 'new') return count === 0
        if (segment === 'occasional') return count >= 1 && count <= 3
        if (segment === 'loyal') return count >= 4
        if (segment === 'vip') return count >= 10 || spent >= 300
        if (segment === 'lapsed') {
          if (!sub.last_order_at) return false
          return new Date(sub.last_order_at).getTime() < new Date(thirtyDaysAgo).getTime()
        }
        return true
      })
    }

    if (eligibleSubscribers.length === 0) {
      await supabase
        .from('marketing_automations')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', automation.id)
      continue
    }

    // 3. Fetch template if assigned, else build plain HTML
    let templateRow: EmailTemplateRow | null = null
    if (automation.template_id) {
      const { data } = await supabase
        .from('email_templates')
        .select('id, subject_template, body_html, style, uses_style')
        .eq('id', automation.template_id)
        .maybeSingle()
      templateRow = data as EmailTemplateRow | null
    }

    const primaryColor = restaurant.primary_color ?? restaurant.design_config?.primary_color ?? '#f97316'
    const discount = automation.discount_percent ?? 10
    const emailStyle = resolveEmailStyle({
      designPackage: restaurant.design_package,
      emailStyleOverride: restaurant.email_style_override,
      templateStyle: templateRow?.style,
    })

    // For post_order: load recent orders to attach customer_name, items, and rating link
    const orderByEmail = new Map<string, OrderLookup>()
    if (automation.trigger_type === 'post_order') {
      const { data: recentOrders } = await supabase
        .from('orders')
        .select('id, customer_email, customer_name, items, created_at')
        .eq('restaurant_id', restaurant.id)
        .gte('created_at', fourHoursAgo)
        .lte('created_at', twoHoursAgo)
      for (const o of (recentOrders ?? []) as OrderLookup[]) {
        if (o.customer_email) orderByEmail.set(o.customer_email, o)
      }
    }

    // Build subject once per automation
    let subject: string
    if (templateRow?.subject_template) {
      subject = renderEmailTemplate(templateRow.subject_template, {
        restaurant_name: restaurant.name,
        discount_percent: String(discount),
      })
    } else {
      subject = buildSubject(automation, restaurant)
    }

    const unsubSecret = platformSettings.unsubscribe_secret ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'fallback'

    for (const subscriber of eligibleSubscribers) {
      const dedupeRule = `auto_${automation.id}_${subscriber.id}`

      const { data: alreadySent } = await supabase
        .from('reengagement_log')
        .select('id')
        .eq('restaurant_id', restaurant.id)
        .eq('rule', dedupeRule)
        .gte('sent_date', todayStr)
        .maybeSingle()

      if (alreadySent) continue

      const unsubToken = crypto
        .createHmac('sha256', unsubSecret)
        .update(`${restaurant.id}:${subscriber.email}`)
        .digest('hex')
        .slice(0, 32)
      const unsubLink = `${appUrl}/unsubscribe/${unsubToken}?email=${encodeURIComponent(subscriber.email)}&rid=${restaurant.id}`

      const orderUrl = `${appUrl}/bestellen/${restaurant.slug}`

      const ctaTextMap: Record<string, string> = {
        post_order: 'Wieder bestellen',
        inactivity_14d: 'Gutschein einlösen',
        birthday: 'Geburtstagsrabatt einlösen',
        seasonal: 'Jetzt bestellen',
        scheduled: 'Jetzt bestellen',
      }
      const ctaText = ctaTextMap[automation.trigger_type] ?? 'Jetzt bestellen'

      const discountCodeMap: Record<string, string> = {
        post_order: '',
        inactivity_14d: `COMEBACK${discount}`,
        birthday: `BDAY${discount}`,
        seasonal: `SEASON${discount}`,
        scheduled: `SPECIAL${discount}`,
      }
      const discountCode = discountCodeMap[automation.trigger_type] ?? ''

      const triggerLabelMap: Record<string, string> = {
        post_order: 'Danke für deine Bestellung',
        inactivity_14d: 'Wir vermissen dich',
        birthday: 'Happy Birthday',
        seasonal: 'Saisonales Angebot',
        scheduled: '',
        manual: '',
      }

      // Post-Order: look up matching order for items + customer_name + rating link
      const matchedOrder = automation.trigger_type === 'post_order' ? orderByEmail.get(subscriber.email) ?? null : null
      const customerName = matchedOrder?.customer_name?.trim() || subscriber.email.split('@')[0]
      const orderItems = matchedOrder?.items ?? undefined

      // Rating link: only when we have an order to bind the token to
      let ratingBaseUrl: string | undefined
      if (matchedOrder) {
        // We embed s=N in the URL the user clicks; token is per-stars HMAC of `${orderId}:${stars}`
        // So build a partial URL that the email block appends `5` (etc) to via s={n}
        // The block builder uses `${ratingBaseUrl}${n}`; provide a URL ending with `&s=` minus the value
        // We have to encode per-star tokens — easiest: embed 5 distinct URLs server-side and build the block here.
      }

      // Build per-star rating links (token bound per stars value)
      let ratingBlockHtml: string | undefined
      if (matchedOrder) {
        const starLinks = [1, 2, 3, 4, 5].map(n => {
          const t = crypto.createHmac('sha256', unsubSecret).update(`${matchedOrder.id}:${n}`).digest('hex').slice(0, 32)
          return `${appUrl}/api/feedback?o=${matchedOrder.id}&s=${n}&t=${t}`
        })
        const starsHtml = starLinks.map(href => `<a href="${href}" style="display:inline-block;padding:6px 8px;text-decoration:none;font-size:32px;line-height:1;color:#d4d4d8;">&#9733;</a>`).join('')
        ratingBlockHtml = `
  <tr><td style="padding:8px 48px 16px;">
    <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;padding:24px 20px;text-align:center;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:0.12em;">Wie war dein Erlebnis?</p>
      <div style="margin:0 0 8px;">${starsHtml}</div>
      <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">Ein Klick reicht — danach kannst du optional Feedback hinzufügen.</p>
    </div>
  </td></tr>`
      }

      const logoBlockHtml = buildLogoBlock(restaurant.logo_url, restaurant.name)

      // Order items block (HTML, pre-rendered)
      let orderItemsBlockHtml = ''
      if (automation.trigger_type === 'post_order' && orderItems && orderItems.length > 0) {
        const rows = orderItems.slice(0, 3).map(it => `
          <tr><td style="padding:10px 0;border-bottom:1px solid #e4e4e7;">
            <span style="display:inline-block;min-width:30px;color:#71717a;font-weight:600;">${it.qty}×</span>
            <span style="color:#0a0a0a;font-weight:500;">${String(it.name).replace(/</g, '&lt;')}</span>
          </td></tr>`).join('')
        orderItemsBlockHtml = `
  <tr><td style="padding:8px 48px 16px;">
    <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:0.12em;">Deine letzte Bestellung</p>
    <table style="width:100%;border-collapse:collapse;font-size:16px;">${rows}</table>
  </td></tr>`
      }

      // Pre-render discount block
      const discountBlockHtml = discountCode
        ? DISCOUNT_BLOCK(primaryColor)
            .replace('{{discount_code}}', discountCode)
            .replace('{{discount_percent}}', String(discount))
        : ''

      let htmlBody: string

      if (templateRow && templateRow.uses_style === false) {
        // Custom HTML — render with per-subscriber vars only
        htmlBody = renderEmailTemplate(templateRow.body_html, {
          restaurant_name: restaurant.name,
          customer_name: customerName,
          logo_url: restaurant.logo_url ?? '',
          logo_block: logoBlockHtml,
          discount_percent: String(discount),
          discount_code: discountCode,
          discount_block: discountBlockHtml,
          rating_block: ratingBlockHtml ?? '',
          order_items_block: orderItemsBlockHtml,
          cta_url: orderUrl,
          cta_text: ctaText,
          unsubscribe_url: unsubLink,
          primary_color: primaryColor,
        })
      } else if (templateRow) {
        // Style-aware template — re-render with current style + per-subscriber vars
        const styledShell = getBaseTemplateForTrigger(automation.trigger_type, primaryColor, emailStyle)
        htmlBody = renderEmailTemplate(styledShell, {
          restaurant_name: restaurant.name,
          customer_name: customerName,
          logo_url: restaurant.logo_url ?? '',
          logo_block: logoBlockHtml,
          hero_text: subject,
          body_text: renderEmailTemplate(templateRow.body_html, { restaurant_name: restaurant.name, customer_name: customerName }),
          cta_text: ctaText,
          cta_url: orderUrl,
          discount_code: discountCode,
          discount_block: discountBlockHtml,
          discount_percent: String(discount),
          rating_block: ratingBlockHtml ?? '',
          order_items_block: orderItemsBlockHtml,
          unsubscribe_url: unsubLink,
          primary_color: primaryColor,
        })
      } else {
        // No template assigned: use buildEmail() directly with the resolved style
        const ctx: EmailContext = {
          restaurantName: restaurant.name,
          logoUrl: restaurant.logo_url,
          customerName,
          primaryColor,
          triggerLabel: triggerLabelMap[automation.trigger_type] || undefined,
          heroText: subject,
          bodyText: buildPlainBody(automation, restaurant),
          ctaText,
          ctaUrl: orderUrl,
          discountCode: discountCode || undefined,
          discountPercent: discountCode ? discount : undefined,
          orderItems,
          unsubscribeUrl: unsubLink,
          addressLine: restaurant.contact_address,
        }
        // Inject ratingBaseUrl marker (we handle the actual block via custom HTML)
        htmlBody = buildEmail(emailStyle, automation.trigger_type as TriggerType, ctx)
        // Replace the auto rating block (if any) with our token-bound version
        if (ratingBlockHtml) {
          // buildEmail won't include a rating block since we didn't pass ratingBaseUrl.
          // Inject our token-bound block right before the CTA.
          htmlBody = htmlBody.replace(
            /<tr><td style="padding:24px [^"]+;text-align:center;">[\s\S]*?<\/a>\s*<\/td><\/tr>/,
            `${ratingBlockHtml}$&`,
          )
        }
      }

      try {
        await sendEmail({
          restaurantId: restaurant.id,
          fromEmail: process.env.RESEND_FROM ?? 'onboarding@resend.dev',
          fromName: restaurant.name,
          toEmail: subscriber.email,
          toSubscriberId: subscriber.id ?? null,
          replyTo: restaurant.contact_email ?? undefined,
          subject,
          html: htmlBody,
          campaignId: null,
        })

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

  return { processed, sent, errors }
}

// ---------- POST handler (N8N webhook) ----------

export async function POST(request: NextRequest) {
  const platformSettings = await getPlatformSettings()
  const authHeader = request.headers.get('authorization')
  const secret = platformSettings.marketing_automation_secret
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runMarketingAutomations()
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
