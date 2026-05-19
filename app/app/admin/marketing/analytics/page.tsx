import { redirect } from 'next/navigation'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { MarketingAnalytics } from '@/components/marketing/MarketingAnalytics'

export default async function AnalyticsPage() {
  const supabaseSSR = await createSupabaseServerSSR()
  const {
    data: { user },
  } = await supabaseSSR.auth.getUser()

  if (!user) redirect('/login')

  const supabase = createSupabaseAdmin()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!restaurant) {
    return (
      <div style={{ padding: '24px', color: 'var(--text-muted, #6b7280)' }}>
        Restaurant nicht gefunden.
      </div>
    )
  }

  const { data: campaigns } = await supabase
    .from('marketing_campaigns')
    .select(
      'id, subject, status, recipient_count, open_count, click_count, conversion_revenue, sent_at, template_type'
    )
    .eq('restaurant_id', restaurant.id)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(20)

  return (
    <MarketingAnalytics
      campaigns={campaigns ?? []}
      restaurantId={restaurant.id}
    />
  )
}
