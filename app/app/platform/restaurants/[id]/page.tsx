import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { PlanManager } from './PlanManager'
import { QuickActions } from './QuickActions'
import { Notes } from './Notes'

export const dynamic = 'force-dynamic'

const PLAN_COLORS: Record<string, { bg: string; fg: string }> = {
  trial:      { bg: '#1e3a8a', fg: '#93c5fd' },
  starter:    { bg: '#065f46', fg: '#6ee7b7' },
  pro:        { bg: '#92400e', fg: '#fcd34d' },
  enterprise: { bg: '#581c87', fg: '#e9d5ff' },
  expired:    { bg: '#450a0a', fg: '#fca5a5' },
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
    <div style={{ padding: '32px 24px', maxWidth: '960px', margin: '0 auto' }}>
      <Link href="/platform/restaurants" style={{ color: '#888', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '20px' }}>
        ← Alle Restaurants
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '28px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {restaurant.logo_url ? (
            <img src={restaurant.logo_url} alt="" style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover', border: '1px solid #2a2a3e' }} />
          ) : (
            <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: '#2a2a3e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>🍽️</div>
          )}
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>{restaurant.name}</h1>
            <span style={{ color: '#555', fontSize: '0.8rem', fontFamily: 'ui-monospace, monospace' }}>/{restaurant.slug}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ padding: '4px 12px', borderRadius: '12px', background: planStyle.bg, color: planStyle.fg, fontSize: '0.75rem', fontWeight: 700 }}>{restaurant.plan}</span>
          <span style={{ padding: '4px 12px', borderRadius: '12px', background: restaurant.active ? '#065f46' : '#450a0a', color: restaurant.active ? '#6ee7b7' : '#fca5a5', fontSize: '0.75rem', fontWeight: 700 }}>
            {restaurant.active ? 'aktiv' : 'inaktiv'}
          </span>
        </div>
      </div>

      <QuickActions slug={restaurant.slug} ownerEmail={ownerEmail} restaurantName={restaurant.name} />

      {isExpiringSoon && (
        <div style={{ background: '#78350f22', border: '1px solid #92400e66', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', color: '#fcd34d', fontSize: '0.82rem', fontWeight: 600 }}>
          ⚠️ Trial läuft am {new Date(restaurant.trial_ends_at!).toLocaleDateString('de-DE')} ab
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
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
          <div style={{ height: '4px', background: '#2a2a3e', borderRadius: '4px', marginBottom: '14px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#10b981' : '#ef4444', borderRadius: '4px', transition: 'width 0.4s' }} />
          </div>
          {onboarding.map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid #1a1a2e' }}>
              <span style={{ fontSize: '0.85rem' }}>{item.done ? '✅' : '⬜'}</span>
              <span style={{ color: item.done ? '#ccc' : '#666', fontSize: '0.82rem' }}>{item.label}</span>
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
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #2a2a3e' }}>
                <div style={{ color: '#888', fontSize: '0.72rem', marginBottom: '4px' }}>Stripe Sub</div>
                <span style={{ color: '#555', fontSize: '0.75rem', fontFamily: 'ui-monospace, monospace' }}>{restaurant.stripe_subscription_id}</span>
              </div>
            )}
          </Section>
        )}

        {/* Recent Orders */}
        <Section title="Letzte Bestellungen">
          {(recentOrders?.length ?? 0) === 0 ? (
            <div style={{ color: '#666', fontSize: '0.8rem' }}>Noch keine Bestellungen.</div>
          ) : recentOrders!.map(o => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1a1a2e' }}>
              <div>
                <span style={{ color: '#888', fontSize: '0.72rem', fontFamily: 'ui-monospace, monospace' }}>{o.id.slice(0, 8)}…</span>
                <div style={{ color: '#555', fontSize: '0.7rem' }}>{new Date(o.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>€{Number(o.total).toFixed(2)}</div>
                <StatusBadge status={o.status} />
              </div>
            </div>
          ))}
        </Section>
      </div>

      {/* Notes */}
      <div style={{ marginTop: '20px', background: '#242438', border: '1px solid #2a2a3e', borderRadius: '14px', padding: '20px' }}>
        <div style={{ color: '#888', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
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
    <div style={{ background: '#242438', border: '1px solid #2a2a3e', borderRadius: '14px', padding: '20px' }}>
      <div style={{ color: '#888', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>{title}</div>
      {children}
    </div>
  )
}

function StatRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1a1a2e' }}>
      <span style={{ color: '#888', fontSize: '0.8rem' }}>{label}</span>
      <span style={{ color: '#ccc', fontSize: '0.8rem', fontFamily: mono ? 'ui-monospace, monospace' : undefined, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: '#93c5fd', cooking: '#fcd34d', served: '#6ee7b7',
    cancelled: '#fca5a5', pending_payment: '#c4b5fd',
  }
  return <span style={{ fontSize: '0.65rem', color: map[status] ?? '#888' }}>{status}</span>
}
