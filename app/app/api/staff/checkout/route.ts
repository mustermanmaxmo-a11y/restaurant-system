import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { staffId, restaurantId } = body as { staffId: string; restaurantId: string }

  if (!staffId || !restaurantId) {
    return NextResponse.json({ error: 'staffId and restaurantId required' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin
    .from('staff_presence')
    .update({ checked_out_at: new Date().toISOString() })
    .eq('staff_id', staffId)
    .eq('restaurant_id', restaurantId)
    .is('checked_out_at', null)

  if (error) return NextResponse.json({ error: 'Check-out fehlgeschlagen' }, { status: 500 })
  return NextResponse.json({ success: true })
}
