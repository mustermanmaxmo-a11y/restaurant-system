import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { logAudit } from '@/lib/audit'

const ALLOWED_PLANS = ['trial', 'starter', 'pro', 'enterprise', 'expired'] as const

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let actorEmail = 'unknown'
  try {
    const access = await requirePlatformAccess()
    if (access.role === 'support' || access.role === 'billing') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    actorEmail = access.user?.email ?? 'unknown'
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { plan, trialDays } = await request.json()

  if (!ALLOWED_PLANS.includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()

  const update: Record<string, unknown> = { plan }

  if (plan === 'trial') {
    const days = Number(trialDays) > 0 ? Number(trialDays) : 14
    update.trial_ends_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    update.active = true
  } else if (plan === 'expired') {
    update.active = false
    update.trial_ends_at = null
  } else {
    update.active = true
    update.trial_ends_at = null
  }

  const { data: existing } = await admin.from('restaurants').select('name, plan').eq('id', id).single()
  const { error } = await admin.from('restaurants').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    actor_email: actorEmail,
    action: 'plan_change',
    target_type: 'restaurant',
    target_id: id,
    target_name: existing?.name,
    details: { from: existing?.plan, to: plan, ...(trialDays ? { trial_days: trialDays } : {}) },
  })

  return NextResponse.json({ ok: true })
}
