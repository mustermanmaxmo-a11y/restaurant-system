'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/components/providers/theme-provider'
import {
  LayoutDashboard, UtensilsCrossed, QrCode, CalendarDays,
  Users, Clock, BarChart2, CreditCard, Sun, Moon, LogOut, Utensils, Palette, ChefHat, Package, Tag, Brain,
} from 'lucide-react'

const NAV = [
  { icon: LayoutDashboard, label: 'Übersicht',     href: '/admin' },
  { icon: ChefHat,         label: 'Bestellungen',  href: '/admin/orders' },
  { icon: UtensilsCrossed, label: 'Menü',           href: '/admin/menu' },
  { icon: Tag,             label: 'Tagesangebote', href: '/admin/specials' },
  { icon: QrCode,          label: 'Tische & QR',   href: '/admin/tables' },
  { icon: CalendarDays,    label: 'Reservierungen', href: '/admin/reservations' },
  { icon: Users,           label: 'Staff',          href: '/admin/staff' },
  { icon: Clock,           label: 'Öffnungszeiten', href: '/admin/opening-hours' },
  { icon: Palette,         label: 'Branding',       href: '/admin/branding' },
  { icon: Package,         label: 'Lagerbestand',   href: '/admin/inventory' },
  { icon: Brain,           label: 'KI-Tools',       href: '/admin/ki-tools' },
  { icon: BarChart2,       label: 'Statistik',      href: '/admin/stats' },
  { icon: CreditCard,      label: 'Billing',        href: '/admin/billing' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const [restaurantName, setRestaurantName] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      supabase.from('restaurants').select('name').eq('owner_id', session.user.id).limit(1).maybeSingle()
        .then(({ data }) => { if (data) setRestaurantName(data.name) })
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/owner-login')
  }

  // Skip layout on setup page
  if (pathname === '/admin/setup') return <>{children}</>

  const Sidebar = () => (
    <aside style={{
      width: '220px',
      height: '100%',
      background: 'var(--sidebar-bg)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0,
      left: 0,
      bottom: 0,
      zIndex: 50,
      borderRight: '1px solid rgba(255,255,255,0.05)',
    }}>
      {/* Brand */}
      <div style={{ padding: '24px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px',
            background: 'var(--accent)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
          }}><Utensils size={15} color="#fff" /></div>
          <span style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '0.85rem', letterSpacing: '-0.01em' }}>
            RestaurantOS
          </span>
        </div>
        {restaurantName && (
          <p style={{
            color: 'var(--sidebar-text)', fontSize: '0.72rem', marginLeft: '40px',
            fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{restaurantName}</p>
        )}
      </div>

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 16px 12px' }} />

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 8px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
        {NAV.map(item => {
          const isActive = pathname === item.href
          return (
            <button
              key={item.href}
              onClick={() => { router.push(item.href); setMobileOpen(false) }}
              className="sidebar-nav-btn"
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '8px', border: 'none',
                background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
                color: isActive ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.85rem', cursor: 'pointer', width: '100%', textAlign: 'left',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              }}
            >
              <item.icon size={15} style={{ flexShrink: 0 }} />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '12px 8px 20px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 8px 10px' }} />
        <button
          onClick={toggleTheme}
          className="sidebar-nav-btn"
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '9px 12px', borderRadius: '8px', border: 'none',
            background: 'transparent', color: 'var(--sidebar-text)',
            fontSize: '0.85rem', cursor: 'pointer', width: '100%', textAlign: 'left',
          }}
        >
          {theme === 'dark' ? <Sun size={15} style={{ flexShrink: 0 }} /> : <Moon size={15} style={{ flexShrink: 0 }} />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
        <button
          onClick={handleLogout}
          className="sidebar-nav-btn"
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '9px 12px', borderRadius: '8px', border: 'none',
            background: 'transparent', color: 'var(--sidebar-text)',
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
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Desktop Sidebar */}
      <div className="admin-sidebar-desktop">
        <Sidebar />
      </div>

      {/* Mobile Header */}
      <div className="admin-mobile-header" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40,
        background: 'var(--sidebar-bg)', padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Utensils size={13} color="#fff" /></div>
          <span style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '0.85rem' }}>RestaurantOS</span>
        </div>
        <button onClick={() => setMobileOpen(o => !o)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', padding: '4px' }}>
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Sidebar Drawer */}
      {mobileOpen && (
        <>
          <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 45 }} />
          <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50, width: '240px' }}>
            <Sidebar />
          </div>
        </>
      )}

      {/* Main Content */}
      <main style={{ flex: 1, minHeight: '100vh' }} className="admin-main">
        {children}
      </main>

      <style>{`
        .admin-sidebar-desktop { display: block; width: 220px; flex-shrink: 0; }
        .admin-mobile-header { display: none !important; }
        .admin-main { margin-left: 0; }
        @media (max-width: 768px) {
          .admin-sidebar-desktop { display: none !important; }
          .admin-mobile-header { display: flex !important; }
          .admin-main { padding-top: 56px; }
        }
      `}</style>
    </div>
  )
}
