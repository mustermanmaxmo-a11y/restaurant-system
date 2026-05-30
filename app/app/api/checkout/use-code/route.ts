import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const { code, orderId, restaurantId } = await request.json()

  if (!code || !orderId || !restaurantId) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  // Verify the order actually belongs to this restaurant and contains this code
  // (prevents unauthenticated callers from marking arbitrary codes as used)
  const { data: order } = await supabase
    .from('orders')
    .select('id, discount_code')
    .eq('id', orderId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (!order || order.discount_code?.toUpperCase() !== code.toUpperCase().trim()) {
    return NextResponse.json({ marked: false })
  }

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

  return NextResponse.json({ marked: !!data })
}
