import { requirePlatformAccess } from '@/lib/platform-auth'
import { PlatformSidebar } from '@/components/PlatformSidebar'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveDesignVersion } from '@/lib/design-version'
import { DesignVersionProvider } from '@/components/providers/design-version-provider'
import PlatformV2Banner from './_v2/PlatformV2Banner'
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

  const version = await resolveDesignVersion('platform')
  const bg = version === 'v2' ? '#0A0A0F' : '#1a1a2e'

  return (
    <DesignVersionProvider version={version}>
      <div style={{ display: 'flex', minHeight: '100vh', background: bg, color: '#e5e7eb' }}>
        <PlatformSidebar
          userEmail={user?.email ?? '—'}
          role={role}
          legalPendingCount={legalPendingCount}
          teamPendingCount={teamPendingCount}
          designRequestCount={designRequestCount}
        />
        <main style={{ flex: 1, minHeight: '100vh', overflowY: 'auto' }} className="platform-main">
          {version === 'v2' && <PlatformV2Banner />}
          {children}
        </main>
        <PlatformPushSetup userId={user?.id} />
      </div>
    </DesignVersionProvider>
  )
}
