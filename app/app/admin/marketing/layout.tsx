import MarketingNav from '@/components/marketing/MarketingNav'

const navItems = [
  { href: '/admin/marketing/advisor',     icon: '🤖', label: 'KI-Berater',   badge: null },
  { href: '/admin/marketing/campaigns',   icon: '📧', label: 'Kampagnen',    badge: null },
  { href: '/admin/marketing/birthday',     icon: '🎂', label: 'Geburtstag',   badge: null },
  { href: '/admin/marketing/drip',         icon: '💧', label: 'Win-Back Drip', badge: null },
  { href: '/admin/marketing/automations', icon: '⚡', label: 'Automationen', badge: null },
  { href: '/admin/marketing/templates',   icon: '📨', label: 'Templates',    badge: null },
  { href: '/admin/marketing/social',      icon: '📱', label: 'Social Media', badge: null },
  { href: '/admin/marketing/analytics',   icon: '📊', label: 'Analytics',    badge: null },
  { href: '/admin/marketing/subscribers', icon: '👥', label: 'Abonnenten',   badge: null },
]

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100%', height: '100%' }}>
      {/* Marketing Sidebar */}
      <aside style={{
        width: '208px',
        flexShrink: 0,
        background: 'var(--sidebar-bg, #111)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 16px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>📣</span>
            <span style={{
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.9rem',
              letterSpacing: '-0.01em',
            }}>
              Marketing
            </span>
          </div>
          <p style={{
            color: 'var(--sidebar-text, #6b7280)',
            fontSize: '0.7rem',
            marginTop: '4px',
            marginLeft: '32px',
            fontWeight: 500,
          }}>
            Hub
          </p>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, paddingTop: '8px' }}>
          <MarketingNav items={navItems} />
        </div>

        {/* Bottom divider */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <p style={{
            color: 'var(--sidebar-text, #4b5563)',
            fontSize: '0.65rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            Marketing Suite
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
