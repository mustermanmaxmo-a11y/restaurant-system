import { createSupabaseAdmin } from './supabase-admin'

/**
 * Rich context object passed to the Marketing AI Advisor system prompt.
 * Built server-side via service_role — never expose to the client.
 */
export interface MarketingContext {
  restaurant: {
    id: string
    name: string
    plan: string
    cuisine_type?: string
    design_config?: Record<string, unknown>
  }
  topMenuItems: Array<{ name: string; order_count: number; price: number }>
  subscriberStats: {
    total: number
    loyalty: number
    inactive30d: number
    deliveryOnly: number
  }
  recentCampaigns: Array<{
    subject: string
    sent_at: string
    recipient_count: number
    open_count: number
    click_count: number
    open_rate: number
  }>
  activeAutomations: Array<{ trigger_type: string; active: boolean }>
  restaurantKnowledge: Array<{ fact: string; category: string }>
  platformKnowledge: Array<{ title: string; content: string; category: string }>
  seasonalContext: {
    season: string
    upcomingHolidays: string[]
    currentMonth: number
  }
}

function getSeasonalContext(): MarketingContext['seasonalContext'] {
  const month = new Date().getMonth() + 1 // 1-12

  let season: string
  let upcomingHolidays: string[]

  if (month === 12 || month === 1 || month === 2) {
    season = 'winter'
    if (month === 12) {
      upcomingHolidays = ['Weihnachten', 'Silvester']
    } else if (month === 1) {
      upcomingHolidays = ['Valentinstag']
    } else {
      upcomingHolidays = ['Valentinstag']
    }
  } else if (month >= 3 && month <= 5) {
    season = 'spring'
    upcomingHolidays = ['Ostern', 'Muttertag']
  } else if (month >= 6 && month <= 8) {
    season = 'summer'
    upcomingHolidays = ['Sommerferien', 'Vatertag']
  } else {
    season = 'fall'
    const holidays: string[] = []
    if (month === 9 || month === 10) holidays.push('Oktoberfest')
    if (month === 10) holidays.push('Halloween')
    if (month === 11) holidays.push('Advent')
    upcomingHolidays = holidays
  }

  return { season, upcomingHolidays, currentMonth: month }
}

/**
 * Builds a rich context object for the Marketing AI Advisor.
 * Uses the service role client — call only from server-side API routes.
 */
