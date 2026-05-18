import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const VALID_TRIGGER_TYPES = [
  'post_order',
  'inactivity_14d',
  'birthday',
  'seasonal',
  'scheduled',
] as const

async function getRestaurant() {
  const supabaseSSR = await createSupabaseServerSSR()
  const { data: { user } } = await supabaseSSR.auth.getUser()
  if (!user) return { user: null, restaurant: null, error: 'unauthenticated' as const }

  const supabase = createSupabaseAdmin()
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, plan')
    .eq('owner_id', user.id)
    .single()

  if (!restaurant) return { user, restaurant: null, error: 'not_found' as const }
  return { user, restaurant, error: null }
}

export async function GET() {
  const { restaurant, error } = await getRestaurant()
  if (error === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (error === 'not_found' || !restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 403 })

  const supabase = createSupabaseAdmin()
  const { data: automations, error: dbError } = await supabase
    .from('marketing_automations')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('created_at', { ascending: true })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ automations: automations ?? [] })
}

export async function POST(request: NextRequest) {
  const { restaurant, error } = await getRestaurant()
  if (error === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (error === 'not_found' || !restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const {
    trigger_type,
    trigger_config,
    template_type,
    subject_template,
    body_template,
    discount_code_prefix,
    discount_percent,
    active,
  } = body

  if (!trigger_type || !VALID_TRIGGER_TYPES.includes(trigger_type)) {
    return NextResponse.json(
      { error: `trigger_type must be one of: ${VALID_TRIGGER_TYPES.join(' | ')}` },
      { status: 400 }
    )
  }

  const supabase = createSupabaseAdmin()
  const { data: automation, error: dbError } = await supabase
    .from('marketing_automations')
    .upsert(
      {
        restaurant_id: restaurant.id,
        trigger_type,
        trigger_config: trigger_config ?? null,
        template_type: template_type ?? null,
        subject_template: subject_template ?? null,
        body_template: body_template ?? null,
        discount_code_prefix: discount_code_prefix ?? null,
        discount_percent: discount_percent ?? null,
        active: active ?? true,
      },
      { onConflict: 'restaurant_id,trigger_type' }
    )
    .select('*')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ automation })
}

export async function PATCH(request: NextRequest) {
  const { restaurant, error } = await getRestaurant()
  if (error === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (error === 'not_found' || !restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { id, active } = body

  if (!id || typeof active !== 'boolean') {
    return NextResponse.json({ error: 'id and active (boolean) required' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { error: dbError } = await supabase
    .from('marketing_automations')
    .update({ active })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const { restaurant, error } = await getRestaurant()
  if (error === 'unauthenticated') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (error === 'not_found' || !restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id query param required' }, { status: 400 })

  const supabase = createSupabaseAdmin()
  const { error: dbError } = await supabase
    .from('marketing_automations')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
