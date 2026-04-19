import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import DesignSwitcherClient from './DesignSwitcherClient'

export const dynamic = 'force-dynamic'

export default async function PlatformDesignPage() {
  const { role } = await requirePlatformAccess()
  const canEdit = role === 'owner' || role === 'co_founder'

  const admin = createSupabaseAdmin()
  const [{ data: settings }, { data: restaurants }] = await Promise.all([
    admin.from('platform_settings').select('*').eq('id', 1).maybeSingle(),
    admin
      .from('restaurants')
      .select('id, name, admin_design_version, guest_design_version')
      .order('name'),
  ])

  return (
    <DesignSwitcherClient
      canEdit={canEdit}
      initialPlatformVersion={(settings?.platform_design_version as 'v1' | 'v2') ?? 'v1'}
      initialDefaultVersion={(settings?.restaurants_default_version as 'v1' | 'v2') ?? 'v1'}
      restaurants={(restaurants ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        override: (r.admin_design_version as 'v1' | 'v2' | null) ?? null,
      }))}
    />
  )
}
