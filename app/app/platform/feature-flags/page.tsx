import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { redirect } from 'next/navigation'
import { FeatureFlagsClient } from './FeatureFlagsClient'

export const dynamic = 'force-dynamic'

const FLAG_KEYS = [
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
] as const

export default async function FeatureFlagsPage() {
  const { role } = await requirePlatformAccess()
  if (role === 'support' || role === 'billing') redirect('/platform')

  const admin = createSupabaseAdmin()
  const { data: raw } = await admin
    .from('restaurants')
    .select('id, name, slug, auto_translate_enabled, email_marketing_enabled, weekly_report_email, prep_show_in_kds, prep_push_enabled, benchmark_opt_in, crm_rule_inactive, crm_rule_almost_goal, crm_rule_welcome, referral_enabled')
    .order('name')

  const restaurants = (raw ?? []).map(r => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    flags: Object.fromEntries(
      FLAG_KEYS.map(k => [k, r[k] ?? false])
    ) as Record<typeof FLAG_KEYS[number], boolean>,
  }))

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
          Feature Flags
        </h1>
        <p style={{ color: '#888', fontSize: '0.85rem' }}>
          {restaurants.length} Restaurants · Klick auf einen Flag zum An-/Ausschalten
        </p>
      </div>
      <FeatureFlagsClient restaurants={restaurants} />
    </div>
  )
}
