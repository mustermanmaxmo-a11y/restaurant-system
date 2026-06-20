import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

const PLAN_MRR: Record<string, number> = { starter: 29, pro: 79, enterprise: 199, trial: 0, expired: 0 }
const DAY = 24 * 60 * 60 * 1000

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

function firstName(email: string) {
  const name = email.split('@')[0].split(/[._-]/)[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export default async function PlatformDashboard() {
  const { user, role } = await requirePlatformAccess()
  if (role === 'support') redirect('/platform/restaurants')
  if (role === 'billing') redirect('/platform/billing')

  const admin = createSupabaseAdmin()
  const now = Date.now()
  const d30 = new Date(now - 30 * DAY).toISOString()
  const d7  = new Date(now - 7 * DAY).toISOString()

  const [{ data: restaurants }, { data: orders30 }, { data: recentOrders }, { data: usersRes }] = await Promise.all([
    admin.from('restaurants').select('id, name, slug, plan, active, trial_ends_at, created_at, owner_id'),
    admin.from('orders').select('restaurant_id, total, created_at, status').gte('created_at', d30).neq('status', 'cancelled'),
    admin.from('orders').select('id, restaurant_id, total, created_at, status').order('created_at', { ascending: false }).limit(12),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const list = restaurants ?? []
  const orders = orders30 ?? []
  const feed = recentOrders ?? []

  // Lookup maps
  const nameById: Record<string, string> = {}
  const slugById: Record<string, string> = {}
  for (const r of list) { nameById[r.id] = r.name; slugById[r.id] = r.slug }

  const emailById: Record<string, string> = {}
  for (const u of usersRes?.users ?? []) emailById[u.id] = u.email ?? ''

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const total = list.length
  const activePaid = list.filter(r => r.active && ['starter', 'pro', 'enterprise'].includes(r.plan)).length
  const activeTrials = list.filter(r => r.plan === 'trial' && r.trial_ends_at && new Date(r.trial_ends_at).getTime() > now).length
  const expired = list.filter(r => r.plan === 'expired').length
  const mrr = list.filter(r => r.active).reduce((s, r) => s + (PLAN_MRR[r.plan] ?? 0), 0)
  const revenue30 = orders.reduce((s, o) => s + (Number(o.total) || 0), 0)
  const newThisWeek = list.filter(r => new Date(r.created_at).getTime() > now - 7 * DAY).length

  // ── Alerts ──────────────────────────────────────────────────────────────────
  const expiringTrials = list.filter(r =>
    r.plan === 'trial' && r.trial_ends_at &&
    new Date(r.trial_ends_at).getTime() > now &&
    new Date(r.trial_ends_at).getTime() < now + 7 * DAY
  )

  const orderCountByRestId: Record<string, number> = {}
  for (const o of orders) orderCountByRestId[o.restaurant_id] = (orderCountByRestId[o.restaurant_id] ?? 0) + 1

  const lastOrderAt: Record<string, number> = {}
  for (const o of orders) {
    const t = new Date(o.created_at).getTime()
    if (!lastOrderAt[o.restaurant_id] || t > lastOrderAt[o.restaurant_id]) lastOrderAt[o.restaurant_id] = t
  }

  const churnRisk = list.filter(r =>
    r.active && ['starter', 'pro', 'enterprise'].includes(r.plan) &&
    (!lastOrderAt[r.id] || now - lastOrderAt[r.id] > 14 * DAY)
  )

  const alertCount = expiringTrials.length + churnRisk.length

  // ── Recent restaurants ───────────────────────────────────────────────────────
  const recentRestaurants = [...list]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6)

  // ── Plan distribution ────────────────────────────────────────────────────────
  const planCounts: Record<string, number> = {}
  for (const r of list) planCounts[r.plan] = (planCounts[r.plan] ?? 0) + 1

  const PLAN_COLORS: Record<string, string> = {
    trial: '#3b82f6', starter: '#10b981', pro: '#f59e0b', enterprise: '#8b5cf6', expired: '#ef4444',
  }

  const STATUS_DOT: Record<string, string> = {
    new: '#f59e0b', cooking: '#818cf8', served: '#10b981',
    cancelled: '#ef4444', pending_payment: '#44445a', out_for_delivery: '#3b82f6',
  }

  const userEmail = user.email ?? ''
  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ padding: '32px 28px', maxWidth: '1140px', margin: '0 auto' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0f0f8', letterSpacing: '-0.025em', marginBottom: '3px' }}>
            {greeting()}, {firstName(userEmail)} 👋
          </h1>
          <p style={{ color: '#44445a', fontSize: '0.82rem' }}>{today}</p>
        </div>
        {alertCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 14px', borderRadius: '8px',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
            <span style={{ color: '#fca5a5', fontSize: '0.8rem', fontWeight: 600 }}>
              {alertCount} {alertCount === 1 ? 'Alert' : 'Alerts'} aktiv
            </span>
          </div>
        )}
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        <Metric label="Restaurants" value={String(total)} sub={`+${newThisWeek} diese Woche`} />
        <Metric label="Aktive Abos" value={String(activePaid)} accent />
        <Metric label="MRR" value={`€${mrr}`} sub={`ARR: €${mrr * 12}`} accent />
        <Metric label="Umsatz (30d)" value={revenue30 >= 1000 ? `€${(revenue30 / 1000).toFixed(1)}k` : `€${Math.round(revenue30)}`} />
        <Metric label="Laufende Trials" value={String(activeTrials)} sub={`${expired} abgelaufen`} />
        <Metric label="Churn-Risiko" value={String(churnRisk.length)} warn={churnRisk.length > 0} sub="Abos ohne Orders 14d" />
      </div>

      {/* ── Alerts ─────────────────────────────────────────────────────────── */}
      {alertCount > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px' }}>
          {expiringTrials.map(r => (
            <Alert key={r.id} type="warn" href={`/platform/restaurants/${r.id}`}>
              <strong>{r.name}</strong> — Trial läuft am{' '}
              <span style={{ fontFamily: 'ui-monospace, monospace' }}>
                {new Date(r.trial_ends_at!).toLocaleDateString('de-DE')}
              </span>{' '}ab
            </Alert>
          ))}
          {churnRisk.slice(0, 3).map(r => (
            <Alert key={r.id} type="danger" href={`/platform/restaurants/${r.id}`}>
              <strong>{r.name}</strong> — aktives Abo, keine Bestellungen seit 14+ Tagen
            </Alert>
          ))}
          {churnRisk.length > 3 && (
            <Link href="/platform/analytics" style={{ color: '#ef4444', fontSize: '0.78rem', textDecoration: 'none', marginLeft: '4px' }}>
              + {churnRisk.length - 3} weitere in Analytics →
            </Link>
          )}
        </div>
      )}

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

        {/* Recent orders feed */}
        <Card title="Live-Bestellungen" action={<LinkChip href="/platform/analytics">Analytics</LinkChip>}>
          {feed.length === 0 ? (
            <Empty>Noch keine Bestellungen.</Empty>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {feed.map((o, i) => {
                const ago = Math.round((now - new Date(o.created_at).getTime()) / 60000)
                const agoLabel = ago < 60 ? `${ago}m` : `${Math.floor(ago / 60)}h`
                return (
                  <div key={o.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 0',
                    borderBottom: i < feed.length - 1 ? '1px solid #14142a' : 'none',
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: STATUS_DOT[o.status] ?? '#44445a' }} />
                    <span style={{ color: '#8888a0', fontSize: '0.78rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nameById[o.restaurant_id] ?? '—'}
                    </span>
                    <span style={{ color: '#c8c8e0', fontSize: '0.78rem', fontWeight: 600, flexShrink: 0 }}>
                      €{Number(o.total).toFixed(2)}
                    </span>
                    <span style={{ color: '#2e2e48', fontSize: '0.7rem', flexShrink: 0, minWidth: '28px', textAlign: 'right' }}>
                      {agoLabel}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Neue Restaurants */}
        <Card title="Zuletzt registriert" action={<LinkChip href="/platform/restaurants">Alle</LinkChip>}>
          {recentRestaurants.length === 0 ? (
            <Empty>Noch keine Restaurants.</Empty>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentRestaurants.map((r, i) => {
                const pc = PLAN_COLORS[r.plan]
                const orders30cnt = orderCountByRestId[r.id] ?? 0
                return (
                  <Link key={r.id} href={`/platform/restaurants/${r.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 0',
                      borderBottom: i < recentRestaurants.length - 1 ? '1px solid #14142a' : 'none',
                    }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0,
                        background: '#141424',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#44445a', fontSize: '0.7rem', fontWeight: 700,
                        border: '1px solid #1e1e30',
                      }}>
                        {r.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#c8c8e0', fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.name}
                        </div>
                        <div style={{ color: '#44445a', fontSize: '0.68rem' }}>
                          {orders30cnt} Orders · {new Date(r.created_at).toLocaleDateString('de-DE')}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '5px',
                        background: `${pc}18`, color: pc, flexShrink: 0,
                      }}>
                        {r.plan}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── Bottom row ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>

        {/* Plan distribution */}
        <Card title="Plan-Verteilung">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(planCounts).sort((a, b) => b[1] - a[1]).map(([plan, count]) => {
              const pct = total > 0 ? (count / total) * 100 : 0
              const color = PLAN_COLORS[plan] ?? '#888'
              return (
                <div key={plan}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ color: '#8888a0', fontSize: '0.78rem', fontWeight: 500 }}>{plan}</span>
                    <span style={{ color: '#c8c8e0', fontSize: '0.78rem', fontWeight: 700 }}>
                      {count} <span style={{ color: '#44445a', fontWeight: 400 }}>({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div style={{ height: '4px', background: '#14142a', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Quick actions */}
        <Card title="Schnellzugriff">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { label: 'Neues Restaurant anlegen', href: '/platform/restaurants', color: '#ef4444' },
              { label: 'Outreach starten',         href: '/platform/outreach',    color: '#f59e0b' },
              { label: 'Analytics öffnen',         href: '/platform/analytics',   color: '#818cf8' },
              { label: 'Feature Flags',            href: '/platform/feature-flags', color: '#10b981' },
              { label: 'Team verwalten',           href: '/platform/team',        color: '#6b6b80' },
            ].map(a => (
              <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px', borderRadius: '7px',
                  border: '1px solid #17172a', background: '#0e0e1c',
                  fontSize: '0.8rem', color: '#8888a0',
                  transition: 'border-color 0.15s',
                }}>
                  <span>{a.label}</span>
                  <span style={{ color: a.color, fontSize: '0.7rem' }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── Design Components ────────────────────────────────────────────────────────

function Metric({ label, value, sub, accent, warn }: {
  label: string; value: string; sub?: string; accent?: boolean; warn?: boolean
}) {
  const valueColor = warn ? '#ef4444' : accent ? '#ef4444' : '#f0f0f8'
  return (
    <div style={{
      background: '#111120', border: `1px solid ${warn ? 'rgba(239,68,68,0.25)' : '#1e1e30'}`,
      borderRadius: '12px', padding: '16px 18px',
    }}>
      <div style={{ color: '#44445a', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ color: valueColor, fontSize: '1.5rem', fontWeight: 800, lineHeight: 1, marginBottom: sub ? '5px' : 0 }}>
        {value}
      </div>
      {sub && <div style={{ color: '#2e2e48', fontSize: '0.68rem', fontWeight: 500 }}>{sub}</div>}
    </div>
  )
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ background: '#111120', border: '1px solid #1e1e30', borderRadius: '12px', padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ color: '#f0f0f8', fontWeight: 700, fontSize: '0.85rem' }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function Alert({ children, type, href }: { children: React.ReactNode; type: 'warn' | 'danger'; href: string }) {
  const warn = type === 'warn'
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 14px', borderRadius: '8px',
        background: warn ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)',
        border: `1px solid ${warn ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.18)'}`,
        fontSize: '0.8rem',
      }}>
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0, background: warn ? '#f59e0b' : '#ef4444' }} />
        <span style={{ color: warn ? '#fcd34d' : '#fca5a5', flex: 1 }}>{children}</span>
        <span style={{ color: warn ? '#f59e0b' : '#ef4444', fontSize: '0.7rem', flexShrink: 0 }}>→</span>
      </div>
    </Link>
  )
}

function LinkChip({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{
      color: '#44445a', fontSize: '0.72rem', textDecoration: 'none',
      padding: '3px 8px', borderRadius: '5px', border: '1px solid #1e1e30',
      fontWeight: 600,
    }}>
      {children} →
    </Link>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: '#2e2e48', fontSize: '0.82rem', padding: '16px 0', textAlign: 'center' }}>{children}</div>
}
