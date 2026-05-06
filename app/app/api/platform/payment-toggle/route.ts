import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'

export async function POST(request: NextRequest) {
  try {
    await requirePlatformAccess()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { restaurantId, enabled } = await request.json()
  if (!restaurantId || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()

  // Only allow enabling if stripe_connect_account_id is set
  if (enabled) {
    const { data: resto } = await admin
      .from('restaurants')
      .select('stripe_connect_account_id')
      .eq('id', restaurantId)
      .single()

    if (!resto?.stripe_connect_account_id) {
      return NextResponse.json({ error: 'Stripe not connected' }, { status: 400 })
    }
  }

  const { error } = await admin
    .from('restaurants')
    .update({ online_payments_enabled: enabled })
    .eq('id', restaurantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
