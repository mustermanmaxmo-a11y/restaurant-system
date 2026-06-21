import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { CompareClient } from './CompareClient'

export const dynamic = 'force-dynamic'

export default async function ComparePage() {
  await requirePlatformAccess()
  const admin = createSupabaseAdmin()

  const now = Date.now()
  const d90 = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: restaurants }, { data: allOrders }] = await Promise.all([
    admin.from('restaurants')
      .select('id, name, slug, plan, active, created_at, trial_ends_at')
      .order('name'),
    admin.from('orders')
      .select('restaurant_id, total, created_at, status')
      .gte('created_at', d90)
      .neq('status', 'cancelled'),
  ])

  const rests = restaurants ?? []
  const orders = allOrders ?? []

  // Pre-compute all metrics per restaurant
  type RestMetrics = {
    id: string; name: string; slug: string; plan: string; active: boolean; created_at: string
    gmv7: number; gmv30: number; gmv90: number
    orders7: number; orders30: number; orders90: number
    avgOrder: number; cancelledCount: number
    peakHour: number; weeklyTrend: number[] // last 12 weeks
    servedCount: number; cancelRate: number
  }

  const metrics: RestMetrics[] = rests.map(r => {
    const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
    const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
    const ro = orders.filter(o => o.restaurant_id === r.id)
    const ro7 = ro.filter(o => o.created_at >= d7)
    const ro30 = ro.filter(o => o.created_at >= d30)

    const served = ro30.filter(o => o.status === 'served')
    const cancelled = orders.filter(o => o.restaurant_id === r.id && o.status === 'cancelled' && o.created_at >= d30)

    const gmv7 = ro7.reduce((s, o) => s + (o.total ?? 0), 0)
    const gmv30 = ro30.reduce((s, o) => s + (o.total ?? 0), 0)
    const gmv90 = ro.reduce((s, o) => s + (o.total ?? 0), 0)

    // Peak hour
    const hourCounts = Array(24).fill(0)
    for (const o of ro) hourCounts[new Date(o.created_at).getHours()]++
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts))

    // Weekly GMV last 12 weeks
    const weeklyTrend = Array.from({ length: 12 }, (_, i) => {
      const ws = new Date(now - (11 - i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString()
      const we = new Date(now - (11 - i) * 7 * 24 * 60 * 60 * 1000).toISOString()
      return ro.filter(o => o.created_at >= ws && o.created_at < we).reduce((s, o) => s + (o.total ?? 0), 0)
    })

    const totalWithStatus = ro30.length + cancelled.length
    return {
      id: r.id, name: r.name, slug: r.slug, plan: r.plan, active: r.active, created_at: r.created_at,
      gmv7, gmv30, gmv90,
      orders7: ro7.length, orders30: ro30.length, orders90: ro.length,
      avgOrder: served.length > 0 ? served.reduce((s, o) => s + (o.total ?? 0), 0) / served.length : 0,
      cancelledCount: cancelled.length,
      cancelRate: totalWithStatus > 0 ? (cancelled.length / totalWithStatus) * 100 : 0,
      peakHour, weeklyTrend,
      servedCount: served.length,
    }
  })

  return (
    <div style={{ padding: '32px 28px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ color: 'rgba(96,165,250,0.7)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Analytics</div>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.03em', marginBottom: '6px' }}>Restaurant Vergleich</h1>
        <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.85rem' }}>Bis zu 4 Restaurants nebeneinander vergleichen · GMV, Orders, Wachstum, Ø-Wert</p>
      </div>
      <CompareClient restaurants={metrics} />
    </div>
  )
}
