import { requirePlatformAccess } from '@/lib/platform-auth'
import { PlatformSidebar } from '@/components/PlatformSidebar'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requirePlatformAccess()

  let legalPendingCount = 0
  let teamPendingCount = 0
  let designRequestCount = 0
  if (role === 'owner' || role === 'co_founder') {
    const admin = createSupabaseAdmin()
    const [{ data: legalDocs }, { data: teamRequests }, { data: designReqs }] = await Promise.all([
      admin.from('legal_documents').select('key').not('draft_content', 'is', null),
      admin.from('team_registration_requests').select('id').eq('status', 'pending'),
      admin.from('design_requests').select('id').eq('status', 'pending'),
    ])
    legalPendingCount = legalDocs?.length ?? 0
    teamPendingCount = teamRequests?.length ?? 0
    designRequestCount = designReqs?.length ?? 0
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#1a1a2e', color: '#e5e7eb' }}>
      <PlatformSidebar userEmail={user?.email ?? '—'} role={role} legalPendingCount={legalPendingCount} teamPendingCount={teamPendingCount} designRequestCount={designRequestCount} />
      <main style={{ flex: 1, minHeight: '100vh', overflowY: 'auto' }} className="platform-main">
        {children}
      </main>
    </div>
  )
}
