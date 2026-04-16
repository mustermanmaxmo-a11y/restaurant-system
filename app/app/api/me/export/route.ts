import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch all data belonging to this user
  const [restaurantRes] = await Promise.all([
    adminClient.from('restaurants').select('*').eq('owner_id', user.id),
  ])

  const restaurant = restaurantRes.data?.[0] ?? null
  const restaurantId = restaurant?.id

  const [ordersRes, staffRes, reservationsRes] = restaurantId
    ? await Promise.all([
        adminClient.from('orders').select('id, status, order_type, total, created_at, customer_name, customer_phone').eq('restaurant_id', restaurantId),
        adminClient.from('staff').select('id, name, role, active, created_at').eq('restaurant_id', restaurantId),
        adminClient.from('reservations').select('id, customer_name, customer_phone, customer_email, date, time_from, guests, status, created_at').eq('restaurant_id', restaurantId),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  const exportData = {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
    },
    restaurant: restaurant ? {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      plan: restaurant.plan,
      createdAt: restaurant.created_at,
    } : null,
    orders: ordersRes.data ?? [],
    staff: staffRes.data ?? [],
    reservations: reservationsRes.data ?? [],
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="restaurantos-daten-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
