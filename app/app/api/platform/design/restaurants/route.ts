import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest) {
  const { role } = await requirePlatformAccess()
  if (role !== 'owner' && role !== 'co_founder') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as {
    restaurant_id?: string
    version?: string | null
  } | null

  if (!body || !body.restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 })
  }
  if (body.version !== null && body.version !== 'v1' && body.version !== 'v2') {
    return NextResponse.json({ error: 'invalid version' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('restaurants')
    .update({
      admin_design_version: body.version,
      guest_design_version: body.version,
    })
    .eq('id', body.restaurant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
