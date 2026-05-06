import { NextResponse } from 'next/server'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET — list manually granted templates for a restaurant
// GET /api/platform/template-access?restaurant_id=uuid
export async function GET(req: Request) {
  try {
    await requirePlatformAccess()
  } catch {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const restaurant_id = searchParams.get('restaurant_id') ?? ''

  if (!UUID_RE.test(restaurant_id)) {
    return NextResponse.json({ error: 'restaurant_id must be a valid UUID' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { data, error: dbErr } = await admin
    .from('template_access')
    .select(`
      granted_by,
      created_at,
      design_templates (
        id,
        name,
        slug,
        category,
        plan_tier
      )
    `)
    .eq('restaurant_id', restaurant_id)
    .eq('granted_by', 'manual')

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const templates = (data ?? []).map((row: {
    granted_by: string
    created_at: string
    design_templates: {
      id: string
      name: string
      slug: string
      category: string
      plan_tier: string
    } | null
  }) => ({
    id: row.design_templates?.id,
    name: row.design_templates?.name,
    slug: row.design_templates?.slug,
    category: row.design_templates?.category,
    plan_tier: row.design_templates?.plan_tier,
    granted_by: row.granted_by,
    created_at: row.created_at,
  }))

  return NextResponse.json({ templates })
}

// POST — grant a template to a restaurant
// Body: { restaurant_id: string, template_id: string }
export async function POST(req: Request) {
  let role: string
  try {
    const session = await requirePlatformAccess()
    role = session.role
  } catch {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  if (!['owner', 'co_founder'].includes(role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { restaurant_id, template_id } = body

  if (!UUID_RE.test(restaurant_id ?? '')) {
    return NextResponse.json({ error: 'restaurant_id must be a valid UUID' }, { status: 400 })
  }
  if (!UUID_RE.test(template_id ?? '')) {
    return NextResponse.json({ error: 'template_id must be a valid UUID' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { error: upsertErr } = await admin
    .from('template_access')
    .upsert(
      { restaurant_id, template_id, granted_by: 'manual' },
      { onConflict: 'restaurant_id,template_id' }
    )

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

// DELETE — revoke a manual grant
// Body: { restaurant_id: string, template_id: string }
export async function DELETE(req: Request) {
  let role: string
  try {
    const session = await requirePlatformAccess()
    role = session.role
  } catch {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  if (!['owner', 'co_founder'].includes(role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { restaurant_id, template_id } = body

  if (!UUID_RE.test(restaurant_id ?? '')) {
    return NextResponse.json({ error: 'restaurant_id must be a valid UUID' }, { status: 400 })
  }
  if (!UUID_RE.test(template_id ?? '')) {
    return NextResponse.json({ error: 'template_id must be a valid UUID' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { error: delErr } = await admin
    .from('template_access')
    .delete()
    .eq('restaurant_id', restaurant_id)
    .eq('template_id', template_id)
    .eq('granted_by', 'manual')

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  // Callers should re-fetch to confirm actual DB state
  return NextResponse.json({ success: true, deleted: 1 })
}
