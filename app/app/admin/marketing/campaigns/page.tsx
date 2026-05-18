import { redirect } from 'next/navigation'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { CampaignBuilder } from '@/components/marketing/CampaignBuilder'

export default async function CampaignsPage() {
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
      'id, subject, status, recipient_count, open_count, click_count, conversion_revenue, created_at, sent_at, scheduled_at, generated_by_ai, template_type'
    )
    .eq('restaurant_id', restaurant.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <CampaignBuilder
      campaigns={campaigns ?? []}
      restaurantId={restaurant.id}
    />
  )
}
