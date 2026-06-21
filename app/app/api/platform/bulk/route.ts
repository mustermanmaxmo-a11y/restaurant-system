import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { logAudit } from '@/lib/audit'

const ALLOWED_PLANS = new Set(['trial', 'starter', 'pro', 'enterprise', 'expired'])
const DAY = 24 * 60 * 60 * 1000

export async function POST(req: NextRequest) {
  let role: string
  let actorEmail = 'unknown'
  try {
    const access = await requirePlatformAccess()
    role = access.role
    actorEmail = access.user?.email ?? 'unknown'
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  if (role === 'support' || role === 'billing') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { ids, action, params } = await req.json()

  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
    return NextResponse.json({ error: 'ids must be array of 1–100' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const results: Record<string, 'ok' | 'err'> = {}

  async function update(id: string, payload: Record<string, unknown>) {
    const { error } = await admin.from('restaurants').update(payload).eq('id', id)
    results[id] = error ? 'err' : 'ok'
  }

  for (const id of ids) {
    switch (action) {
      case 'extend-trial': {
        const days = Math.max(1, Math.min(365, Number(params?.days) || 14))
        const { data } = await admin.from('restaurants').select('trial_ends_at').eq('id', id).single()
        const base = data?.trial_ends_at
          ? Math.max(new Date(data.trial_ends_at).getTime(), Date.now())
          : Date.now()
        await update(id, {
          plan: 'trial',
          trial_ends_at: new Date(base + days * DAY).toISOString(),
          active: true,
        })
        break
      }
      case 'set-plan': {
        const plan = params?.plan as string
        if (!ALLOWED_PLANS.has(plan)) { results[id] = 'err'; break }
        const payload: Record<string, unknown> = { plan }
        if (plan === 'trial') {
          payload.trial_ends_at = new Date(Date.now() + 14 * DAY).toISOString()
          payload.active = true
        } else if (plan === 'expired') {
          payload.active = false
          payload.trial_ends_at = null
        } else {
          payload.active = true
          payload.trial_ends_at = null
        }
        await update(id, payload)
        break
      }
      case 'activate':
        await update(id, { active: true })
        break
      case 'deactivate':
        await update(id, { active: false })
        break
      default:
        results[id] = 'err'
    }
  }

  const ok = Object.values(results).filter(v => v === 'ok').length
  const err = Object.values(results).filter(v => v === 'err').length

  await logAudit({
    actor_email: actorEmail,
    action: 'bulk_action',
    target_type: 'restaurant',
    details: { action, params, ids_count: ids.length, ok, err },
  })

  return NextResponse.json({ results, ok, err })
}
