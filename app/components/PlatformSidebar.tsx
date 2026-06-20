'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { PlatformRole } from '@/lib/platform-auth'
import {
  LayoutDashboard, Building2, Search, BarChart2, CreditCard,
  Megaphone, ToggleLeft, Layers, Palette, Users, FileText,
  BookOpen, Settings, LogOut, Menu, X, Shield,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type NavItem = {
  icon: React.ComponentType<{ size?: number }>
  label: string
  href: string
  roles: PlatformRole[]
  badge?: number
  exact?: boolean
}
type NavGroup = { label: string; items: NavItem[] }

const ALL: PlatformRole[] = ['owner', 'co_founder', 'developer', 'billing', 'support']

function buildGroups(
  role: PlatformRole,
  legal: number,
  team: number,
  design: number,
): NavGroup[] {
  const raw: NavGroup[] = [
    {
      label: 'Übersicht',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', href: '/platform', exact: true, roles: ['owner', 'co_founder', 'developer'] },
      ],
    },
    {
      label: 'Restaurants',
      items: [
        { icon: Building2,  label: 'Alle Restaurants', href: '/platform/restaurants', roles: ALL },
        { icon: Search,     label: 'Suche',             href: '/platform/search',      roles: ['owner', 'co_founder', 'developer', 'support'] },
      ],
    },
    {
      label: 'Wachstum',
      items: [
        { icon: BarChart2,  label: 'Analytics', href: '/platform/analytics', roles: ['owner', 'co_founder', 'developer'] },
        { icon: CreditCard, label: 'Billing',   href: '/platform/billing',   roles: ['owner', 'co_founder', 'billing'] },
        { icon: Megaphone,  label: 'Outreach',  href: '/platform/outreach',  roles: ['owner', 'co_founder'] },
      ],
    },
    {
      label: 'Plattform',
      items: [
        { icon: ToggleLeft, label: 'Feature Flags',    href: '/platform/feature-flags',    roles: ['owner', 'co_founder', 'developer'] },
        { icon: Layers,     label: 'Templates',        href: '/platform/templates',         roles: ['owner', 'co_founder'] },
        { icon: Palette,    label: 'Design-Anfragen',  href: '/platform/design-requests',   roles: ['owner', 'co_founder'], badge: design },
      ],
    },
    {
      label: 'Team & Wissen',
      items: [
        { icon: Users,    label: 'Team',          href: '/platform/team',     roles: ['owner'],                    badge: team },
        { icon: FileText, label: 'Rechtstexte',   href: '/platform/legal',    roles: ['owner', 'co_founder'],      badge: legal },
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
  owner:      { label: 'Owner',      color: '#fca5a5', bg: 'rgba(239,68,68,0.15)' },
  co_founder: { label: 'Co-Founder', color: '#fcd34d', bg: 'rgba(245,158,11,0.12)' },
  developer:  { label: 'Developer',  color: '#a5b4fc', bg: 'rgba(99,102,241,0.12)' },
  billing:    { label: 'Billing',    color: '#6ee7b7', bg: 'rgba(16,185,129,0.1)' },
  support:    { label: 'Support',    color: '#93c5fd', bg: 'rgba(59,130,246,0.1)' },
}

function initials(email: string) {
  const parts = email.split('@')[0].split(/[._-]/)
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || email[0]?.toUpperCase() ?? '?'
}

// ─── Inner nav ────────────────────────────────────────────────────────────────

function SidebarInner({
  groups, pathname, role, userEmail,
  onNavigate, onLogout,
}: {
  groups: NavGroup[]
  pathname: string
  role: PlatformRole
  userEmail: string
  onNavigate: (href: string) => void
  onLogout: () => void
}) {
  const rm = ROLE_META[role]

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  return (
    <aside style={{
      width: '240px', height: '100%', display: 'flex', flexDirection: 'column',
      background: '#0a0a14', position: 'fixed', top: 0, left: 0, bottom: 0,
      zIndex: 50, borderRight: '1px solid #17172a',
    }}>

      {/* Logo */}
      <div style={{ padding: '20px 18px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '7px',
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Shield size={14} color="#fff" />
        </div>
        <div>
          <div style={{ color: '#f0f0f8', fontWeight: 800, fontSize: '0.85rem', letterSpacing: '-0.02em' }}>
            Platform OS
          </div>
          <div style={{ color: '#3a3a55', fontSize: '0.62rem', fontWeight: 600, marginTop: '1px' }}>
            Restaurant Suite
          </div>
        </div>
      </div>

      <div style={{ height: '1px', background: '#14142a', margin: '0 14px 8px' }} />

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 10px', display: 'flex', flexDirection: 'column', gap: '0' }}>
        {groups.map((group, gi) => (
          <div key={group.label} style={{ marginTop: gi > 0 ? '18px' : '4px' }}>
            <div style={{
              padding: '0 8px 6px',
              color: '#2e2e48', fontSize: '0.6rem', fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
              {group.label}
            </div>
            {group.items.map(item => {
              const active = isActive(item)
              return (
                <button
                  key={item.href}
                  onClick={() => onNavigate(item.href)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '9px',
                    padding: '7px 8px', borderRadius: '7px', border: 'none',
                    cursor: 'pointer', textAlign: 'left', fontSize: '0.83rem',
                    fontWeight: active ? 600 : 400,
                    background: active ? 'rgba(239,68,68,0.08)' : 'transparent',
                    color: active ? '#ef4444' : '#6868a0',
                    borderLeft: active ? '2px solid #ef4444' : '2px solid transparent',
                    marginLeft: '-2px',
                    transition: 'background 0.1s, color 0.1s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  <item.icon size={14} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {(item.badge ?? 0) > 0 && (
                    <span style={{
                      minWidth: '18px', height: '16px', borderRadius: '8px',
                      background: '#ef4444', color: '#fff',
                      fontSize: '0.6rem', fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 4px',
                    }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User profile */}
      <div style={{ padding: '10px 12px 18px', borderTop: '1px solid #14142a' }}>
        {role === 'owner' && (
          <button
            onClick={() => onNavigate('/admin')}
            style={{
              width: '100%', padding: '6px 8px', borderRadius: '6px', border: 'none',
              background: 'transparent', color: '#3a3a55', fontSize: '0.73rem',
              cursor: 'pointer', textAlign: 'left', marginBottom: '6px',
            }}
          >
            → Restaurant-Admin öffnen
          </button>
        )}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '8px 10px', borderRadius: '8px',
          background: '#0e0e1e', border: '1px solid #17172a',
        }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #1e1e35, #2a2a45)',
            border: '1px solid #2a2a42',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#8080b0', fontSize: '0.7rem', fontWeight: 700,
          }}>
            {initials(userEmail)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#a0a0c0', fontSize: '0.72rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userEmail}
            </div>
            <span style={{
              fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px',
              background: rm.bg, color: rm.color,
            }}>
              {rm.label}
            </span>
          </div>
          <button
            onClick={onLogout}
            title="Abmelden"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3a3a55', padding: '2px', flexShrink: 0 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#3a3a55' }}
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function PlatformSidebar({
  userEmail, role,
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
  const [open, setOpen] = useState(false)

  const groups = buildGroups(role, legalPendingCount, teamPendingCount, designRequestCount)

  function navigate(href: string) { router.push(href); setOpen(false) }
  async function logout() { await supabase.auth.signOut(); router.push('/team-login') }

  return (
    <>
      {/* Desktop */}
      <div className="ps-desktop">
        <SidebarInner groups={groups} pathname={pathname} role={role}
          userEmail={userEmail} onNavigate={navigate} onLogout={logout} />
      </div>

      {/* Mobile header */}
      <div className="ps-mobile-bar" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40, height: '52px',
        background: '#0a0a14', borderBottom: '1px solid #17172a',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: 'linear-gradient(135deg,#ef4444,#dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={12} color="#fff" />
          </div>
          <span style={{ color: '#f0f0f8', fontWeight: 800, fontSize: '0.82rem' }}>Platform OS</span>
        </div>
        <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', color: '#6868a0', cursor: 'pointer' }}>
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 45 }} />
          <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 55, width: '260px' }}>
            <SidebarInner groups={groups} pathname={pathname} role={role}
              userEmail={userEmail} onNavigate={navigate} onLogout={logout} />
          </div>
        </>
      )}

      <style>{`
        .ps-desktop { display: block; width: 240px; flex-shrink: 0; }
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
