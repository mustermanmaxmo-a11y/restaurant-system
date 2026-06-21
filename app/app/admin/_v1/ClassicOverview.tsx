'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Restaurant } from '@/types/database'
import type { RestaurantPlan } from '@/types/database'
import { TrialBanner } from '@/components/TrialBanner'
import type { LucideIcon } from 'lucide-react'
import {
  ClipboardList, UtensilsCrossed, Armchair, Users, CalendarDays,
  Clock, BarChart2, Package, Plug, CreditCard, PartyPopper,
  AlertTriangle, Mail, Building2, Truck, Tag, Palette,
  Settings, TrendingUp, ShoppingBag, Euro,
} from 'lucide-react'

type QuickStat = { label: string; value: string; icon: LucideIcon; color: string }

type CardDef = {
  icon: LucideIcon
  label: string
  desc: string
  href: string
  color: string
}

const CARD_GROUPS: { title: string; cards: CardDef[] }[] = [
  {
    title: 'Tagesbetrieb',
    cards: [
      { icon: ClipboardList,  label: 'Bestellungen',     desc: 'Live Bestelleingang',         href: '/admin/orders',        color: '#FF6B2C' },
      { icon: UtensilsCrossed,label: 'Menü',             desc: 'Gerichte & Kategorien',       href: '/admin/menu',          color: '#8b5cf6' },
      { icon: Tag,            label: 'Specials',         desc: 'Aktionen & Tagesangebote',    href: '/admin/specials',      color: '#f59e0b' },
      { icon: Armchair,       label: 'Tische & QR',      desc: 'Tischverwaltung & QR-Codes',  href: '/admin/tables',        color: '#10b981' },
      { icon: CalendarDays,   label: 'Reservierungen',   desc: 'Buchungen verwalten',         href: '/admin/reservations',  color: '#60a5fa' },
      { icon: Clock,          label: 'Öffnungszeiten',   desc: 'Zeiten & Schichten',          href: '/admin/opening-hours', color: '#a78bfa' },
    ],
  },
  {
    title: 'Verwaltung',
    cards: [
      { icon: Users,    label: 'Staff',        desc: 'Mitarbeiter & Rollen',    href: '/admin/staff',       color: '#34d399' },
      { icon: BarChart2, label: 'Statistik',   desc: 'Umsatz & Trends',         href: '/admin/stats',       color: '#fbbf24' },
      { icon: Package,  label: 'Lagerbestand', desc: 'Inventar verwalten',      href: '/admin/inventory',   color: '#fb923c' },
      { icon: Mail,     label: 'Marketing',    desc: 'Kampagnen & Kunden',      href: '/admin/marketing',   color: '#f472b6' },
      { icon: Truck,    label: 'Lieferanten',  desc: 'Einkauf & Lieferungen',   href: '/admin/suppliers',   color: '#38bdf8' },
    ],
  },
  {
    title: 'Konto',
    cards: [
      { icon: Palette,   label: 'Branding',      desc: 'Design & Darstellung',  href: '/admin/branding',     color: '#c084fc' },
      { icon: Plug,      label: 'Integrationen', desc: 'Apps & Verbindungen',   href: '/admin/integrations', color: '#4ade80' },
      { icon: CreditCard, label: 'Billing',      desc: 'Plan & Zahlungen',      href: '/admin/billing',      color: '#e879f9' },
      { icon: Settings,  label: 'Einstellungen', desc: 'Restaurant konfigurieren', href: '/admin/settings',  color: '#94a3b8' },
    ],
  },
]

function AdminContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const welcome = searchParams.get('welcome') === 'true'
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [restaurantCount, setRestaurantCount] = useState(1)
  const [stats, setStats] = useState<{ ordersToday: number; revenueToday: number; pendingOrders: number }>({
    ordersToday: 0, revenueToday: 0, pendingOrders: 0,
  })

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }

      const { data: allRestos } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: true })

      if (!allRestos || allRestos.length === 0) {
        router.push('/admin/setup')
        return
      }

      const data = allRestos[0]
      setRestaurantCount(allRestos.length)
      setRestaurant(data)
      setLoading(false)

      // Load today's stats
      const today = new Date().toISOString().split('T')[0]
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('total, status')
        .eq('restaurant_id', data.id)
        .gte('created_at', `${today}T00:00:00`)

      if (todayOrders) {
        const revenue = todayOrders.reduce((s, o) => s + (Number(o.total) || 0), 0)
        const pending = todayOrders.filter(o => o.status === 'new' || o.status === 'cooking').length
        setStats({ ordersToday: todayOrders.length, revenueToday: revenue, pendingOrders: pending })
      }
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
          <div className="skeleton" style={{ width: '120px', height: '14px' }} />
        </div>
      </div>
    )
  }

  if (!restaurant) return null

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 17 ? 'Guten Mittag' : 'Guten Abend'

  const quickStats: QuickStat[] = [
    { label: 'Bestellungen heute', value: String(stats.ordersToday), icon: ShoppingBag, color: '#FF6B2C' },
    { label: 'Umsatz heute',        value: `€ ${stats.revenueToday.toFixed(2)}`, icon: Euro,       color: '#10b981' },
    { label: 'Offen / In Arbeit',   value: String(stats.pendingOrders),           icon: TrendingUp, color: '#f59e0b' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '36px 28px 48px' }} className="fade-up">
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 500, marginBottom: '4px' }}>
                {greeting} —
              </p>
              <h1 style={{ color: 'var(--text)', fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                {restaurant.name}
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {restaurant.active ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  background: 'rgba(16,185,129,0.1)', color: '#10b981',
                  border: '1px solid rgba(16,185,129,0.25)',
                  borderRadius: '20px', padding: '4px 12px',
                  fontSize: '0.72rem', fontWeight: 700,
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  Aktiv
                </span>
              ) : (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: '20px', padding: '4px 12px',
                  fontSize: '0.72rem', fontWeight: 700,
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                  Inaktiv
                </span>
              )}
              {restaurantCount > 1 && (
                <button
                  onClick={() => router.push('/admin/overview')}
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '8px', padding: '5px 12px', cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <Building2 size={13} /> {restaurantCount} Standorte
                </button>
              )}
            </div>
          </div>
        </div>

        <TrialBanner plan={restaurant.plan as RestaurantPlan} trialEndsAt={restaurant.trial_ends_at} />

        {/* Welcome Banner */}
        {welcome && (
          <div style={{
            background: 'var(--accent-subtle)',
            border: '1px solid var(--border-accent)',
            borderRadius: '14px',
            padding: '20px 24px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'var(--accent)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}>
              <PartyPopper size={22} color="#fff" />
            </div>
            <div>
              <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '3px', fontSize: '0.95rem' }}>
                Willkommen bei RestaurantOS!
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                Dein Restaurant ist eingerichtet. Leg jetzt dein Menü an und generiere QR-Codes.
              </p>
            </div>
          </div>
        )}

        {/* Inactive Banner */}
        {!restaurant.active && (
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '14px',
            padding: '20px 24px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'rgba(239,68,68,0.12)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <AlertTriangle size={18} color="#ef4444" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: '#ef4444', fontWeight: 700, marginBottom: '3px', fontSize: '0.88rem' }}>
                Abo noch nicht aktiv
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Bitte schließe den Zahlungsvorgang ab um dein Restaurant zu aktivieren.
              </p>
            </div>
            <button
              onClick={() => router.push('/admin/setup')}
              style={{
                background: '#ef4444', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '8px 18px',
                fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', flexShrink: 0,
              }}
            >
              Plan abschließen →
            </button>
          </div>
        )}

        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '32px' }}>
          {quickStats.map((stat) => (
            <div key={stat.label} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: `${stat.color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <stat.icon size={18} color={stat.color} />
              </div>
              <div>
                <div style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.2rem', lineHeight: 1 }}>
                  {stat.value}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '3px' }}>
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Nav Card Groups */}
        {CARD_GROUPS.map(group => (
          <div key={group.title} style={{ marginBottom: '28px' }}>
            <h2 style={{
              color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: '12px',
            }}>
              {group.title}
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
              gap: '10px',
            }}>
              {group.cards.map(card => (
                <button
                  key={card.label}
                  onClick={() => router.push(card.href)}
                  className="admin-nav-card"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '18px 16px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, transform 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = card.color + '66'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '9px',
                    background: card.color + '18',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '12px',
                  }}>
                    <card.icon size={18} color={card.color} />
                  </div>
                  <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '2px' }}>
                    {card.label}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {card.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ClassicOverview() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
      <AdminContent />
    </Suspense>
  )
}
