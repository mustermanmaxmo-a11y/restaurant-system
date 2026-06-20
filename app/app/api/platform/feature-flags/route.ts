import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'

const ALLOWED_FLAGS = new Set([
  'auto_translate_enabled',
  'email_marketing_enabled',
  'weekly_report_email',
  'prep_show_in_kds',
  'prep_push_enabled',
  'benchmark_opt_in',
  'crm_rule_inactive',
  'crm_rule_almost_goal',
  'crm_rule_welcome',
  'referral_enabled',
])

export async function PATCH(request: NextRequest) {
  try {
    const { role } = await requirePlatformAccess()
    if (role === 'support' || role === 'billing') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { restaurantId, flag, value } = await request.json()

  if (!restaurantId || !flag || typeof value !== 'boolean') {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }
  if (!ALLOWED_FLAGS.has(flag)) {
    return NextResponse.json({ error: 'Flag not allowed' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('restaurants')
    .update({ [flag]: value })
    .eq('id', restaurantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
