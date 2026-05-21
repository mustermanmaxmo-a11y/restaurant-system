import { redirect } from 'next/navigation'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { SubscriberList } from '@/components/marketing/SubscriberList'

export default async function SubscribersPage() {
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

  const { data: subscribers, count } = await supabase
    .from('marketing_subscribers')
    .select(
      'id, email, name, opted_in_at, last_order_at, order_type_preference, source, order_count, total_spent',
      { count: 'exact' }
    )
    .eq('restaurant_id', restaurant.id)
    .is('unsubscribed_at', null)
    .order('opted_in_at', { ascending: false })
    .limit(100)

  const { count: loyaltyCount } = await supabase
    .from('loyalty_members')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurant.id)

  return (
    <SubscriberList
      subscribers={subscribers ?? []}
      totalCount={count ?? 0}
      loyaltyCount={loyaltyCount ?? 0}
      restaurantId={restaurant.id}
    />
  )
}
