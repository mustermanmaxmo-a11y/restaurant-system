'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/components/providers/theme-provider'
import { LanguageSelector } from '@/components/ui/language-selector'
import { useLanguage } from '@/components/providers/language-provider'
import { PushNotificationBanner } from '@/components/PushNotificationBanner'
import {
  LayoutDashboard, UtensilsCrossed, QrCode, CalendarDays,
  Users, Clock, BarChart2, CreditCard, Sun, Moon, LogOut,
  Utensils, Palette, ChefHat, Package, Tag, X, Menu as MenuIcon,
  Settings, Mail, Truck, Plug, ChevronDown, ChevronRight,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import AdminChatWidget from '@/components/AdminChatWidget'

type NavItem = { icon: React.ElementType; label: string; href: string }
type NavGroup = { id: string; label?: string; items: NavItem[] }

const PLAN_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  trial:      { label: 'Trial',      color: '#93c5fd', bg: 'rgba(96,165,250,0.18)' },
  starter:    { label: 'Starter',    color: '#6ee7b7', bg: 'rgba(52,211,153,0.18)' },
  pro:        { label: 'Pro',        color: '#fcd34d', bg: 'rgba(251,191,36,0.18)' },
  enterprise: { label: 'Enterprise', color: '#c4b5fd', bg: 'rgba(167,139,250,0.18)' },
  expired:    { label: 'Expired',    color: '#fca5a5', bg: 'rgba(248,113,113,0.18)' },
}

