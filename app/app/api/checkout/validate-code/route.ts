import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const { code, restaurantId } = await request.json()

  if (!code || !restaurantId) {
    return NextResponse.json({ valid: false, error: 'missing_params' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('discount_codes')
    .select('id, discount_type, discount_value, expires_at, used_at, restaurant_id')
    .eq('code', code.toUpperCase().trim())
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ valid: false, error: 'not_found' })
  }
  if (data.restaurant_id !== restaurantId) {
    return NextResponse.json({ valid: false, error: 'wrong_restaurant' })
  }
  if (data.used_at) {
    return NextResponse.json({ valid: false, error: 'already_used' })
  }
  if (new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, error: 'expired' })
  }

  return NextResponse.json({
    valid: true,
    discountType: data.discount_type,
    discountValue: data.discount_value,
    expiresAt: data.expires_at,
  })
}
