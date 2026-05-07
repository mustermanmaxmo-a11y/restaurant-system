import { requirePlatformAccess } from '@/lib/platform-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import DesignRequestsClient from './DesignRequestsClient'

export const dynamic = 'force-dynamic'

export default async function DesignRequestsPage() {
  const { role } = await requirePlatformAccess()

  if (role !== 'owner' && role !== 'co_founder') {
    return (
      <div style={{ padding: '40px 24px', color: '#888', fontSize: '0.875rem' }}>
        Kein Zugriff auf diese Seite.
      </div>
    )
  }

  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('design_requests')
    .select('*, restaurants(id, name, slug)')
    .order('created_at', { ascending: false })

  return <DesignRequestsClient initialRequests={data ?? []} />
}
