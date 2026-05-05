import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(request: NextRequest) {
  const { orderId, persons } = await request.json()
  if (!orderId || !persons) return NextResponse.json({ error: 'orderId and persons required' }, { status: 400 })

  const { data, error } = await supabase
    .from('bill_splits')
    .insert({ order_id: orderId, persons, item_assignments: {} })
    .select('share_token')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ token: data.share_token })
}

export async function PATCH(request: NextRequest) {
  const { token, item_assignments } = await request.json()
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const { error } = await supabase
    .from('bill_splits')
    .update({ item_assignments })
    .eq('share_token', token)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
