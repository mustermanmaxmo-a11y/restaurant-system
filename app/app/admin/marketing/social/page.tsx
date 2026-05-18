import { redirect } from 'next/navigation'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import SocialMediaHub from '@/components/marketing/SocialMediaHub'

export default async function SocialPage() {
  const supabaseSSR = await createSupabaseServerSSR()
  const {
    data: { user },
  } = await supabaseSSR.auth.getUser()

  if (!user) redirect('/login')

  const supabase = createSupabaseAdmin()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, plan')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!restaurant) {
    return (
      <div style={{ padding: '24px', color: 'var(--text-muted, #6b7280)' }}>
        Restaurant nicht gefunden.
      </div>
    )
  }

  return (
    <SocialMediaHub
      restaurantId={restaurant.id}
      plan={restaurant.plan ?? 'starter'}
    />
  )
}