export async function buildMarketingContext(
  restaurantId: string,
  userMessage: string
): Promise<MarketingContext> {
  const supabase = createSupabaseAdmin()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // ── 1. Restaurant ────────────────────────────────────────────
  const restaurantPromise = Promise.resolve(
    supabase
      .from('restaurants')
      .select('id, name, plan, cuisine_type, design_config')
      .eq('id', restaurantId)
      .single()
      .then(({ data }) => data)
  ).catch(() => null)

  // ── 2. Top menu items (JSONB items array in orders) ──────────
  // orders.items is a JSONB array of objects with at least { name, price, quantity }
  // We aggregate by extracting elements from the JSONB in a raw RPC-friendly way.
  // Supabase JS doesn't support json_array_elements directly — use a targeted approach:
  // fetch recent orders and aggregate client-side (limited to last 30 days, max 200 orders).
  const topMenuItemsPromise = (async () => {
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('items')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', thirtyDaysAgo)
        .not('items', 'eq', '[]')
        .limit(200)

      if (!orders || orders.length === 0) return []

      // Aggregate item counts from JSONB
      const counts: Record<string, { name: string; order_count: number; price: number }> = {}
      for (const order of orders) {
        const items = order.items as Array<{ name?: string; price?: number; quantity?: number }>
        if (!Array.isArray(items)) continue
        for (const item of items) {
          if (!item?.name) continue
          const qty = item.quantity ?? 1
          if (counts[item.name]) {
            counts[item.name].order_count += qty
          } else {
            counts[item.name] = {
              name: item.name,
              order_count: qty,
              price: item.price ?? 0,
            }
          }
        }
      }

      return Object.values(counts)
        .sort((a, b) => b.order_count - a.order_count)
        .slice(0, 5)
    } catch {
      return []
    }
  })()

  // ── 3. Subscriber stats ──────────────────────────────────────
  const subscriberStatsPromise = (async () => {
    try {
      const [totalRes, loyaltyRes, inactiveRes, deliveryRes] = await Promise.all([
        supabase
          .from('marketing_subscribers')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
          .is('unsubscribed_at', null),
        supabase
          .from('loyalty_members')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId),
        supabase
          .from('marketing_subscribers')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
          .is('unsubscribed_at', null)
          .lt('last_order_at', thirtyDaysAgo),
        supabase
          .from('marketing_subscribers')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
          .eq('order_type_preference', 'delivery')
          .is('unsubscribed_at', null),
      ])

      return {
        total: totalRes.count ?? 0,
        loyalty: loyaltyRes.count ?? 0,
        inactive30d: inactiveRes.count ?? 0,
        deliveryOnly: deliveryRes.count ?? 0,
      }
    } catch {
      return { total: 0, loyalty: 0, inactive30d: 0, deliveryOnly: 0 }
    }
  })()

  // ── 4. Recent campaigns ──────────────────────────────────────
  const recentCampaignsPromise = Promise.resolve(
    supabase
      .from('marketing_campaigns')
      .select('subject, sent_at, recipient_count, open_count, click_count')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(5)
      .then(({ data }) =>
        (data ?? []).map((c) => ({
          subject: c.subject ?? '',
          sent_at: c.sent_at ?? '',
          recipient_count: c.recipient_count ?? 0,
          open_count: c.open_count ?? 0,
          click_count: c.click_count ?? 0,
          open_rate:
            c.recipient_count && c.recipient_count > 0
              ? Math.round(((c.open_count ?? 0) / c.recipient_count) * 100) / 100
              : 0,
        }))
      )
  ).catch(() => [])

  // ── 5. Active automations ────────────────────────────────────
  const activeAutomationsPromise = Promise.resolve(
    supabase
      .from('marketing_automations')
      .select('trigger_type, active')
      .eq('restaurant_id', restaurantId)
      .then(({ data }) => data ?? [])
  ).catch(() => [])

  // ── 6. Restaurant knowledge ──────────────────────────────────
  const restaurantKnowledgePromise = Promise.resolve(
    supabase
      .from('restaurant_knowledge')
      .select('fact, category')
      .eq('restaurant_id', restaurantId)
      .limit(10)
      .then(({ data }) => data ?? [])
  ).catch(() => [])

  // ── 7. Platform knowledge (keyword search) ───────────────────
  const platformKnowledgePromise = (async () => {
    let platformKnowledge: MarketingContext['platformKnowledge'] = []
    try {
      const keywords = userMessage
        .split(/\s+/)
        .map(w => w.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, ''))
        .filter(w => w.length > 3)
        .slice(0, 5)

      if (keywords.length > 0) {
        const filterParts = keywords.map(k => `title.ilike.%${k}%,content.ilike.%${k}%`).join(',')
        const { data } = await supabase
          .from('marketing_knowledge')
          .select('title, content, category')
          .or(filterParts)
          .limit(3)

        if (data && data.length > 0) {
          platformKnowledge = data
        } else {
          // keyword search returned nothing — fall back to first 2
          const { data: fallback } = await supabase
            .from('marketing_knowledge')
            .select('title, content, category')
            .limit(2)
          platformKnowledge = fallback ?? []
        }
      } else {
        const { data: fallback } = await supabase
          .from('marketing_knowledge')
          .select('title, content, category')
          .limit(2)
        platformKnowledge = fallback ?? []
      }
    } catch {
      platformKnowledge = []
    }
    return platformKnowledge
  })()

  // ── 8. Seasonal context (no DB query) ───────────────────────
  const seasonalContext = getSeasonalContext()

  // Run all DB queries in parallel
  const [
    restaurantData,
    topMenuItems,
    subscriberStats,
    recentCampaigns,
    activeAutomations,
    restaurantKnowledge,
    platformKnowledge,
  ] = await Promise.all([
    restaurantPromise,
    topMenuItemsPromise,
    subscriberStatsPromise,
    recentCampaignsPromise,
    activeAutomationsPromise,
    restaurantKnowledgePromise,
    platformKnowledgePromise,
  ])

  return {
    restaurant: restaurantData
      ? {
          id: restaurantData.id,
          name: restaurantData.name,
          plan: restaurantData.plan,
          cuisine_type: restaurantData.cuisine_type ?? undefined,
          design_config: restaurantData.design_config ?? undefined,
        }
      : { id: restaurantId, name: 'Restaurant', plan: 'basic' },
    topMenuItems,
    subscriberStats,
    recentCampaigns,
    activeAutomations,
    restaurantKnowledge,
    platformKnowledge,
    seasonalContext,
  }
}
