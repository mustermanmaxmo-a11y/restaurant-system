import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'

export const dynamic = 'force-dynamic'

// Plan -> allowed plan_tiers mapping
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

// GET /api/design-templates?restaurant_id=uuid&category=fast-food&search=text
export async function GET(req: Request) {
  const ssr = await createSupabaseServerSSR()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const url = new URL(req.url)
  const restaurantId = url.searchParams.get('restaurant_id')
  const category = url.searchParams.get('category')
  const search = url.searchParams.get('search')

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()

  // Verify the user owns this restaurant
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

  const allowedTiers = allowedTiersForPlan(resto.plan)

  // Manual grants
  const { data: grants } = await admin
    .from('template_access')
    .select('template_id')
    .eq('restaurant_id', restaurantId)
  const grantedIds = (grants ?? []).map(g => g.template_id)

  // Fetch templates (including is_public for access filtering)
  let query = admin
    .from('design_templates')
    .select('id, name, slug, category, style_tags, plan_tier, is_public, preview_url, config, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (category && category !== 'all') {
    query = query.eq('category', category)
  }
  if (search && search.trim().length > 0) {
    const s = search.trim()
    query = query.ilike('name', `%${s}%`)
  }

  const { data: templates, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filter: visible templates = (is_public AND plan_tier in allowed) OR id in grants
  const result = (templates ?? [])
    .map(t => {
      const allowedByPlan = t.is_public && allowedTiers.includes(t.plan_tier)
      const allowedByGrant = grantedIds.includes(t.id)
      const accessible = allowedByPlan || allowedByGrant
      return { ...t, accessible, granted: allowedByGrant }
    })
    // Hide non-public templates that aren't granted
    .filter(t => t.is_public || grantedIds.includes(t.id))

  return NextResponse.json({ templates: result, allowed_tiers: allowedTiers })
}
