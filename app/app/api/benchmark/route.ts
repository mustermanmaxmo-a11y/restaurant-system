import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const restaurantId = searchParams.get('restaurantId')
  if (!restaurantId) return NextResponse.json({ error: 'restaurantId required' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, restaurant_category, seating_capacity, benchmark_opt_in')
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .single()

  if (!restaurant) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  if (!restaurant.benchmark_opt_in) return NextResponse.json({ opted_out: true })

  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString().split('T')[0]

  // Own snapshots this week
  const { data: ownSnapshots } = await supabase
    .from('benchmark_snapshots')
    .select('daily_revenue, order_count, avg_order_value')
    .eq('restaurant_id', restaurantId)
    .gte('snapshot_date', weekAgo)
    .lte('snapshot_date', today)

  const ownAvgRevenue = ownSnapshots?.length
    ? ownSnapshots.reduce((s, r) => s + (r.daily_revenue ?? 0), 0) / ownSnapshots.length
    : null

  const ownAvgOrders = ownSnapshots?.length
    ? ownSnapshots.reduce((s, r) => s + (r.order_count ?? 0), 0) / ownSnapshots.length
    : null

  const ownAvgOrderValue = ownSnapshots?.length
    ? ownSnapshots.reduce((s, r) => s + (r.avg_order_value ?? 0), 0) / ownSnapshots.filter(r => r.avg_order_value).length
    : null

  // Peer snapshots (same category, opt-in, exclude own)
  const peerQuery = supabase
    .from('benchmark_snapshots')
    .select('restaurant_id, daily_revenue, order_count, avg_order_value')
    .neq('restaurant_id', restaurantId)
    .gte('snapshot_date', weekAgo)
    .lte('snapshot_date', today)

  const { data: peerSnapshotRaw } = await peerQuery

  // Only include restaurants that have opted in (filter via join via restaurants table)
  const { data: optedInRestaurants } = await supabase
    .from('restaurants')
    .select('id')
    .eq('benchmark_opt_in', true)
    .neq('id', restaurantId)

  const optedInIds = new Set((optedInRestaurants ?? []).map(r => r.id))
  const peerSnapshots = (peerSnapshotRaw ?? []).filter(s => optedInIds.has(s.restaurant_id))

  // Need at least 5 distinct restaurants in pool for privacy
  const distinctPeers = new Set(peerSnapshots.map(s => s.restaurant_id))
  if (distinctPeers.size < 5) {
    return NextResponse.json({
      own: { avgRevenue: ownAvgRevenue, avgOrders: ownAvgOrders, avgOrderValue: ownAvgOrderValue },
      peer: null,
      insufficient_pool: true,
    })
  }

  const peerAvgRevenue = peerSnapshots.length
    ? peerSnapshots.reduce((s, r) => s + (r.daily_revenue ?? 0), 0) / peerSnapshots.length
    : null

  const peerAvgOrders = peerSnapshots.length
    ? peerSnapshots.reduce((s, r) => s + (r.order_count ?? 0), 0) / peerSnapshots.length
    : null

  const peerAvgOrderValue = peerSnapshots.length
    ? peerSnapshots.reduce((s, r) => s + (r.avg_order_value ?? 0), 0) / peerSnapshots.filter(r => r.avg_order_value).length
    : null

  return NextResponse.json({
    own: { avgRevenue: ownAvgRevenue, avgOrders: ownAvgOrders, avgOrderValue: ownAvgOrderValue },
    peer: { avgRevenue: peerAvgRevenue, avgOrders: peerAvgOrders, avgOrderValue: peerAvgOrderValue, poolSize: distinctPeers.size },
    insufficient_pool: false,
  })
}

// Called by n8n daily to snapshot today's metrics for each opted-in restaurant
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.N8N_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: restaurants } = await adminClient
    .from('restaurants')
    .select('id')
    .eq('benchmark_opt_in', true)
    .eq('active', true)

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  const snapshots = []
  for (const resto of restaurants ?? []) {
    const { data: orders } = await adminClient
      .from('orders')
      .select('total')
      .eq('restaurant_id', resto.id)
      .neq('status', 'cancelled')
      .gte('created_at', yesterday + 'T00:00:00')
      .lt('created_at', today + 'T00:00:00')

    if (!orders || orders.length === 0) continue
    const dailyRevenue = orders.reduce((s, o) => s + (o.total ?? 0), 0)
    const avgOrderValue = dailyRevenue / orders.length
    snapshots.push({
      restaurant_id: resto.id,
      snapshot_date: yesterday,
      daily_revenue: dailyRevenue,
      order_count: orders.length,
      avg_order_value: avgOrderValue,
    })
  }

  if (snapshots.length > 0) {
    await adminClient.from('benchmark_snapshots').upsert(snapshots, { onConflict: 'restaurant_id,snapshot_date' })
  }

  return NextResponse.json({ ok: true, snapshotted: snapshots.length })
}
