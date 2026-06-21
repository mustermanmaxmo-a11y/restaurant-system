import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  await requirePlatformAccess()
  const admin = createSupabaseAdmin()

  const q    = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const plan = req.nextUrl.searchParams.get('plan') ?? ''
  const status = req.nextUrl.searchParams.get('status') ?? ''

  if (!q && !plan && !status) return NextResponse.json([])

  let query = admin
    .from('restaurants')
    .select('id, name, slug, plan, active, trial_ends_at, created_at, owner_id, stripe_subscription_id')
    .order('name')
    .limit(60)

  if (q) query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%`)
  if (plan && plan !== 'all') query = query.eq('plan', plan)
  if (status === 'active') query = query.eq('active', true)
  if (status === 'inactive') query = query.eq('active', false)

  const { data } = await query
  const results = data ?? []

  // Enrich with owner emails
  if (results.length > 0) {
    const { data: usersRes } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const emailMap: Record<string, string> = {}
    for (const u of usersRes?.users ?? []) emailMap[u.id] = u.email ?? ''
    return NextResponse.json(results.map(r => ({ ...r, email: emailMap[r.owner_id] ?? '' })))
  }

  return NextResponse.json(results)
}
