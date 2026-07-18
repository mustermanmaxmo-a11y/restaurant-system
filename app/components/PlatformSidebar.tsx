'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { PlatformRole } from '@/lib/platform-auth'
import {
  LayoutDashboard, Building2, Search, BarChart2, CreditCard,
  Megaphone, ToggleLeft, Layers, Palette, Users, FileText,
  BookOpen, Settings, LogOut, Shield, Activity, Radio, Brain,
  ClipboardList, ChevronDown, GitBranch, Trophy, AlertTriangle,
  TrendingUp, FlaskConical, Sprout, Flame, GitCompare, HeartPulse,
  PanelLeftClose, PanelLeftOpen, Command, Menu, X,
} from 'lucide-react'

type NavItem = {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  label: string
  href: string
  roles: PlatformRole[]
  badge?: number
  exact?: boolean
}

type NavGroup = {
  key: string
  label: string
  noHeader?: boolean
  items: NavItem[]
}

const ALL: PlatformRole[] = ['owner', 'co_founder', 'developer', 'billing', 'support']

function buildGroups(role: PlatformRole, legal: number, team: number, design: number): NavGroup[] {
  const raw: NavGroup[] = [
    {
      key: 'core',
      label: '',
      noHeader: true,
      items: [
        { icon: LayoutDashboard, label: 'Dashboard',      href: '/platform',              exact: true, roles: ['owner', 'co_founder', 'developer'] },
        { icon: Building2,       label: 'Restaurants',    href: '/platform/restaurants',  roles: ALL },
        { icon: Search,          label: 'Suche',          href: '/platform/search',       roles: ['owner', 'co_founder', 'developer', 'support'] },
        { icon: Radio,           label: 'Live Monitor',   href: '/platform/monitor',      roles: ['owner', 'co_founder', 'developer', 'support'] },
      ],
    },
    {
      key: 'analytics',
      label: 'Analytics',
      items: [
        { icon: BarChart2,     label: 'Übersicht',      href: '/platform/analytics',    roles: ['owner', 'co_founder', 'developer'] },
        { icon: TrendingUp,    label: 'Revenue',        href: '/platform/revenue',      roles: ['owner', 'co_founder', 'billing'] },
        { icon: Sprout,        label: 'Growth Funnel',  href: '/platform/growth',       roles: ['owner', 'co_founder', 'developer'] },
        { icon: Flame,         label: 'Heatmap',        href: '/platform/heatmap',      roles: ['owner', 'co_founder', 'developer'] },
        { icon: GitBranch,     label: 'Cohorts',        href: '/platform/cohorts',      roles: ['owner', 'co_founder', 'developer'] },
        { icon: Trophy,        label: 'Leaderboard',    href: '/platform/leaderboard',  roles: ['owner', 'co_founder', 'developer'] },
        { icon: GitCompare,    label: 'Vergleich',      href: '/platform/compare',      roles: ['owner', 'co_founder', 'developer'] },
        { icon: AlertTriangle, label: 'Churn Risk',     href: '/platform/churn',        roles: ['owner', 'co_founder', 'developer'] },
        { icon: FlaskConical,  label: 'Trial Pipeline', href: '/platform/trials',       roles: ['owner', 'co_founder', 'developer'] },
        { icon: Activity,      label: 'Activity',       href: '/platform/activity',     roles: ['owner', 'co_founder', 'developer'] },
        { icon: Brain,         label: 'AI Insights',    href: '/platform/insights',     roles: ['owner', 'co_founder'] },
      ],
    },
    {
      key: 'operations',
      label: 'Operations',
      items: [
        { icon: CreditCard,    label: 'Billing',        href: '/platform/billing',         roles: ['owner', 'co_founder', 'billing'] },
        { icon: Megaphone,     label: 'Outreach',       href: '/platform/outreach',        roles: ['owner', 'co_founder'] },
        { icon: ToggleLeft,    label: 'Feature Flags',  href: '/platform/feature-flags',   roles: ['owner', 'co_founder', 'developer'] },
        { icon: HeartPulse,    label: 'Status',         href: '/platform/status',          roles: ALL },
        { icon: ClipboardList, label: 'Audit Log',      href: '/platform/audit',           roles: ['owner', 'co_founder', 'developer'] },
        { icon: Layers,        label: 'Templates',      href: '/platform/templates',       roles: ['owner', 'co_founder'] },
        { icon: Palette,       label: 'Design',         href: '/platform/design-requests', roles: ['owner', 'co_founder'], badge: design },
      ],
    },
    {
      key: 'admin',
      label: 'Admin',
      items: [
        { icon: Users,    label: 'Team',          href: '/platform/team',      roles: ['owner'],               badge: team },
        { icon: FileText, label: 'Rechtstexte',   href: '/platform/legal',     roles: ['owner', 'co_founder'], badge: legal },
        { icon: BookOpen, label: 'KI-Wissen',     href: '/platform/knowledge', roles: ['owner', 'co_founder'] },
        { icon: Settings, label: 'Einstellungen', href: '/platform/settings',  roles: ALL },
      ],
    },
  ]
  return raw
    .map(g => ({ ...g, items: g.items.filter(i => i.roles.includes(role)) }))
    .filter(g => g.items.length > 0)
}

