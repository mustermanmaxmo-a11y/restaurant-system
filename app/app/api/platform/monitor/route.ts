import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

export async function GET() {
  try {
    await requirePlatformAccess()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createSupabaseAdmin()
  const now = Date.now()
  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
  const oneHourAgo = new Date(now - HOUR).toISOString()
  const sevenDaysAgo = new Date(now - 7 * DAY).toISOString()

  const [
    { data: restaurants },
    { data: todayOrders },
    { data: recentOrders },
    { data: liveOrders },
  ] = await Promise.all([
    admin.from('restaurants').select('id, name, slug, plan, active').eq('active', true),
    admin.from('orders').select('restaurant_id, total, status')
      .gte('created_at', startOfDay)
      .neq('status', 'cancelled'),
    admin.from('orders').select('id, restaurant_id, total, status, created_at, table_id')
      .gte('created_at', sevenDaysAgo)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(150),
    admin.from('orders').select('restaurant_id')
      .gte('created_at', oneHourAgo)
      .neq('status', 'cancelled'),
  ])

  const nameById: Record<string, string> = {}
  const slugById: Record<string, string> = {}
  for (const r of restaurants ?? []) { nameById[r.id] = r.name; slugById[r.id] = r.slug }

  const todayTotal = (todayOrders ?? []).reduce((s, o) => s + (Number(o.total) || 0), 0)
  const todayCount = todayOrders?.length ?? 0
  const ordersThisHour = liveOrders?.length ?? 0

  const activeNow = new Set((liveOrders ?? []).map(o => o.restaurant_id))

  const statusCounts: Record<string, number> = {}
  for (const o of todayOrders ?? []) { statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1 }

  const restaurantTodayCount: Record<string, number> = {}
  const restaurantTodayRev: Record<string, number> = {}
  for (const o of todayOrders ?? []) {
    restaurantTodayCount[o.restaurant_id] = (restaurantTodayCount[o.restaurant_id] ?? 0) + 1
    restaurantTodayRev[o.restaurant_id] = (restaurantTodayRev[o.restaurant_id] ?? 0) + (Number(o.total) || 0)
  }

  const activeRestaurants = [...activeNow].map(id => ({
    id, name: nameById[id] ?? id.slice(0, 8),
    ordersToday: restaurantTodayCount[id] ?? 0,
    revenueToday: restaurantTodayRev[id] ?? 0,
  })).sort((a, b) => b.ordersToday - a.ordersToday)

  const feed = (recentOrders ?? []).map(o => ({
    id: o.id,
    restaurantId: o.restaurant_id,
    restaurantName: nameById[o.restaurant_id] ?? '—',
    total: Number(o.total) || 0,
    status: o.status,
    createdAt: o.created_at,
    tableId: o.table_id,
  }))

  return NextResponse.json({
    stats: {
      todayCount,
      todayTotal,
      ordersThisHour,
      activeRestaurantCount: activeNow.size,
      statusCounts,
    },
    activeRestaurants,
    feed,
    generatedAt: new Date().toISOString(),
  })
}
