import { requirePlatformAccess } from '@/lib/platform-auth'
import { PlatformSidebar } from '@/components/PlatformSidebar'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requirePlatformAccess()

  let legalPendingCount = 0
  if (role === 'owner') {
    const admin = createSupabaseAdmin()
    const { data } = await admin
      .from('legal_documents')
      .select('key', { count: 'exact', head: false })
      .not('draft_content', 'is', null)
    legalPendingCount = data?.length ?? 0
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#1a1a2e', color: '#e5e7eb' }}>
      <PlatformSidebar userEmail={user?.email ?? '—'} role={role} legalPendingCount={legalPendingCount} />
      <main style={{ flex: 1, minHeight: '100vh', overflowY: 'auto' }} className="platform-main">
        {children}
      </main>
    </div>
  )
}
