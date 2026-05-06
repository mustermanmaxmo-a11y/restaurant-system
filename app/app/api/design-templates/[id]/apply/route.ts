import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'

export const dynamic = 'force-dynamic'

function allowedTiersForPlan(plan: string | null | undefined): string[] {
  switch (plan) {
    case 'enterprise':
      return ['basic', 'pro', 'premium']
    case 'pro':
      return ['basic', 'pro']
    case 'trial':
      return ['basic', 'pro']
    case 'starter':
    case 'basic':
    default:
      return ['basic']
  }
}

// POST /api/design-templates/[id]/apply
// Body: { restaurant_id: string }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: templateId } = await params

  const ssr = await createSupabaseServerSSR()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const restaurantId = body?.restaurant_id
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()

  // Restaurant ownership
  const { data: resto, error: restoErr } = await admin
    .from('restaurants')
    .select('id, plan, owner_id')
    .eq('id', restaurantId)
    .single()
  if (restoErr || !resto) {
    return NextResponse.json({ error: 'restaurant not found' }, { status: 404 })
  }
  if (resto.owner_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Template
  const { data: template, error: tplErr } = await admin
    .from('design_templates')
    .select('id, slug, plan_tier, is_public, config')
    .eq('id', templateId)
    .single()
  if (tplErr || !template) {
    return NextResponse.json({ error: 'template not found' }, { status: 404 })
  }

  // Access check: plan tier OR manual grant
  const allowedTiers = allowedTiersForPlan(resto.plan)
  const allowedByPlan = template.is_public && allowedTiers.includes(template.plan_tier)
  let allowedByGrant = false
  if (!allowedByPlan) {
    const { data: grant } = await admin
      .from('template_access')
      .select('template_id')
      .eq('restaurant_id', restaurantId)
      .eq('template_id', templateId)
      .maybeSingle()
    allowedByGrant = !!grant
  }
  if (!allowedByPlan && !allowedByGrant) {
    return NextResponse.json({ error: 'template not accessible on current plan' }, { status: 403 })
  }

  // Build new design_config: template config + template_id metadata so UI can show "Aktuell aktiv"
  const newConfig = { ...(template.config as Record<string, unknown>), template_id: template.id, template_slug: template.slug }

  // Also mirror legacy columns for backward compat (so existing rendering paths continue to work)
  const cfg = template.config as Record<string, string | undefined>
  const updatePayload: Record<string, unknown> = {
    design_config: newConfig,
    design_package: template.slug,
    primary_color: cfg.primary_color ?? null,
    bg_color: cfg.bg_color ?? null,
    surface_color: cfg.surface_color ?? null,
    header_color: cfg.header_color ?? null,
    button_color: cfg.button_color ?? null,
    card_color: cfg.card_color ?? null,
    text_color: cfg.text_color ?? null,
    font_pair: cfg.font_pair ?? null,
    layout_variant: cfg.layout_variant ?? null,
  }

  const { error: updErr } = await admin
    .from('restaurants')
    .update(updatePayload)
    .eq('id', restaurantId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ success: true, template_id: template.id, template_slug: template.slug })
}
