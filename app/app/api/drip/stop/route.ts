import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const { subscriberId, reason } = await request.json()

  if (!subscriberId || !reason) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 })
  }

  const validReasons = ['ordered', 'code_redeemed', 'unsubscribed', 'manual']
  if (!validReasons.includes(reason)) {
    return NextResponse.json({ error: 'invalid_reason' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { error } = await supabase
    .from('drip_enrollments')
    .update({ completed_at: new Date().toISOString(), stop_reason: reason })
    .eq('subscriber_id', subscriberId)
    .is('completed_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ stopped: true })
}
