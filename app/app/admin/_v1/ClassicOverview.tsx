'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Restaurant } from '@/types/database'
import type { RestaurantPlan, Reservation } from '@/types/database'
import { TrialBanner } from '@/components/TrialBanner'
import type { LucideIcon } from 'lucide-react'
import {
  ClipboardList, UtensilsCrossed, Armchair, Users, CalendarDays,
  Clock, BarChart2, Package, Plug, CreditCard, PartyPopper,
  AlertTriangle, Mail, Building2, Truck, Tag, Palette, Settings,
  ShoppingBag, Euro, Flame, ArrowRight, ChefHat, Monitor, History, UserRound,
} from 'lucide-react'

type Order = { id: string; total: number; status: string; created_at: string; customer_name?: string; order_type?: string }
type DayBucket = { day: string; short: string; revenue: number; count: number }

type CardDef = { icon: LucideIcon; label: string; desc: string; href: string; color: string }

const CARD_GROUPS: { title: string; cards: CardDef[] }[] = [
  {
    title: 'Tagesbetrieb',
    cards: [
      { icon: ClipboardList,   label: 'Bestellungen',    desc: 'Live Bestelleingang',       href: '/admin/orders',        color: '#FF6B2C' },
      { icon: UtensilsCrossed, label: 'Menü',            desc: 'Gerichte & Kategorien',     href: '/admin/menu',          color: '#8b5cf6' },
      { icon: Tag,             label: 'Specials',        desc: 'Aktionen & Tagesangebote',  href: '/admin/specials',      color: '#f59e0b' },
      { icon: Armchair,        label: 'Tische & QR',     desc: 'Tischplan & QR-Codes',      href: '/admin/tables',        color: '#10b981' },
      { icon: CalendarDays,    label: 'Reservierungen',  desc: 'Buchungen verwalten',       href: '/admin/reservations',  color: '#60a5fa' },
      { icon: Clock,           label: 'Öffnungszeiten',  desc: 'Zeiten & Schichten',        href: '/admin/opening-hours', color: '#a78bfa' },
    ],
  },
  {
    title: 'Verwaltung',
    cards: [
      { icon: Users,     label: 'Staff',        desc: 'Mitarbeiter & Rollen',  href: '/admin/staff',       color: '#34d399' },
      { icon: BarChart2, label: 'Statistik',    desc: 'Umsatz & Trends',       href: '/admin/stats',       color: '#fbbf24' },
      { icon: Package,   label: 'Lagerbestand', desc: 'Inventar verwalten',    href: '/admin/inventory',   color: '#fb923c' },
      { icon: Mail,      label: 'Marketing',    desc: 'Kampagnen & Kunden',    href: '/admin/marketing',   color: '#f472b6' },
      { icon: Truck,     label: 'Lieferanten',  desc: 'Einkauf & Bestellungen',href: '/admin/suppliers',   color: '#38bdf8' },
    ],
  },
  {
    title: 'Konto',
    cards: [
      { icon: Palette,    label: 'Branding',      desc: 'Design & Darstellung',  href: '/admin/branding',     color: '#c084fc' },
      { icon: Plug,       label: 'Integrationen', desc: 'Apps & Verbindungen',   href: '/admin/integrations', color: '#4ade80' },
      { icon: CreditCard, label: 'Billing',       desc: 'Plan & Zahlungen',      href: '/admin/billing',      color: '#e879f9' },
      { icon: Settings,   label: 'Einstellungen', desc: 'Konfiguration',         href: '/admin/settings',     color: '#94a3b8' },
    ],
  },
]

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  new:              { label: 'Neu',       color: '#FF6B2C', bg: '#FF6B2C18' },
  cooking:          { label: 'In Arbeit', color: '#f59e0b', bg: '#f59e0b18' },
  out_for_delivery: { label: 'Unterwegs', color: '#60a5fa', bg: '#60a5fa18' },
  served:           { label: 'Serviert',  color: '#10b981', bg: '#10b98118' },
  cancelled:        { label: 'Storniert', color: '#ef4444', bg: '#ef444418' },
}

const DAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

