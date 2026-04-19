'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LayoutDashboard, Building2, CreditCard, FileText, Users, LogOut, Menu, X, Shield, Palette, Paintbrush, Settings } from 'lucide-react'
import type { PlatformRole } from '@/lib/platform-auth'

type NavItem = {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  label: string
  href: string
  roles: PlatformRole[]
  badge?: number
}

const ACCENT = '#ef4444'

function buildNav(role: PlatformRole, legalPendingCount: number, teamPendingCount: number, designRequestCount: number): NavItem[] {
  const all: NavItem[] = [
    { icon: LayoutDashboard, label: 'Überblick',       href: '/platform',                    roles: ['owner', 'co_founder', 'developer'] },
    { icon: Building2,       label: 'Restaurants',     href: '/platform/restaurants',         roles: ['owner', 'co_founder', 'developer', 'support'] },
    { icon: CreditCard,      label: 'Billing',         href: '/platform/billing',             roles: ['owner', 'co_founder', 'billing'] },
    { icon: FileText,        label: 'Rechtstexte',     href: '/platform/legal',               roles: ['owner', 'co_founder'], badge: legalPendingCount },
    { icon: Users,           label: 'Team',            href: '/platform/team',                roles: ['owner'], badge: teamPendingCount },
    { icon: Palette,         label: 'Design-Anfragen', href: '/platform/design-requests',     roles: ['owner', 'co_founder'], badge: designRequestCount },
    { icon: Paintbrush,      label: 'Design',          href: '/platform/design',              roles: ['owner', 'co_founder'] },
    { icon: Settings,        label: 'Einstellungen',   href: '/platform/settings',            roles: ['owner', 'co_founder', 'developer', 'billing', 'support'] },
  ]
  return all.filter(item => item.roles.includes(role))
}

export function PlatformSidebar({
  userEmail,
  role,
  legalPendingCount = 0,
  teamPendingCount = 0,
  designRequestCount = 0,
}: {
  userEmail: string
  role: PlatformRole
  legalPendingCount?: number
  teamPendingCount?: number
  designRequestCount?: number
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const nav = buildNav(role, legalPendingCount, teamPendingCount, designRequestCount)

  const roleLabel: Record<PlatformRole, string> = {
    owner: 'Owner',
    co_founder: 'Co-Founder',
    developer: 'Developer',
    billing: 'Billing',
    support: 'Support',
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push(role === 'owner' ? '/platform-login' : '/team-login')
  }

  const Sidebar = () => (
    <aside style={{
      width: '220px', height: '100%', background: '#0f0f1a',
      display: 'flex', flexDirection: 'column', position: 'fixed',
      top: 0, left: 0, bottom: 0, zIndex: 50,
      borderRight: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{ padding: '24px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px',
            background: ACCENT, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
          }}><Shield size={15} color="#fff" /></div>
          <span style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '0.85rem', letterSpacing: '-0.01em' }}>
            Platform Admin
          </span>
        </div>
        <p style={{ color: '#888', fontSize: '0.68rem', marginLeft: '40px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {userEmail}
        </p>
        <div style={{ marginLeft: '40px', marginTop: '4px' }}>
          <span style={{
            fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            color: role === 'owner' ? '#ef4444' : role === 'co_founder' ? '#f59e0b' : role === 'support' ? '#10b981' : '#6366f1',
            background: role === 'owner' ? 'rgba(239,68,68,0.1)' : role === 'co_founder' ? 'rgba(245,158,11,0.1)' : role === 'support' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
            padding: '2px 6px', borderRadius: '4px',
          }}>
            {roleLabel[role]}
          </span>
        </div>
      </div>

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 16px 12px' }} />

      <nav style={{ flex: 1, padding: '0 8px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
        {nav.map(item => {
          const isActive = pathname === item.href || (item.href !== '/platform' && pathname.startsWith(item.href + '/'))
          return (
            <button
              key={item.href}
              onClick={() => { router.push(item.href); setMobileOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '8px', border: 'none',
                background: isActive ? 'rgba(239,68,68,0.12)' : 'transparent',
                color: isActive ? ACCENT : '#888',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.85rem', cursor: 'pointer', width: '100%', textAlign: 'left',
                borderLeft: isActive ? `3px solid ${ACCENT}` : '3px solid transparent',
                position: 'relative',
              }}
            >
              <item.icon size={15} style={{ flexShrink: 0 }} />
              {item.label}
              {(item.badge ?? 0) > 0 && (
                <span style={{
                  marginLeft: 'auto', minWidth: '18px', height: '18px',
                  background: '#f59e0b', borderRadius: '9px',
                  fontSize: '0.65rem', fontWeight: 800, color: '#000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 5px',
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div style={{ padding: '12px 8px 20px' }}>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 8px 10px' }} />
        {role === 'owner' && (
          <button
            onClick={() => router.push('/admin')}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 12px', borderRadius: '8px', border: 'none',
              background: 'transparent', color: '#888',
              fontSize: '0.8rem', cursor: 'pointer', width: '100%', textAlign: 'left',
              marginBottom: '2px',
            }}
          >
            → Restaurant-Admin
          </button>
        )}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '9px 12px', borderRadius: '8px', border: 'none',
            background: 'transparent', color: '#888',
            fontSize: '0.85rem', cursor: 'pointer', width: '100%', textAlign: 'left',
          }}
        >
          <LogOut size={15} style={{ flexShrink: 0 }} />
          Abmelden
        </button>
      </div>
    </aside>
  )

  return (
    <>
      <div className="platform-sidebar-desktop">
        <Sidebar />
      </div>

      <div className="platform-mobile-header" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40,
        background: '#0f0f1a', padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={13} color="#fff" />
          </div>
          <span style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '0.85rem' }}>Platform Admin</span>
        </div>
        <button onClick={() => setMobileOpen(o => !o)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', padding: '4px' }}>
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {mobileOpen && (
        <>
          <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 45 }} />
          <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50, width: '240px' }}>
            <Sidebar />
          </div>
        </>
      )}

      <style>{`
        .platform-sidebar-desktop { display: block; width: 220px; flex-shrink: 0; }
        .platform-mobile-header { display: none !important; }
        .platform-main { margin-left: 0; }
        @media (max-width: 768px) {
          .platform-sidebar-desktop { display: none !important; }
          .platform-mobile-header { display: flex !important; }
          .platform-main { padding-top: 56px; }
        }
      `}</style>
    </>
  )
}
