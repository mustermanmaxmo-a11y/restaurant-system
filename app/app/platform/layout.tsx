import { requirePlatformOwner } from '@/lib/platform-auth'
import { PlatformSidebar } from '@/components/PlatformSidebar'

export const dynamic = 'force-dynamic'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requirePlatformOwner()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#1a1a2e', color: '#e5e7eb' }}>
      <PlatformSidebar userEmail={user.email ?? '—'} />
      <main style={{ flex: 1, minHeight: '100vh', overflowY: 'auto' }} className="platform-main">
        {children}
      </main>
    </div>
  )
}
