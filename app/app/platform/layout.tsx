import { requirePlatformAccess } from '@/lib/platform-auth'
import { PlatformSidebar } from '@/components/PlatformSidebar'
import { CommandPalette } from '@/components/platform/CommandPalette'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { PlatformPushSetup } from '@/components/PlatformPushSetup'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  manifest: '/manifest-platform.json',
}

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
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: '#03030c',
      color: 'rgba(255,255,255,0.88)',
      backgroundImage: [
        'radial-gradient(ellipse 80% 40% at 10% -5%, rgba(124,58,237,0.08) 0%, transparent 60%)',
        'radial-gradient(ellipse 60% 30% at 90% 105%, rgba(6,182,212,0.04) 0%, transparent 50%)',
      ].join(', '),
    }}>
      <PlatformSidebar
        userEmail={user?.email ?? '—'}
        role={role}
        legalPendingCount={legalPendingCount}
        teamPendingCount={teamPendingCount}
        designRequestCount={designRequestCount}
      />
      <main
        style={{ flex: 1, minHeight: '100vh', overflowY: 'auto' }}
        className="platform-main"
      >
        {children}
      </main>

      {/* Global Command Palette — client, fetches lazily on open */}
      <CommandPalette />

      <PlatformPushSetup userId={user?.id} />
    </div>
  )
}
