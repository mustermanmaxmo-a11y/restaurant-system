import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { resolveDesignVersion } from '@/lib/design-version'
import { DesignVersionProvider } from '@/components/providers/design-version-provider'
import AdminLayoutInner from './AdminLayoutInner'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerSSR()
  const { data: { user } } = await supabase.auth.getUser()

  let restaurantId: string | null = null
  if (user) {
    const { data } = await supabase
      .from('restaurants')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .maybeSingle()
    restaurantId = data?.id ?? null
  }

  const version = await resolveDesignVersion('admin', restaurantId)

  return (
    <DesignVersionProvider version={version}>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </DesignVersionProvider>
  )
}
