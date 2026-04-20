'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Restaurant, RestaurantPlan } from '@/types/database'
import { TrialBanner } from '@/components/TrialBanner'
import {
  ClipboardList,
  UtensilsCrossed,
  Armchair,
  Users,
  CalendarDays,
  Clock,
  BarChart2,
  Package,
  Plug,
  CreditCard,
  Sparkles,
  TrendingUp,
  Euro,
  ArrowUpRight,
  PartyPopper,
  AlertTriangle,
} from 'lucide-react'

const V2 = {
  bg: '#0A0A0F',
  surface: '#111118',
  surfaceHover: '#16213e',
  border: '#1F1F28',
  accent: '#EA580C',
  accentGlow: '#EA580C40',
  accentHover: '#F97316',
  text: '#F5F5F7',
  muted: '#8B8B93',
  gradient: 'linear-gradient(135deg, #EA580C, #F97316)',
  radius: 16,
}

type KPIs = {
  ordersToday: number
  revenueToday: number
  reservationsToday: number
  openOrders: number
}

function BentoContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const welcome = searchParams.get('welcome') === 'true'
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [kpis, setKpis] = useState<KPIs>({
    ordersToday: 0,
    revenueToday: 0,
    reservationsToday: 0,
    openOrders: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/owner-login')
        return
      }

      const { data: rest } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', session.user.id)
        .limit(1)
        .maybeSingle()

      if (!rest) {
        router.push('/admin/setup')
        return
      }
      setRestaurant(rest)

      const today = new Date().toISOString().slice(0, 10)
      const startOfDay = `${today}T00:00:00`

      const [ordersRes, openRes, resRes] = await Promise.all([
        supabase
          .from('orders')
          .select('total_price, status, created_at')
          .eq('restaurant_id', rest.id)
          .gte('created_at', startOfDay),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', rest.id)
          .in('status', ['new', 'cooking']),
        supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', rest.id)
          .eq('date', today),
      ])

      const orders = ordersRes.data ?? []
      const ordersToday = orders.length
      const revenueToday = orders.reduce(
        (sum, o) => sum + (typeof o.total_price === 'number' ? o.total_price : 0),
        0,
      )

      setKpis({
        ordersToday,
        revenueToday,
        reservationsToday: resRes.count ?? 0,
        openOrders: openRes.count ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: V2.bg,
          color: V2.muted,
          fontFamily: 'var(--font-geist), system-ui, sans-serif',
        }}
      >
        Lädt…
      </div>
    )
  }

  if (!restaurant) return null

  const euroFmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

  return (
    <div
      style={{
        minHeight: '100vh',
        background: V2.bg,
        color: V2.text,
        padding: '32px 24px',
        fontFamily: 'var(--font-geist), system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div
          className="bento-hero-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 2fr) minmax(240px, 1fr)',
            gap: '20px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              background: V2.gradient,
              borderRadius: `${V2.radius}px`,
              padding: '32px',
              boxShadow: `0 20px 60px ${V2.accentGlow}`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '999px',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                marginBottom: '18px',
              }}
            >
              <Sparkles size={11} /> V2 Bento Premium
            </div>
            <h1
              style={{
                fontSize: '2.2rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              {restaurant.name}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', marginTop: '10px' }}>
              Plan <strong style={{ textTransform: 'uppercase' }}>{restaurant.plan}</strong>
              {' · '}
              {restaurant.active ? 'aktiv' : 'inaktiv'}
            </p>
          </div>

          <div
            style={{
              background: V2.surface,
              border: `1px solid ${V2.border}`,
              borderRadius: `${V2.radius}px`,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  color: V2.muted,
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  fontWeight: 700,
                }}
              >
                Offene Bestellungen
              </div>
              <div
                style={{
                  fontSize: '2.5rem',
                  fontWeight: 800,
                  marginTop: '8px',
                  color: V2.text,
                }}
              >
                {kpis.openOrders}
              </div>
            </div>
            <button
              onClick={() => router.push('/admin/orders')}
              style={{
                marginTop: '18px',
                background: 'transparent',
                border: `1px solid ${V2.border}`,
                color: V2.text,
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontFamily: 'inherit',
              }}
            >
              Zu den Bestellungen <ArrowUpRight size={14} />
            </button>
          </div>
        </div>

        {welcome && (
          <BannerCard
            icon={<PartyPopper size={22} color={V2.accent} />}
            title="Willkommen bei RestaurantOS!"
            desc="Dein Restaurant ist eingerichtet. Leg jetzt dein Menü an und generiere QR-Codes."
          />
        )}

        {!restaurant.active && (
          <BannerCard
            icon={<AlertTriangle size={22} color="#ef4444" />}
            title="Abo noch nicht aktiv"
            desc="Bitte schließe den Zahlungsvorgang ab um dein Restaurant zu aktivieren."
            ctaLabel="Plan abschließen"
            onCta={() => router.push('/admin/setup')}
            tone="danger"
          />
        )}

        <TrialBanner plan={restaurant.plan as RestaurantPlan} trialEndsAt={restaurant.trial_ends_at} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginTop: '20px',
            marginBottom: '20px',
          }}
        >
          <KpiCard icon={<ClipboardList size={18} />} label="Bestellungen heute" value={String(kpis.ordersToday)} accent={V2.accent} />
          <KpiCard icon={<Euro size={18} />} label="Umsatz heute" value={euroFmt.format(kpis.revenueToday)} accent="#10b981" />
          <KpiCard icon={<CalendarDays size={18} />} label="Reservierungen heute" value={String(kpis.reservationsToday)} accent="#6366f1" />
          <KpiCard icon={<TrendingUp size={18} />} label="Status" value={restaurant.active ? 'Live' : 'Pausiert'} accent={restaurant.active ? '#10b981' : '#ef4444'} />
        </div>

        <div
          style={{
            color: V2.muted,
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            fontWeight: 700,
            marginBottom: '14px',
          }}
        >
          Bereiche
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '14px',
          }}
        >
          {(
            [
              { icon: ClipboardList, label: 'Bestellungen', href: '/admin/orders' },
              { icon: UtensilsCrossed, label: 'Menü verwalten', href: '/admin/menu' },
              { icon: Armchair, label: 'Tische & QR-Codes', href: '/admin/tables' },
              { icon: Users, label: 'Staff', href: '/admin/staff' },
              { icon: CalendarDays, label: 'Reservierungen', href: '/admin/reservations' },
              { icon: Clock, label: 'Öffnungszeiten', href: '/admin/opening-hours' },
              { icon: BarChart2, label: 'Statistik', href: '/admin/stats' },
              { icon: Package, label: 'Lagerbestand', href: '/admin/inventory' },
              { icon: Plug, label: 'Integrationen', href: '/admin/integrations' },
              { icon: CreditCard, label: 'Billing', href: '/admin/billing' },
            ] as const
          ).map((card) => (
            <button
              key={card.href}
              onClick={() => router.push(card.href)}
              style={{
                background: V2.surface,
                border: `1px solid ${V2.border}`,
                borderRadius: '14px',
                padding: '18px',
                color: V2.text,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                transition: 'transform 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)'
                e.currentTarget.style.borderColor = V2.accent
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.borderColor = V2.border
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(234,88,12,0.1)',
                  color: V2.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px',
                }}
              >
                <card.icon size={18} />
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{card.label}</div>
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .bento-hero-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
}) {
  return (
    <div
      style={{
        background: V2.surface,
        border: `1px solid ${V2.border}`,
        borderRadius: '14px',
        padding: '20px',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: `${accent}20`,
          color: accent,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '10px',
        }}
      >
        {icon}
      </div>
      <div
        style={{
          color: V2.muted,
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '1.6rem',
          fontWeight: 800,
          color: V2.text,
          marginTop: '4px',
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function BannerCard({
  icon,
  title,
  desc,
  ctaLabel,
  onCta,
  tone = 'info',
}: {
  icon: React.ReactNode
  title: string
  desc: string
  ctaLabel?: string
  onCta?: () => void
  tone?: 'info' | 'danger'
}) {
  const bg = tone === 'danger' ? 'rgba(239,68,68,0.08)' : 'rgba(234,88,12,0.08)'
  const border = tone === 'danger' ? 'rgba(239,68,68,0.3)' : 'rgba(234,88,12,0.3)'
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: '14px',
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        marginTop: '14px',
      }}
    >
      {icon}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, marginBottom: '2px' }}>{title}</div>
        <div style={{ color: V2.muted, fontSize: '13px' }}>{desc}</div>
      </div>
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          style={{
            background: tone === 'danger' ? '#ef4444' : V2.accent,
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 16px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '13px',
            fontFamily: 'inherit',
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  )
}

export default function BentoOverview() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: V2.bg }} />}>
      <BentoContent />
    </Suspense>
  )
}
