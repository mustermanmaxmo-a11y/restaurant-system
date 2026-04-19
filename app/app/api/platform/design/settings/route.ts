import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const VALID = new Set(['v1', 'v2'])

export async function PATCH(req: NextRequest) {
  const { role } = await requirePlatformAccess()
  if (role !== 'owner' && role !== 'co_founder') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as {
    platform_design_version?: string
    restaurants_default_version?: string
  } | null

  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const patch: Record<string, string> = {}
  if (body.platform_design_version) {
    if (!VALID.has(body.platform_design_version)) {
      return NextResponse.json({ error: 'invalid platform_design_version' }, { status: 400 })
    }
    patch.platform_design_version = body.platform_design_version
  }
  if (body.restaurants_default_version) {
    if (!VALID.has(body.restaurants_default_version)) {
      return NextResponse.json({ error: 'invalid restaurants_default_version' }, { status: 400 })
    }
    patch.restaurants_default_version = body.restaurants_default_version
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  patch.updated_at = new Date().toISOString()

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('platform_settings')
    .update(patch)
    .eq('id', 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
