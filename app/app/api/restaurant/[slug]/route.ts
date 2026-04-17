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

  const { data: restaurant, error: dbError } = await supabase
    .from('restaurants')
    .select('id, name, slug, plan, trial_ends_at, active, currency, default_language, theme_color, logo_url')
    .eq('slug', slug)
    .limit(1)
    .single()

  if (!restaurant) {
    console.error('[restaurant-api] slug:', slug, 'db error:', dbError)
    return NextResponse.json({
      error: 'Not found',
      slug,
      debug: dbError ? JSON.stringify(dbError) : 'query ok but no rows',
      url: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30),
    }, { status: 404 })
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
