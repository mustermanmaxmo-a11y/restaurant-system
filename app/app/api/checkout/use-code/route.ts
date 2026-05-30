import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const { code, orderId, restaurantId } = await request.json()

  if (!code || !orderId || !restaurantId) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase
    .from('discount_codes')
    .update({ used_at: new Date().toISOString(), used_order_id: orderId })
    .eq('code', code.toUpperCase().trim())
    .eq('restaurant_id', restaurantId)
    .is('used_at', null)
    .gte('expires_at', new Date().toISOString())
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ marked: false })
  }

  return NextResponse.json({ marked: true })
}