const ROLE_META: Record<PlatformRole, { label: string; color: string; bg: string }> = {
  owner:      { label: 'Owner',      color: '#f9a8d4', bg: 'rgba(236,72,153,0.14)' },
  co_founder: { label: 'Co-Founder', color: '#fde68a', bg: 'rgba(245,158,11,0.14)' },
  developer:  { label: 'Developer',  color: '#7dd3e8', bg: 'rgba(14,116,144,0.18)' },
  billing:    { label: 'Billing',    color: '#6ee7b7', bg: 'rgba(16,185,129,0.14)' },
  support:    { label: 'Support',    color: '#93c5fd', bg: 'rgba(59,130,246,0.14)' },
}

function initials(email: string) {
  const parts = email.split('@')[0].split(/[._-]/)
  return (parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')) || (email[0]?.toUpperCase() ?? '?')
}

// ─── NavButton ────────────────────────────────────────────────────────────────

function NavButton({
  item, collapsed, active, onNavigate,
}: {
  item: NavItem; collapsed: boolean; active: boolean; onNavigate: (href: string) => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={() => onNavigate(item.href)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={collapsed ? item.label : undefined}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? '0' : '9px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '9px 0' : '6px 10px',
        borderRadius: collapsed ? '0' : '8px',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: '0.81rem',
        fontWeight: active ? 600 : 500,
        background: active
          ? 'rgba(14,116,144,0.13)'
          : hov ? 'rgba(255,255,255,0.04)' : 'transparent',
        color: active ? '#7dd3e8' : hov ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.38)',
        boxShadow: active && !collapsed ? 'inset 2px 0 0 rgba(14,116,144,0.7)' : undefined,
        marginBottom: '1px',
        transition: 'background 0.1s, color 0.1s, box-shadow 0.1s',
        position: 'relative',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <item.icon
        size={14}
        strokeWidth={active ? 2.5 : 1.8}
      />
      {!collapsed && (
        <>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
          {(item.badge ?? 0) > 0 && (
            <span style={{
              minWidth: '17px', height: '17px', borderRadius: '9px',
              background: 'rgba(14,116,144,0.28)', color: '#7dd3e8',
              fontSize: '0.6rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
              flexShrink: 0,
            }}>
              {item.badge}
            </span>
          )}
        </>
      )}
    </button>
  )
}

// ─── SidebarContent ──────────────────────────────────────────────────────────

function SidebarContent({
  groups, pathname, role, userEmail, onNavigate, onLogout,
  collapsed, onToggleCollapse,
}: {
  groups: NavGroup[]; pathname: string; role: PlatformRole
  userEmail: string; onNavigate: (href: string) => void; onLogout: () => void
  collapsed: boolean; onToggleCollapse: () => void
}) {
  const rm = ROLE_META[role]
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['analytics', 'operations', 'admin'])
  )

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <aside style={{
      width: collapsed ? '56px' : '236px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0, left: 0, bottom: 0,
      zIndex: 50,
      background: '#03030c',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
    }}>

      {/* ── Logo header ── */}
      <div style={{
        height: '52px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding: collapsed ? '0' : '0 12px 0 14px',
        flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0,
            background: 'linear-gradient(135deg, #0e7490 0%, #4f46e5 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 14px rgba(14,116,144,0.4)',
          }}>
            <Shield size={13} color="#fff" strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <div>
              <div style={{ color: 'rgba(255,255,255,0.92)', fontWeight: 700, fontSize: '0.86rem', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                Platform
              </div>
              <div style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.58rem', letterSpacing: '0.02em' }}>
                Restaurant OS
              </div>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            title="Sidebar einklappen"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.18)', padding: '5px',
              display: 'flex', alignItems: 'center', borderRadius: '6px',
              flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.18)')}
          >
            <PanelLeftClose size={14} />
          </button>
        )}
      </div>

      {/* ── ⌘K hint (only expanded) ── */}
      {!collapsed && (
        <div style={{ padding: '8px 10px 4px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '6px 10px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            cursor: 'default',
          }}>
            <Command size={11} color="rgba(255,255,255,0.22)" strokeWidth={2} />
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.72rem', flex: 1 }}>Suche & Navigation</span>
            <kbd style={{
              padding: '1px 5px', borderRadius: '4px',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.22)',
              fontSize: '0.6rem',
              border: '1px solid rgba(255,255,255,0.08)',
              fontFamily: 'ui-monospace, monospace',
              letterSpacing: '0.01em',
            }}>⌘K</kbd>
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav
        style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '8px 0' : '4px 8px' }}
        className="ps-nav"
      >
        {groups.map((group) => {
          const isExpanded = group.noHeader || expandedGroups.has(group.key)

          return (
            <div key={group.key} style={{ marginBottom: group.noHeader ? '4px' : '2px' }}>
              {/* Group header */}
              {!group.noHeader && !collapsed && (
                <button
                  onClick={() => toggleGroup(group.key)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px 4px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.22)',
                    fontSize: '0.6rem', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    marginTop: '8px',
                  }}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    size={10}
                    style={{
                      transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>
              )}

              {/* Items */}
              <div style={{
                maxHeight: isExpanded || collapsed ? '1200px' : '0px',
                overflow: 'hidden',
                transition: 'max-height 0.2s ease',
              }}>
                {group.items.map(item => (
                  <NavButton
                    key={item.href}
                    item={item}
                    collapsed={collapsed}
                    active={isActive(item)}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>

              {/* Divider after core group */}
              {group.noHeader && !collapsed && (
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '8px 4px 4px' }} />
              )}
            </div>
          )
        })}
      </nav>

      {/* ── User card ── */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: collapsed ? '10px 0' : '10px 10px 12px',
        flexShrink: 0,
      }}>
        {!collapsed && role === 'owner' && (
          <button
            onClick={() => onNavigate('/admin')}
            style={{
              width: '100%', padding: '5px 10px', borderRadius: '7px', border: 'none',
              background: 'transparent', color: 'rgba(255,255,255,0.16)',
              fontSize: '0.7rem', cursor: 'pointer', textAlign: 'left',
              marginBottom: '8px', letterSpacing: '0.01em',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.16)')}
          >
            → Restaurant-Admin
          </button>
        )}

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: collapsed ? '0' : '9px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '2px 0' : '8px 10px',
          borderRadius: '10px',
          background: collapsed ? 'transparent' : 'rgba(255,255,255,0.03)',
          border: collapsed ? 'none' : '1px solid rgba(255,255,255,0.06)',
        }}>
          <div
            title={collapsed ? `${userEmail} · ${rm.label}` : undefined}
            style={{
              width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(14,116,144,0.45), rgba(79,70,229,0.45))',
              border: '1px solid rgba(14,116,144,0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#7dd3e8', fontSize: '0.65rem', fontWeight: 700,
              cursor: collapsed ? 'default' : undefined,
            }}
          >
            {initials(userEmail)}
          </div>

          {!collapsed && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: 'rgba(255,255,255,0.65)', fontSize: '0.72rem', fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {userEmail}
                </div>
                <span style={{
                  display: 'inline-block', marginTop: '2px',
                  fontSize: '0.58rem', fontWeight: 700,
                  padding: '1px 6px', borderRadius: '4px',
                  background: rm.bg, color: rm.color,
                }}>
                  {rm.label}
                </span>
              </div>
              <button
                onClick={onLogout}
                title="Abmelden"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.18)', padding: '3px',
                  display: 'flex', alignItems: 'center', borderRadius: '5px',
                  flexShrink: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.18)')}
              >
                <LogOut size={13} />
              </button>
            </>
          )}
        </div>

        {/* Expand button (only in collapsed mode) */}
        {collapsed && (
          <button
            onClick={onToggleCollapse}
            title="Sidebar ausklappen"
            style={{
              width: '100%', marginTop: '8px', padding: '6px 0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.18)', borderRadius: '0',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.18)')}
          >
            <PanelLeftOpen size={14} />
          </button>
        )}
      </div>

      <style>{`
        .ps-nav::-webkit-scrollbar { width: 2px; }
        .ps-nav::-webkit-scrollbar-track { background: transparent; }
        .ps-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 2px; }
      `}</style>
    </aside>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function PlatformSidebar({
  userEmail, role,
  legalPendingCount = 0, teamPendingCount = 0, designRequestCount = 0,
}: {
  userEmail: string; role: PlatformRole
  legalPendingCount?: number; teamPendingCount?: number; designRequestCount?: number
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const groups = buildGroups(role, legalPendingCount, teamPendingCount, designRequestCount)

  // Persist sidebar state
  useEffect(() => {
    const v = localStorage.getItem('ps-collapsed')
    if (v === 'true') setCollapsed(true)
  }, [])

  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('ps-collapsed', String(next))
  }

  function navigate(href: string) {
    router.push(href)
    setMobileOpen(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/team-login')
  }

  const sidebarW = collapsed ? 56 : 236

  return (
    <>
      {/* Desktop spacer */}
      <div className="ps-desktop" style={{ width: `${sidebarW}px`, flexShrink: 0, transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)' }}>
        <SidebarContent
          groups={groups} pathname={pathname} role={role}
          userEmail={userEmail} onNavigate={navigate} onLogout={logout}
          collapsed={collapsed} onToggleCollapse={toggleCollapse}
        />
      </div>

      {/* Mobile top bar */}
      <div className="ps-mobile-bar" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40, height: '52px',
        background: 'rgba(3,3,12,0.97)', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'linear-gradient(135deg,#0e7490,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(14,116,144,0.4)' }}>
            <Shield size={12} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: '0.86rem', letterSpacing: '-0.01em' }}>Platform</span>
        </div>
        <button onClick={() => setMobileOpen(o => !o)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '4px' }}>
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 45, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 55, width: '240px' }}>
            <SidebarContent
              groups={groups} pathname={pathname} role={role}
              userEmail={userEmail} onNavigate={navigate} onLogout={logout}
              collapsed={false} onToggleCollapse={() => setMobileOpen(false)}
            />
          </div>
        </>
      )}

      <style>{`
        .ps-desktop { display: block; }
        .ps-mobile-bar { display: none !important; }
        @media (max-width: 768px) {
          .ps-desktop { display: none !important; }
          .ps-mobile-bar { display: flex !important; }
          .platform-main { padding-top: 52px; }
        }
      `}</style>
    </>
  )
}
