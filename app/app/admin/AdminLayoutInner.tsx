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
  Utensils, Palette, ChefHat, Package, Tag, X, Menu, Settings,
  Mail, Truck, Plug,
} from 'lucide-react'
import AdminChatWidget from '@/components/AdminChatWidget'

type NavItem = { icon: React.ElementType; label: string; href: string }
type NavGroup = { label?: string; items: NavItem[] }

const PLAN_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  trial:      { label: 'Trial',      color: '#93c5fd', bg: 'rgba(96,165,250,0.15)' },
  starter:    { label: 'Starter',    color: '#6ee7b7', bg: 'rgba(52,211,153,0.15)' },
  pro:        { label: 'Pro',        color: '#fcd34d', bg: 'rgba(251,191,36,0.15)' },
  enterprise: { label: 'Enterprise', color: '#c4b5fd', bg: 'rgba(167,139,250,0.15)' },
  expired:    { label: 'Expired',    color: '#fca5a5', bg: 'rgba(248,113,113,0.15)' },
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

  const NAV_GROUPS: NavGroup[] = [
    {
      items: [
        { icon: LayoutDashboard, label: t('nav.overview'),   href: '/admin' },
        { icon: ChefHat,         label: t('nav.orders'),     href: '/admin/orders' },
      ],
    },
    {
      label: 'Restaurant',
      items: [
        { icon: UtensilsCrossed, label: t('nav.menu'),          href: '/admin/menu' },
        { icon: Tag,             label: t('nav.specials'),      href: '/admin/specials' },
        { icon: QrCode,          label: t('nav.tables'),        href: '/admin/tables' },
        { icon: CalendarDays,    label: t('nav.reservations'),  href: '/admin/reservations' },
        { icon: Clock,           label: t('nav.openingHours'),  href: '/admin/opening-hours' },
      ],
    },
    {
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
      label: 'Einstellungen',
      items: [
        { icon: Palette,  label: t('nav.branding'),  href: '/admin/branding' },
        { icon: Plug,     label: 'Integrationen',    href: '/admin/integrations' },
        { icon: CreditCard, label: t('nav.billing'), href: '/admin/billing' },
        { icon: Settings, label: 'Einstellungen',    href: '/admin/settings' },
      ],
    },
  ]

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/owner-login'); return }
      setUserId(session.user.id)
      setUserEmail(session.user.email ?? '')
      supabase.from('restaurants').select('id, name, plan').eq('owner_id', session.user.id).limit(1).maybeSingle()
        .then(({ data, error }) => {
          if (error) console.error('[AdminLayout] Failed to load restaurant:', error)
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

  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : '??'
  const planBadge = PLAN_BADGE[restaurantPlan] ?? PLAN_BADGE.starter

  const SidebarContent = () => (
    <aside style={{
      width: '240px',
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
    }}>
      {/* Brand */}
      <div style={{ padding: '22px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '9px',
            background: 'var(--accent)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            <Utensils size={16} color="#fff" />
          </div>
          <div>
            <div style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '0.88rem', letterSpacing: '-0.01em', lineHeight: 1 }}>
              RestaurantOS
            </div>
            {restaurantName && (
              <div style={{
                color: 'var(--sidebar-text)', fontSize: '0.7rem', fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '150px', marginTop: '2px',
              }}>
                {restaurantName}
              </div>
            )}
          </div>
        </div>

        {/* Plan badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '2px 8px', borderRadius: '5px',
          background: planBadge.bg,
          color: planBadge.color,
          fontSize: '0.62rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          marginLeft: '42px',
        }}>
          {planBadge.label}
        </div>
      </div>

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 16px 8px' }} />

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0' }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} style={{ marginBottom: '4px' }}>
            {group.label && (
              <div style={{
                color: 'rgba(255,255,255,0.22)',
                fontSize: '0.58rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                padding: '10px 12px 4px',
              }}>
                {group.label}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {group.items.map(item => {
                const isActive = pathname === item.href
                return (
                  <button
                    key={item.href}
                    onClick={() => { router.push(item.href); setMobileOpen(false) }}
                    className="sidebar-nav-btn"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px', borderRadius: '8px', border: 'none',
                      background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
                      color: isActive ? '#FFFFFF' : 'var(--sidebar-text)',
                      fontWeight: isActive ? 600 : 400,
                      fontSize: '0.84rem', cursor: 'pointer', width: '100%', textAlign: 'left',
                      borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                      transition: 'all 0.14s ease',
                    }}
                  >
                    <item.icon size={15} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '8px 8px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginBottom: '8px' }}>
          <button
            onClick={toggleTheme}
            className="sidebar-nav-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 12px', borderRadius: '8px', border: 'none',
              background: 'transparent', color: 'var(--sidebar-text)',
              fontSize: '0.84rem', cursor: 'pointer', width: '100%', textAlign: 'left',
            }}
          >
            {theme === 'dark' ? <Sun size={15} style={{ flexShrink: 0, opacity: 0.7 }} /> : <Moon size={15} style={{ flexShrink: 0, opacity: 0.7 }} />}
            {theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
          </button>
          <div style={{ padding: '4px 12px 4px' }}>
            <LanguageSelector />
          </div>
        </div>

        {/* User row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '8px 10px', borderRadius: '8px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'var(--accent)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
            fontSize: '0.65rem', fontWeight: 800, color: '#fff',
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {userEmail || restaurantName}
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Ausloggen"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.35)', padding: '2px',
              display: 'flex', alignItems: 'center',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Desktop Sidebar */}
      <div className="admin-sidebar-desktop">
        <SidebarContent />
      </div>

      {/* Mobile Header */}
      <div className="admin-mobile-header" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40,
        background: 'var(--sidebar-bg)', padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Utensils size={13} color="#fff" />
          </div>
          <span style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '0.85rem' }}>RestaurantOS</span>
        </div>
        <button onClick={() => setMobileOpen(o => !o)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '1.2rem', cursor: 'pointer', padding: '4px' }}>
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile Sidebar Drawer */}
      {mobileOpen && (
        <>
          <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 45 }} />
          <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50, width: '240px' }}>
            <SidebarContent />
          </div>
        </>
      )}

      {/* Main Content */}
      <main style={{ flex: 1, height: '100vh', overflowY: 'auto', overflowX: 'auto', minWidth: 0 }} className="admin-main">
        {children}
      </main>

      <style>{`
        .admin-sidebar-desktop { display: block; width: 240px; flex-shrink: 0; }
        .admin-mobile-header { display: none !important; }
        .admin-main { margin-left: 0; }
        @media (max-width: 768px) {
          .admin-sidebar-desktop { display: none !important; }
          .admin-mobile-header { display: flex !important; }
          .admin-main { padding-top: 56px; }
        }
      `}</style>

      {restaurantId && userId && (
        <PushNotificationBanner
          appContext="admin"
          restaurantId={restaurantId}
          userId={userId}
        />
      )}

      {restaurantId && (
        <AdminChatWidget restaurantId={restaurantId} plan={restaurantPlan} />
      )}
    </div>
  )
}
