import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { MarketingAdvisor } from '@/components/marketing/MarketingAdvisor'

export default async function AdvisorPage() {
  const supabaseSSR = await createSupabaseServerSSR()
  const {
    data: { user },
  } = await supabaseSSR.auth.getUser()

  if (!user) {
    return (
      <div style={{ padding: '24px', color: 'var(--text-muted, #6b7280)' }}>
        Nicht eingeloggt
      </div>
    )
  }

  const supabase = createSupabaseAdmin()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, plan')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!restaurant) {
    return (
      <div style={{ padding: '24px', color: 'var(--text-muted, #6b7280)' }}>
        Restaurant nicht gefunden
      </div>
    )
  }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString()

  const [campaignsResult, automationsResult] = await Promise.all([
    supabase
      .from('marketing_campaigns')
      .select('id, open_rate, conversion_revenue')
      .eq('restaurant_id', restaurant.id)
      .gte('created_at', thirtyDaysAgoISO),
    supabase
      .from('marketing_automations')
      .select('id')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true),
  ])

  const campaigns = campaignsResult.data ?? []
  const automations = automationsResult.data ?? []

  const campaignCount = campaigns.length

  const openRates = campaigns
    .map(c => c.open_rate)
    .filter((r): r is number => typeof r === 'number')
  const avgOpenRate =
    openRates.length > 0
      ? Math.round(openRates.reduce((a, b) => a + b, 0) / openRates.length)
      : 0

  const conversionRevenue = campaigns.reduce(
    (sum, c) => sum + (typeof c.conversion_revenue === 'number' ? c.conversion_revenue : 0),
    0
  )

  const activeAutomations = automations.length

  const initialStats = {
    campaignCount,
    avgOpenRate,
    conversionRevenue,
    activeAutomations,
  }

  return (
    <MarketingAdvisor
      restaurantId={restaurant.id}
      initialStats={initialStats}
    />
  )
}
