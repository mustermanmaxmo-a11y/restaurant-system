import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import type { Restaurant } from '@/types/database'
import CreateRestaurantModal from '@/components/platform/CreateRestaurantModal'
import { RestaurantExport } from '@/components/platform/RestaurantExport'
import { RestaurantTable, type TableRow } from '@/components/platform/RestaurantTable'

export const dynamic = 'force-dynamic'

type DbRow = Pick<Restaurant,
  'id' | 'name' | 'slug' | 'plan' | 'active' | 'trial_ends_at' | 'created_at' | 'owner_id' | 'stripe_customer_id' | 'stripe_subscription_id'
> & { online_payments_enabled: boolean; stripe_connect_account_id: string | null }

export default async function PlatformRestaurants() {
  const { user, role } = await requirePlatformAccess()
  const admin = createSupabaseAdmin()

  let allowedRestaurantIds: string[] | null = null
  if (role === 'support') {
    const { data: member } = await admin
      .from('platform_team')
      .select('id')
      .eq('user_id', user!.id)
      .single()

    if (member) {
      const { data: assignments } = await admin
        .from('platform_team_restaurants')
        .select('restaurant_id')
        .eq('team_member_id', member.id)
      allowedRestaurantIds = (assignments ?? []).map(a => a.restaurant_id)
    } else {
      allowedRestaurantIds = []
    }
  }

  let query = admin
    .from('restaurants')
    .select('id, name, slug, plan, active, trial_ends_at, created_at, owner_id, stripe_customer_id, stripe_subscription_id, online_payments_enabled, stripe_connect_account_id')
    .order('created_at', { ascending: false })

  if (allowedRestaurantIds !== null) {
    query = query.in('id', allowedRestaurantIds.length > 0 ? allowedRestaurantIds : ['00000000-0000-0000-0000-000000000000'])
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [{ data: restaurants }, { data: usersRes }, { data: recentOrderData }] = await Promise.all([
    query,
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('orders')
      .select('restaurant_id, created_at')
      .gte('created_at', thirtyDaysAgo)
      .neq('status', 'cancelled'),
  ])

  const emailByUserId: Record<string, string> = {}
  for (const u of usersRes?.users ?? []) {
    if (u.id) emailByUserId[u.id] = u.email ?? '—'
  }

  const orderCount30: Record<string, number> = {}
  const lastOrderAt: Record<string, number> = {}
  for (const o of recentOrderData ?? []) {
    orderCount30[o.restaurant_id] = (orderCount30[o.restaurant_id] ?? 0) + 1
    const t = new Date(o.created_at).getTime()
    if (!lastOrderAt[o.restaurant_id] || t > lastOrderAt[o.restaurant_id]) {
      lastOrderAt[o.restaurant_id] = t
    }
  }

  function healthScore(id: string): number {
    const cnt = orderCount30[id] ?? 0
    const last = lastOrderAt[id]
    let score = 0
    if (last) {
      const daysAgo = (Date.now() - last) / (24 * 60 * 60 * 1000)
      if (daysAgo <= 1) score += 50
      else if (daysAgo <= 3) score += 40
      else if (daysAgo <= 7) score += 30
      else if (daysAgo <= 14) score += 15
      else score += 5
    }
    score += Math.min(50, Math.round(cnt * 2.5))
    return Math.min(100, score)
  }

  const rows: TableRow[] = (restaurants ?? []).map(r => ({
    ...(r as unknown as DbRow),
    owner_email: emailByUserId[r.owner_id] ?? '—',
    healthScore: healthScore(r.id),
  }))

  const canBulkAction = role === 'owner' || role === 'co_founder' || role === 'developer'

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>Restaurants</h1>
          <p style={{ color: '#888', fontSize: '0.85rem' }}>{rows.length} insgesamt · sortiert nach Anmeldedatum</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <RestaurantExport rows={rows.map(r => ({
            id: r.id, name: r.name, slug: r.slug, plan: r.plan, active: r.active,
            trial_ends_at: r.trial_ends_at, created_at: r.created_at,
            owner_email: r.owner_email, stripe_subscription_id: r.stripe_subscription_id,
          }))} />
          <CreateRestaurantModal role={role} />
        </div>
      </div>

      <RestaurantTable rows={rows} canBulkAction={canBulkAction} />
    </div>
  )
}
