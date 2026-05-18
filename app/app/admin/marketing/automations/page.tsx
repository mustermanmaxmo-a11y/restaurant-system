import { redirect } from 'next/navigation'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { AutomationRules } from '@/components/marketing/AutomationRules'

export default async function AutomationsPage() {
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

  const { data: automations } = await supabase
    .from('marketing_automations')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('created_at', { ascending: true })

  return (
    <AutomationRules
      automations={automations ?? []}
      restaurantId={restaurant.id}
    />
  )
}
