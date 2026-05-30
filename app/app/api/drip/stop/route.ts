import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const { subscriberId, orderId, reason } = await request.json()

  if (!subscriberId || !orderId || !reason) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 })
  }

  const validReasons = ['ordered', 'code_redeemed', 'unsubscribed', 'manual']
  if (!validReasons.includes(reason)) {
    return NextResponse.json({ error: 'invalid_reason' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()

  // Verify the order belongs to this subscriber (prevents IDOR)
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .eq('customer_id', subscriberId)
    .maybeSingle()

  if (!order) return NextResponse.json({ stopped: false })

  const { error } = await supabase
    .from('drip_enrollments')
    .update({ completed_at: new Date().toISOString(), stop_reason: reason })
    .eq('subscriber_id', subscriberId)
    .is('completed_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ stopped: true })
}
