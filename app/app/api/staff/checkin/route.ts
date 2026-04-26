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

  const { data: staff } = await admin
    .from('staff')
    .select('id, role, active')
    .eq('id', staffId)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!staff?.active) {
    return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
  }

  await admin
    .from('staff_presence')
    .update({ checked_out_at: new Date().toISOString() })
    .eq('staff_id', staffId)
    .is('checked_out_at', null)

  const { error } = await admin.from('staff_presence').insert({
    restaurant_id: restaurantId,
    staff_id: staffId,
    role: staff.role,
    checked_in_at: new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: 'Check-in fehlgeschlagen' }, { status: 500 })
  return NextResponse.json({ success: true })
}
