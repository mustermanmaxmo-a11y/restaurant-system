import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isRestaurantActive } from '@/lib/plan-limits'
import type { RestaurantPlan } from '@/types/database'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, slug, plan, trial_ends_at, active, logo_url')
    .eq('slug', slug)
    .limit(1)
    .single()

  if (!restaurant) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const active = isRestaurantActive(
    restaurant.plan as RestaurantPlan,
    restaurant.trial_ends_at
  )

  if (!active) {
    return NextResponse.json(
      { error: 'Restaurant ist aktuell offline' },
      { status: 403 }
    )
  }

  return NextResponse.json(restaurant)
}