export default function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const { t } = useLanguage()
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [restaurantPlan, setRestaurantPlan] = useState<string>('starter')
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['core', 'restaurant', 'management', 'account']))

  useEffect(() => {
    const stored = localStorage.getItem('admin-sb-collapsed')
    if (stored === 'true') setCollapsed(true)
  }, [])

  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('admin-sb-collapsed', String(next))
  }

  function toggleGroup(id: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const NAV_GROUPS: NavGroup[] = [
    {
      id: 'core',
      items: [
        { icon: LayoutDashboard, label: t('nav.overview'),  href: '/admin' },
        { icon: ChefHat,         label: t('nav.orders'),    href: '/admin/orders' },
      ],
    },
    {
      id: 'restaurant',
      label: 'Restaurant',
      items: [
        { icon: UtensilsCrossed, label: t('nav.menu'),         href: '/admin/menu' },
        { icon: Tag,             label: t('nav.specials'),     href: '/admin/specials' },
        { icon: QrCode,          label: t('nav.tables'),       href: '/admin/tables' },
        { icon: CalendarDays,    label: t('nav.reservations'), href: '/admin/reservations' },
        { icon: Clock,           label: t('nav.openingHours'), href: '/admin/opening-hours' },
      ],
    },
    {
      id: 'management',
      label: 'Verwaltung',
      items: [
        { icon: Users,    label: t('nav.staff'),     href: '/admin/staff' },
        { icon: BarChart2, label: t('nav.stats'),    href: '/admin/stats' },
        { icon: Package,  label: t('nav.inventory'), href: '/admin/inventory' },
        { icon: Mail,     label: 'Marketing',        href: '/admin/marketing' },
        { icon: Truck,    label: 'Lieferanten',      href: '/admin/suppliers' },
      ],
    },
    {
      id: 'account',
      label: 'Konto',
      items: [
        { icon: Palette,    label: t('nav.branding'),  href: '/admin/branding' },
        { icon: Plug,       label: 'Integrationen',    href: '/admin/integrations' },
        { icon: CreditCard, label: t('nav.billing'),   href: '/admin/billing' },
        { icon: Settings,   label: 'Einstellungen',    href: '/admin/settings' },
      ],
    },
  ]

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/owner-login'); return }
      setUserId(session.user.id)
      setUserEmail(session.user.email ?? '')
      supabase
        .from('restaurants')
        .select('id, name, plan')
        .eq('owner_id', session.user.id)
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setRestaurantName(data.name)
            setRestaurantId(data.id)
            setRestaurantPlan(data.plan || 'starter')
          }
        })
    })
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/owner-login')
  }

  if (pathname === '/admin/setup') return <>{children}</>

  const sidebarW = collapsed ? 56 : 240
  const transition = 'width 0.22s cubic-bezier(0.4,0,0.2,1)'
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : '??'
  const planBadge = PLAN_BADGE[restaurantPlan] ?? PLAN_BADGE.starter

  const SidebarContent = ({ inDrawer = false }: { inDrawer?: boolean }) => {
    const w = inDrawer ? 240 : sidebarW
    const isCollapsed = inDrawer ? false : collapsed

    return (
      <aside style={{
        width: `${w}px`,
        height: '100%',
        background: 'var(--sidebar-bg)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 50,
        borderRight: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
        transition,
      }}>
        {/* Brand */}
        <div style={{ padding: '18px 12px 12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                background: 'var(--accent)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}>
                <Utensils size={16} color="#fff" />
              </div>
              {!isCollapsed && (
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: '0.85rem', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                    RestaurantOS
                  </div>
                  {restaurantName && (
                    <div style={{ color: 'var(--sidebar-text)', fontSize: '0.68rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>
                      {restaurantName}
                    </div>
                  )}
                </div>
              )}
            </div>
            {!isCollapsed && (
              <button
                onClick={inDrawer ? undefined : toggleCollapse}
                title="Sidebar einklappen"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sidebar-text)', padding: '4px', display: 'flex', flexShrink: 0 }}
              >
                <PanelLeftClose size={15} />
              </button>
            )}
          </div>

          {/* Plan badge + expand button when collapsed */}
          {isCollapsed ? (
            <button
              onClick={toggleCollapse}
              title="Sidebar ausklappen"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sidebar-text)', padding: '4px', display: 'flex', margin: '6px auto 0', width: '100%', justifyContent: 'center' }}
            >
              <PanelLeftOpen size={15} />
            </button>
          ) : (
            <div style={{
              display: 'inline-flex', alignItems: 'center', marginTop: '8px', marginLeft: '42px',
              padding: '2px 8px', borderRadius: '5px',
              background: planBadge.bg, color: planBadge.color,
              fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
            }}>
              {planBadge.label}
            </div>
          )}
        </div>

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 12px 6px', flexShrink: 0 }} />

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0 6px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {NAV_GROUPS.map(group => {
            const isExpanded = expandedGroups.has(group.id)
            const hasActive = group.items.some(i => i.href === pathname)

            return (
              <div key={group.id} style={{ marginBottom: '2px' }}>
                {/* Group header */}
                {group.label && !isCollapsed && (
                  <button
                    onClick={() => toggleGroup(group.id)}
                    style={{
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px 4px',
                      color: hasActive && !isExpanded ? 'var(--sidebar-active-text)' : 'rgba(255,255,255,0.28)',
                    }}
                  >
                    <span style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {group.label}
                    </span>
                    {isExpanded
                      ? <ChevronDown size={11} />
                      : <ChevronRight size={11} />
                    }
                  </button>
                )}

                {/* Items */}
                <div style={{
                  overflow: 'hidden',
                  maxHeight: (!group.label || isExpanded || isCollapsed) ? '1200px' : '0px',
                  transition: 'max-height 0.22s cubic-bezier(0.4,0,0.2,1)',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', paddingBottom: '4px' }}>
                    {group.items.map(item => {
                      const isActive = pathname === item.href
                      return (
                        <button
                          key={item.href}
                          onClick={() => { router.push(item.href); setMobileOpen(false) }}
                          className="sidebar-nav-btn"
                          title={isCollapsed ? item.label : undefined}
                          style={{
                            display: 'flex', alignItems: 'center',
                            gap: isCollapsed ? 0 : '10px',
                            justifyContent: isCollapsed ? 'center' : 'flex-start',
                            padding: isCollapsed ? '10px 0' : '8px 10px',
                            borderRadius: '8px', border: 'none',
                            background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
                            color: isActive ? '#fff' : 'var(--sidebar-text)',
                            fontWeight: isActive ? 600 : 400,
                            fontSize: '0.83rem', cursor: 'pointer', width: '100%', textAlign: 'left',
                            borderLeft: isActive && !isCollapsed ? '2px solid var(--accent)' : '2px solid transparent',
                            boxShadow: isActive && isCollapsed ? `inset 2px 0 0 var(--accent)` : 'none',
                            transition: 'all 0.14s ease',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <item.icon size={15} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.65 }} />
                          {!isCollapsed && <span>{item.label}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </nav>

        {/* Bottom */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 6px 12px', flexShrink: 0 }}>
          {!isCollapsed && (
            <>
              <button
                onClick={toggleTheme}
                className="sidebar-nav-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 10px', borderRadius: '8px', border: 'none',
                  background: 'transparent', color: 'var(--sidebar-text)',
                  fontSize: '0.83rem', cursor: 'pointer', width: '100%', textAlign: 'left', marginBottom: '2px',
                }}
              >
                {theme === 'dark' ? <Sun size={15} style={{ flexShrink: 0, opacity: 0.65 }} /> : <Moon size={15} style={{ flexShrink: 0, opacity: 0.65 }} />}
                {theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
              </button>
              <div style={{ padding: '2px 10px 6px' }}>
                <LanguageSelector />
              </div>
            </>
          )}

          {/* User row */}
          <div style={{
            display: 'flex', alignItems: 'center',
            gap: isCollapsed ? 0 : '9px',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            padding: isCollapsed ? '6px 0' : '7px 8px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div
              title={isCollapsed ? userEmail : undefined}
              style={{
                width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '0.62rem', fontWeight: 800, color: '#fff',
              }}
            >
              {initials}
            </div>
            {!isCollapsed && (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {userEmail || restaurantName}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  title="Ausloggen"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.3)', padding: '2px',
                    display: 'flex', alignItems: 'center', transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                >
                  <LogOut size={14} />
                </button>
              </>
            )}
          </div>

          {isCollapsed && (
            <button
              onClick={handleLogout}
              title="Ausloggen"
              className="sidebar-nav-btn"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '8px 0', borderRadius: '8px', border: 'none', marginTop: '4px',
                background: 'transparent', color: 'rgba(255,255,255,0.3)',
                cursor: 'pointer', width: '100%',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
      </aside>
    )
  }

  // Helper to read collapsed in render (outside SidebarContent)
  const isCollapsed = collapsed

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Desktop sidebar spacer + fixed sidebar */}
      <div
        className="admin-sb-desktop"
        style={{ width: `${sidebarW}px`, flexShrink: 0, transition }}
      >
        <SidebarContent />
      </div>

      {/* Mobile Header */}
      <div className="admin-mobile-header" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40,
        background: 'var(--sidebar-bg)', padding: '13px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Utensils size={13} color="#fff" />
          </div>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.85rem' }}>RestaurantOS</span>
        </div>
        <button onClick={() => setMobileOpen(o => !o)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '4px', display: 'flex' }}>
          {mobileOpen ? <X size={18} /> : <MenuIcon size={18} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <>
          <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 45 }} />
          <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50, width: '240px' }}>
            <SidebarContent inDrawer />
          </div>
        </>
      )}

      {/* Main */}
      <main className="admin-main" style={{ flex: 1, height: '100vh', overflowY: 'auto', overflowX: 'auto', minWidth: 0 }}>
        {children}
      </main>

      <style>{`
        .admin-sb-desktop { display: block; }
        .admin-mobile-header { display: none !important; }
        .admin-main { margin-left: 0; }
        @media (max-width: 768px) {
          .admin-sb-desktop { display: none !important; }
          .admin-mobile-header { display: flex !important; }
          .admin-main { padding-top: 54px; }
        }
      `}</style>

      {restaurantId && userId && (
        <PushNotificationBanner appContext="admin" restaurantId={restaurantId} userId={userId} />
      )}
      {restaurantId && (
        <AdminChatWidget restaurantId={restaurantId} plan={restaurantPlan} />
      )}
    </div>
  )
}