function buildWeekBuckets(orders: Order[]): DayBucket[] {
  const today = new Date()
  const buckets: DayBucket[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().split('T')[0]
    buckets.push({ day: key, short: DAY_LABELS[d.getDay()], revenue: 0, count: 0 })
  }
  for (const o of orders) {
    const day = o.created_at.split('T')[0]
    const b = buckets.find(x => x.day === day)
    if (b) { b.revenue += Number(o.total) || 0; b.count++ }
  }
  return buckets
}

function RevenueBar({ buckets, maxRev }: { buckets: DayBucket[]; maxRev: number }) {
  const today = new Date().toISOString().split('T')[0]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px' }}>
      {buckets.map(b => {
        const isToday = b.day === today
        const pct = maxRev > 0 ? (b.revenue / maxRev) * 100 : 0
        return (
          <div key={b.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div
              title={`${b.short}: €${b.revenue.toFixed(2)} · ${b.count} Bestellungen`}
              style={{
                width: '100%', borderRadius: '4px 4px 0 0',
                height: `${Math.max(pct, 4)}%`,
                background: isToday ? 'var(--accent)' : 'var(--border)',
                transition: 'height 0.5s cubic-bezier(0.22,1,0.36,1)',
                boxShadow: isToday ? '0 0 10px var(--border-accent)' : 'none',
                minHeight: '4px',
              }}
            />
            <span style={{
              fontSize: '0.58rem', fontWeight: isToday ? 700 : 400,
              color: isToday ? 'var(--accent)' : 'var(--text-muted)',
            }}>
              {b.short}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function AdminContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const welcome = searchParams.get('welcome') === 'true'
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [restaurantCount, setRestaurantCount] = useState(1)
  const [todayOrders, setTodayOrders] = useState<Order[]>([])
  const [weekOrders, setWeekOrders] = useState<Order[]>([])
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [todayReservations, setTodayReservations] = useState<Reservation[]>([])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }

      const { data: allRestos } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: true })

      if (!allRestos || allRestos.length === 0) { router.push('/admin/setup'); return }

      const data = allRestos[0]
      setRestaurantCount(allRestos.length)
      setRestaurant(data)
      setLoading(false)

      const today = new Date().toISOString().split('T')[0]
      const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()

      const [{ data: todayData }, { data: weekData }, { data: recentData }, { data: reservData }] = await Promise.all([
        supabase.from('orders').select('id, total, status, created_at, customer_name, order_type')
          .eq('restaurant_id', data.id).gte('created_at', `${today}T00:00:00`),
        supabase.from('orders').select('id, total, status, created_at')
          .eq('restaurant_id', data.id).gte('created_at', weekAgo),
        supabase.from('orders').select('id, total, status, created_at, customer_name, order_type')
          .eq('restaurant_id', data.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('reservations').select('*')
          .eq('restaurant_id', data.id).eq('date', today)
          .not('status', 'eq', 'cancelled').order('time_from', { ascending: true }),
      ])

      setTodayOrders((todayData as Order[]) || [])
      setWeekOrders((weekData as Order[]) || [])
      setRecentOrders((recentData as Order[]) || [])
      setTodayReservations((reservData as Reservation[]) || [])
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="skeleton" style={{ width: '120px', height: '14px', borderRadius: '8px' }} />
      </div>
    )
  }

  if (!restaurant) return null

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 17 ? 'Guten Tag' : 'Guten Abend'

  const revenueToday = todayOrders.reduce((s, o) => s + (Number(o.total) || 0), 0)
  const pendingOrders = todayOrders.filter(o => o.status === 'new' || o.status === 'cooking').length

  const weekBuckets = buildWeekBuckets(weekOrders)
  const maxRev = Math.max(...weekBuckets.map(b => b.revenue), 1)
  const weekRevenue = weekOrders.reduce((s, o) => s + (Number(o.total) || 0), 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 16px 56px' }} className="fade-up">
      <style>{`
        @media (min-width: 640px) { .admin-dash-wrap { padding: 32px 28px 56px !important; } }
        @media (max-width: 639px) { .admin-kpi-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 400px) { .admin-kpi-grid { grid-template-columns: 1fr !important; } }
      `}</style>
      <div style={{ maxWidth: '920px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 500, marginBottom: '2px' }}>
            {greeting}
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <h1 style={{ color: 'var(--text)', fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.025em', margin: 0 }}>
              {restaurant.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {restaurant.active ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  background: '#10b98115', color: '#10b981',
                  border: '1px solid #10b98128', borderRadius: '20px',
                  padding: '4px 11px', fontSize: '0.72rem', fontWeight: 700,
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  Aktiv
                </span>
              ) : (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  background: '#ef444415', color: '#ef4444',
                  border: '1px solid #ef444428', borderRadius: '20px',
                  padding: '4px 11px', fontSize: '0.72rem', fontWeight: 700,
                }}>
                  Inaktiv
                </span>
              )}
              {restaurantCount > 1 && (
                <button onClick={() => router.push('/admin/overview')} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '4px 11px', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  <Building2 size={12} /> {restaurantCount} Standorte
                </button>
              )}
            </div>
          </div>
        </div>

        <TrialBanner plan={restaurant.plan as RestaurantPlan} trialEndsAt={restaurant.trial_ends_at} />

        {/* Welcome Banner */}
        {welcome && (
          <div style={{
            background: 'var(--accent-subtle)', border: '1px solid var(--border-accent)',
            borderRadius: '14px', padding: '18px 22px', marginBottom: '24px',
            display: 'flex', alignItems: 'center', gap: '14px',
          }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <PartyPopper size={20} color="#fff" />
            </div>
            <div>
              <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '2px', fontSize: '0.92rem' }}>Willkommen bei RestaurantOS!</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Dein Restaurant ist eingerichtet. Leg jetzt dein Menü an und generiere QR-Codes.</p>
            </div>
          </div>
        )}

        {/* Inactive Banner */}
        {!restaurant.active && (
          <div style={{
            background: '#ef444410', border: '1px solid #ef444425',
            borderRadius: '14px', padding: '18px 22px', marginBottom: '24px',
            display: 'flex', alignItems: 'center', gap: '14px',
          }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#ef444415', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={18} color="#ef4444" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: '#ef4444', fontWeight: 700, marginBottom: '2px', fontSize: '0.88rem' }}>Abo noch nicht aktiv</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Bitte schließe den Zahlungsvorgang ab.</p>
            </div>
            <button onClick={() => router.push('/admin/setup')} style={{
              background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '8px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', flexShrink: 0,
            }}>
              Plan abschließen →
            </button>
          </div>
        )}

        {/* KPI + Chart row */}
        <div className="admin-kpi-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.6fr', gap: '12px', marginBottom: '24px' }}>
          {/* KPI cards */}
          {[
            { label: 'Bestellungen heute', value: String(todayOrders.length), icon: ShoppingBag, color: 'var(--accent)' },
            { label: 'Umsatz heute',       value: `€ ${revenueToday.toFixed(2)}`, icon: Euro, color: '#10b981' },
            { label: 'Offen / Aktiv',      value: String(pendingOrders), icon: Flame, color: '#f59e0b', alert: pendingOrders > 0 },
          ].map(kpi => (
            <div key={kpi.label} style={{
              background: 'var(--surface)', border: `1px solid ${kpi.alert ? '#f59e0b33' : 'var(--border)'}`,
              borderRadius: '14px', padding: '18px 16px',
              display: 'flex', flexDirection: 'column', gap: '10px',
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '9px',
                background: kpi.alert ? '#f59e0b18' : 'var(--surface-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <kpi.icon size={17} color={kpi.color} />
              </div>
              <div>
                <div style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.4rem', lineHeight: 1 }}>{kpi.value}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '3px' }}>{kpi.label}</div>
              </div>
            </div>
          ))}

          {/* 7-day revenue chart */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>7 Tage</div>
                <div style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>€ {weekRevenue.toFixed(0)}</div>
              </div>
              <button onClick={() => router.push('/admin/stats')} style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px',
                padding: '3px 8px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.7rem',
                display: 'flex', alignItems: 'center', gap: '3px',
              }}>
                Details <ArrowRight size={10} />
              </button>
            </div>
            <RevenueBar buckets={weekBuckets} maxRev={maxRev} />
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/admin/kds')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.25)', borderRadius: '10px', padding: '10px 16px', cursor: 'pointer', color: '#ff6b35', fontWeight: 700, fontSize: '0.82rem', transition: 'background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,107,53,0.18)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,107,53,0.1)' }}
          >
            <Monitor size={15} /> Küchen-Display öffnen
          </button>
          <button onClick={() => router.push('/admin/orders/history')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', padding: '10px 16px', cursor: 'pointer', color: '#f59e0b', fontWeight: 700, fontSize: '0.82rem', transition: 'background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.18)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.1)' }}
          >
            <History size={15} /> Bestellhistorie
          </button>
          <button onClick={() => router.push('/admin/orders')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 16px', cursor: 'pointer', color: 'var(--text)', fontWeight: 600, fontSize: '0.82rem' }}>
            <ChefHat size={15} /> Bestellungen Live
          </button>
        </div>

        {/* Recent orders */}
        {recentOrders.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', marginBottom: '28px', overflow: 'hidden' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ChefHat size={16} color="var(--accent)" />
                <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.88rem' }}>Letzte Bestellungen</span>
              </div>
              <button onClick={() => router.push('/admin/orders')} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)',
                fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px',
              }}>
                Alle anzeigen <ArrowRight size={12} />
              </button>
            </div>
            {recentOrders.map((order, idx) => {
              const meta = STATUS_META[order.status] ?? STATUS_META.new
              return (
                <div key={order.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '13px 20px',
                  borderBottom: idx < recentOrders.length - 1 ? '1px solid var(--border)' : 'none',
                  gap: '12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700,
                      color: meta.color, background: meta.bg, padding: '2px 6px', borderRadius: '4px',
                    }}>
                      #{order.id.slice(-4).toUpperCase()}
                    </span>
                    <span style={{ color: 'var(--text)', fontSize: '0.82rem', fontWeight: 600 }}>
                      {order.customer_name || '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      background: meta.bg, color: meta.color,
                      border: `1px solid ${meta.color}33`,
                      borderRadius: '20px', padding: '2px 9px',
                      fontSize: '0.7rem', fontWeight: 600,
                    }}>
                      {meta.label}
                    </span>
                    <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.85rem', minWidth: '56px', textAlign: 'right' }}>
                      € {Number(order.total).toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Today's Reservations */}
        {todayReservations.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', marginBottom: '28px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarDays size={16} color="#60a5fa" />
                <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.88rem' }}>
                  Reservierungen heute
                </span>
                <span style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', borderRadius: '20px', padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700 }}>
                  {todayReservations.length}
                </span>
              </div>
              <button onClick={() => router.push('/admin/reservations')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#60a5fa', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                Alle <ArrowRight size={12} />
              </button>
            </div>
            {todayReservations.slice(0, 5).map((r, idx) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: idx < Math.min(todayReservations.length, 5) - 1 ? '1px solid var(--border)' : 'none', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(96,165,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UserRound size={15} color="#60a5fa" />
                  </div>
                  <div>
                    <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.83rem' }}>{r.customer_name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '1px' }}>
                      {r.guests} Gäste{r.note ? ` · ${r.note}` : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.85rem' }}>
                    {r.time_from}
                  </span>
                  <span style={{
                    background: r.status === 'confirmed' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                    color: r.status === 'confirmed' ? '#10b981' : '#f59e0b',
                    borderRadius: '6px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700,
                  }}>
                    {r.status === 'confirmed' ? 'Bestätigt' : 'Ausstehend'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Nav Card Groups */}
        {CARD_GROUPS.map(group => (
          <div key={group.title} style={{ marginBottom: '28px' }}>
            <h2 style={{
              color: 'var(--text-muted)', fontSize: '0.66rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px',
            }}>
              {group.title}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: '10px' }}>
              {group.cards.map(card => (
                <button
                  key={card.label}
                  onClick={() => router.push(card.href)}
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '13px', padding: '16px 14px',
                    textAlign: 'left', cursor: 'pointer',
                    transition: 'border-color 0.14s, transform 0.14s, background 0.14s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = card.color + '55'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.background = card.color + '08'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.background = 'var(--surface)'
                  }}
                >
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '9px',
                    background: card.color + '18',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '11px',
                  }}>
                    <card.icon size={17} color={card.color} />
                  </div>
                  <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.86rem', marginBottom: '2px' }}>{card.label}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.73rem' }}>{card.desc}</div>
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
