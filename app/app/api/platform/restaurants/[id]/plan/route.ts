import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'

const ALLOWED_PLANS = ['trial', 'starter', 'pro', 'enterprise', 'expired'] as const

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { role } = await requirePlatformAccess()
    if (role === 'support' || role === 'billing') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
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

  const { error } = await admin.from('restaurants').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
