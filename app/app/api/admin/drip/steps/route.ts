import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

async function getRestaurantId(request: NextRequest): Promise<string | null> {
  const token = request.headers.get('authorization')?.slice(7)
  if (!token) return null
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await client.auth.getUser(token)
  if (!user) return null
  const admin = createSupabaseAdmin()
  const { data } = await admin.from('restaurants').select('id').eq('owner_id', user.id).maybeSingle()
  return data?.id ?? null
}

export async function POST(request: NextRequest) {
  const restaurantId = await getRestaurantId(request)
  if (!restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sequence_id, position, delay_days, subject, headline, body_text, discount_type, discount_value, expires_days } = await request.json()

  const supabase = createSupabaseAdmin()
  const { data: seq } = await supabase.from('drip_sequences').select('id').eq('id', sequence_id).eq('restaurant_id', restaurantId).maybeSingle()
  if (!seq) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('drip_steps')
    .insert({ sequence_id, position, delay_days: delay_days ?? 7, subject, headline, body_text, discount_type: discount_type ?? null, discount_value: discount_value ?? null, expires_days: expires_days ?? 7 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const restaurantId = await getRestaurantId(request)
  if (!restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await request.json()
  const supabase = createSupabaseAdmin()

  const { data: step } = await supabase
    .from('drip_steps')
    .select('id, drip_sequences!inner(restaurant_id)')
    .eq('id', id)
    .maybeSingle()

  const seq = step?.drip_sequences as { restaurant_id: string } | null
  if (!step || seq?.restaurant_id !== restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.from('drip_steps').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const restaurantId = await getRestaurantId(request)
  if (!restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  const supabase = createSupabaseAdmin()

  const { data: step } = await supabase
    .from('drip_steps')
    .select('id, drip_sequences!inner(restaurant_id)')
    .eq('id', id)
    .maybeSingle()

  const seq = step?.drip_sequences as { restaurant_id: string } | null
  if (!step || seq?.restaurant_id !== restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('drip_steps').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
