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

export async function GET(request: NextRequest) {
  const restaurantId = await getRestaurantId(request)
  if (!restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('drip_sequences')
    .select('*, drip_steps(*)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const restaurantId = await getRestaurantId(request)
  if (!restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, trigger_days, enabled, steps } = await request.json()
  const supabase = createSupabaseAdmin()

  const { data: seq, error: seqErr } = await supabase
    .from('drip_sequences')
    .insert({ restaurant_id: restaurantId, name: name ?? 'Win-Back Drip', trigger_days: trigger_days ?? 14, enabled: enabled ?? true })
    .select()
    .single()

  if (seqErr || !seq) return NextResponse.json({ error: seqErr?.message }, { status: 500 })

  if (Array.isArray(steps) && steps.length > 0) {
    const stepsToInsert = steps.map((s: Record<string, unknown>, i: number) => ({
      sequence_id: seq.id,
      position: i + 1,
      delay_days: s.delay_days ?? 7,
      subject: s.subject,
      headline: s.headline,
      body_text: s.body_text,
      discount_type: s.discount_type ?? null,
      discount_value: s.discount_value ?? null,
      expires_days: s.expires_days ?? 7,
    }))
    await supabase.from('drip_steps').insert(stepsToInsert)
  }

  const { data: full } = await supabase
    .from('drip_sequences')
    .select('*, drip_steps(*)')
    .eq('id', seq.id)
    .single()

  return NextResponse.json(full, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const restaurantId = await getRestaurantId(request)
  if (!restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, name, trigger_days, enabled } = await request.json()
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('drip_sequences')
    .update({ name, trigger_days, enabled })
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const restaurantId = await getRestaurantId(request)
  if (!restaurantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  const supabase = createSupabaseAdmin()
  const { error } = await supabase
    .from('drip_sequences')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
