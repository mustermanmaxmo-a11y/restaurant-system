import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { PlanManager } from './PlanManager'
import { QuickActions } from './QuickActions'
import { Notes } from './Notes'

export const dynamic = 'force-dynamic'

const PLAN_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  trial:      { bg: 'rgba(96,165,250,0.1)',   fg: '#93c5fd', border: 'rgba(96,165,250,0.25)' },
  starter:    { bg: 'rgba(52,211,153,0.1)',   fg: '#6ee7b7', border: 'rgba(52,211,153,0.25)' },
  pro:        { bg: 'rgba(251,191,36,0.1)',   fg: '#fcd34d', border: 'rgba(251,191,36,0.25)' },
  enterprise: { bg: 'rgba(167,139,250,0.1)',  fg: '#c4b5fd', border: 'rgba(167,139,250,0.25)' },
  expired:    { bg: 'rgba(248,113,113,0.1)',  fg: '#fca5a5', border: 'rgba(248,113,113,0.25)' },
}

export default async function RestaurantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { role, user: platformUser } = await requirePlatformAccess()
  const { id } = await params
  const admin = createSupabaseAdmin()

  const [
    { data: restaurant },
    { data: menuItems },
    { data: tables },
    { data: recentOrders },
    { data: usersRes },
    { data: platformNotes },
  ] = await Promise.all([
    admin.from('restaurants').select(
      'id, name, slug, plan, active, trial_ends_at, created_at, owner_id, logo_url, contact_email, contact_phone, contact_address, description, restaurant_category, seating_capacity, online_payments_enabled, stripe_customer_id, stripe_subscription_id'
    ).eq('id', id).single(),
    admin.from('menu_items').select('id', { count: 'exact', head: true }).eq('restaurant_id', id),
    admin.from('tables').select('id', { count: 'exact', head: true }).eq('restaurant_id', id),
    admin.from('orders').select('id, total, created_at, status').eq('restaurant_id', id).order('created_at', { ascending: false }).limit(5),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('platform_notes')
      .select('id, author_email, content, pinned, created_at')
      .eq('restaurant_id', id)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (!restaurant) notFound()

  const emailByUserId: Record<string, string> = {}
  for (const u of usersRes?.users ?? []) {
    emailByUserId[u.id] = u.email ?? '—'
  }
  const ownerEmail = emailByUserId[restaurant.owner_id] ?? '—'

  // Stats: orders in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: statsOrders } = await admin
    .from('orders')
    .select('total')
    .eq('restaurant_id', id)
    .gte('created_at', thirtyDaysAgo)
    .neq('status', 'cancelled')

  const orderCount30d = statsOrders?.length ?? 0
  const revenue30d = statsOrders?.reduce((s, o) => s + (Number(o.total) || 0), 0) ?? 0

  // Platform-wide benchmark data
  const { data: allPlatformOrders } = await admin
    .from('orders')
    .select('restaurant_id, total')
    .gte('created_at', thirtyDaysAgo)
    .neq('status', 'cancelled')

  const platformOrderCount: Record<string, number> = {}
  const platformRevenue: Record<string, number> = {}
  for (const o of allPlatformOrders ?? []) {
    platformOrderCount[o.restaurant_id] = (platformOrderCount[o.restaurant_id] ?? 0) + 1
    platformRevenue[o.restaurant_id] = (platformRevenue[o.restaurant_id] ?? 0) + (Number(o.total) || 0)
  }
  const orderCounts = Object.values(platformOrderCount).sort((a, b) => a - b)
  const revenueCounts = Object.values(platformRevenue).sort((a, b) => a - b)

  function percentileRank(sorted: number[], value: number): number {
    if (sorted.length === 0) return 0
    const below = sorted.filter(v => v < value).length
    return Math.round((below / sorted.length) * 100)
  }

  const orderPercentile = percentileRank(orderCounts, orderCount30d)
  const revenuePercentile = percentileRank(revenueCounts, revenue30d)
  const platformAvgOrders = orderCounts.length > 0 ? Math.round(orderCounts.reduce((a, b) => a + b, 0) / orderCounts.length) : 0
  const platformAvgRevenue = revenueCounts.length > 0 ? revenueCounts.reduce((a, b) => a + b, 0) / revenueCounts.length : 0

  const menuCount = (menuItems as unknown as { count: number } | null)?.count ?? 0
  const tableCount = (tables as unknown as { count: number } | null)?.count ?? 0

  // Onboarding checks
  const onboarding = [
    { label: 'Logo hochgeladen',   done: !!restaurant.logo_url },
    { label: 'Menü-Artikel vorhanden', done: menuCount > 0 },
    { label: 'Tische angelegt',    done: tableCount > 0 },
    { label: 'Erste Bestellung',   done: (recentOrders?.length ?? 0) > 0 },
    { label: 'E-Mail hinterlegt',  done: !!restaurant.contact_email },
  ]
  const doneCount = onboarding.filter(o => o.done).length
  const pct = Math.round((doneCount / onboarding.length) * 100)

  const planStyle = PLAN_COLORS[restaurant.plan] ?? { bg: '#333', fg: '#ccc' }
  const isExpiringSoon = restaurant.plan === 'trial' && restaurant.trial_ends_at &&
    new Date(restaurant.trial_ends_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000

  return (
    <div style={{ padding: '32px 28px', maxWidth: '1000px', margin: '0 auto' }}>
      <Link href="/platform/restaurants" style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.78rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '20px' }}>
        ← Alle Restaurants
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {restaurant.logo_url ? (
            <img src={restaurant.logo_url} alt="" style={{ width: '52px', height: '52px', borderRadius: '12px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.08)' }} />
          ) : (
            <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>🍽️</div>
          )}
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em', marginBottom: '4px' }}>{restaurant.name}</h1>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.78rem', fontFamily: 'ui-monospace, monospace' }}>/{restaurant.slug}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ padding: '4px 12px', borderRadius: '20px', background: planStyle.bg, color: planStyle.fg, border: `1px solid ${planStyle.border}`, fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize' }}>{restaurant.plan}</span>
          <span style={{ padding: '4px 12px', borderRadius: '20px', background: restaurant.active ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${restaurant.active ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}`, color: restaurant.active ? '#6ee7b7' : '#fca5a5', fontSize: '0.72rem', fontWeight: 700 }}>
            {restaurant.active ? 'aktiv' : 'inaktiv'}
          </span>
        </div>
      </div>

      <QuickActions slug={restaurant.slug} ownerEmail={ownerEmail} restaurantName={restaurant.name} />

      {/* Sub-navigation */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
        {[
          { label: 'Übersicht',    href: `/platform/restaurants/${restaurant.id}`, active: true },
          { label: 'Analytics',  href: `/platform/restaurants/${restaurant.id}/analytics` },
          { label: 'Orders',     href: `/platform/restaurants/${restaurant.id}/orders` },
          { label: 'Speisekarte', href: `/platform/restaurants/${restaurant.id}/menu` },
          { label: 'Tische',     href: `/platform/restaurants/${restaurant.id}/tables` },
        ].map(n => (
          <Link key={n.href} href={n.href} style={{
            padding: '5px 14px', borderRadius: '20px', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600,
            background: n.active ? 'rgba(124,58,237,0.2)' : 'transparent',
            border: `1px solid ${n.active ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
            color: n.active ? '#c4b5fd' : 'rgba(255,255,255,0.35)',
          }}>{n.label}</Link>
        ))}
      </div>

      {isExpiringSoon && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', padding: '11px 16px', marginBottom: '18px', color: '#fcd34d', fontSize: '0.82rem', fontWeight: 600 }}>
          Trial läuft am {new Date(restaurant.trial_ends_at!).toLocaleDateString('de-DE')} ab
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(285px, 1fr))', gap: '14px' }}>
        {/* Stats */}
        <Section title="30-Tage-Performance">
          <StatRow label="Bestellungen" value={orderCount30d.toString()} />
          <StatRow label="Umsatz" value={`€${revenue30d.toFixed(2)}`} />
          <StatRow label="Menü-Artikel" value={menuCount.toString()} />
          <StatRow label="Tische" value={tableCount.toString()} />
        </Section>

        {/* Info */}
        <Section title="Kontakt & Info">
          <StatRow label="Owner" value={ownerEmail} mono />
          <StatRow label="E-Mail" value={restaurant.contact_email ?? '—'} />
          <StatRow label="Telefon" value={restaurant.contact_phone ?? '—'} />
          <StatRow label="Kategorie" value={restaurant.restaurant_category ?? '—'} />
          <StatRow label="Kapazität" value={restaurant.seating_capacity ? `${restaurant.seating_capacity} Plätze` : '—'} />
          <StatRow label="Angelegt" value={new Date(restaurant.created_at).toLocaleDateString('de-DE')} />
        </Section>

        {/* Onboarding */}
        <Section title={`Onboarding · ${pct}%`}>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', marginBottom: '14px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#34d399' : 'rgba(124,58,237,0.7)', borderRadius: '4px', transition: 'width 0.4s' }} />
          </div>
          {onboarding.map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: '0.78rem', color: item.done ? '#34d399' : 'rgba(255,255,255,0.2)' }}>{item.done ? '✓' : '○'}</span>
              <span style={{ color: item.done ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.28)', fontSize: '0.82rem' }}>{item.label}</span>
            </div>
          ))}
        </Section>

        {/* Plan Management */}
        {(role === 'owner' || role === 'co_founder' || role === 'developer') && (
          <Section title="Plan verwalten">
            <PlanManager
              restaurantId={restaurant.id}
              currentPlan={restaurant.plan as 'trial' | 'starter' | 'pro' | 'enterprise' | 'expired'}
              trialEndsAt={restaurant.trial_ends_at}
            />
            {restaurant.stripe_subscription_id && (
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.72rem', marginBottom: '4px' }}>Stripe Sub</div>
                <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.72rem', fontFamily: 'ui-monospace, monospace' }}>{restaurant.stripe_subscription_id}</span>
              </div>
            )}
          </Section>
        )}

        {/* Recent Orders */}
        <Section title="Letzte Bestellungen">
          {(recentOrders?.length ?? 0) === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.8rem' }}>Noch keine Bestellungen.</div>
          ) : recentOrders!.map(o => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem', fontFamily: 'ui-monospace, monospace' }}>{o.id.slice(0, 8)}…</span>
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.68rem' }}>{new Date(o.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#34d399', fontWeight: 700, fontSize: '0.85rem' }}>€{Number(o.total).toFixed(2)}</div>
                <StatusBadge status={o.status} />
              </div>
            </div>
          ))}
        </Section>
      </div>

      {/* Benchmark */}
      <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
        <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
          Plattform-Benchmark · 30 Tage · {orderCounts.length} Restaurants
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <BenchmarkGauge label="Bestellungen" value={orderCount30d} platformAvg={platformAvgOrders} percentile={orderPercentile} format={v => `${v}`} />
          <BenchmarkGauge label="Umsatz" value={revenue30d} platformAvg={platformAvgRevenue} percentile={revenuePercentile} format={v => `€${v.toFixed(0)}`} />
        </div>
      </div>

      {/* Notes */}
      <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
        <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
          Team-Notizen · {(platformNotes as unknown as Array<unknown>)?.length ?? 0}
        </div>
        <Notes
          restaurantId={restaurant.id}
          initialNotes={(platformNotes as unknown as Array<{ id: string; author_email: string; content: string; pinned: boolean; created_at: string }>) ?? []}
          currentUserEmail={platformUser.email ?? ''}
          canDeleteAll={role === 'owner' || role === 'co_founder'}
        />
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '18px 20px' }}>
      <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>{title}</div>
      {children}
    </div>
  )
}

function StatRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>{label}</span>
      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontFamily: mono ? 'ui-monospace, monospace' : undefined, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: '#fbbf24', cooking: '#818cf8', served: '#34d399',
    cancelled: '#f87171', pending_payment: '#22d3ee',
  }
  return <span style={{ fontSize: '0.65rem', color: map[status] ?? 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{status}</span>
}

function BenchmarkGauge({ label, value, platformAvg, percentile, format }: {
  label: string; value: number; platformAvg: number; percentile: number; format: (v: number) => string
}) {
  const color = percentile >= 75 ? '#34d399' : percentile >= 40 ? '#fbbf24' : '#f87171'
  const label2 = percentile >= 75 ? 'Top-Performer' : percentile >= 40 ? 'Durchschnitt' : 'Unter Ø'
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '12px', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
        <span style={{ color: 'rgba(255,255,255,0.92)', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{format(value)}</span>
        <span style={{ color, fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', background: `${color}18` }}>{label2}</span>
      </div>
      <div style={{ position: 'relative', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'visible', marginBottom: '8px' }}>
        <div style={{ height: '100%', width: `${percentile}%`, background: `linear-gradient(to right, rgba(124,58,237,0.3), ${color})`, borderRadius: '4px', transition: 'width 0.5s' }} />
        <div style={{ position: 'absolute', top: '-3px', left: `${percentile}%`, transform: 'translateX(-50%)', width: '12px', height: '12px', borderRadius: '50%', background: color, border: '2px solid #03030c' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.62rem' }}>0%</span>
        <span style={{ color, fontSize: '0.68rem', fontWeight: 700 }}>{percentile}. Perzentil</span>
        <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.62rem' }}>Ø {format(platformAvg)}</span>
      </div>
    </div>
  )
}
