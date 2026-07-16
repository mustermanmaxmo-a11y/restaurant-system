import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

const PLAN_MRR: Record<string, number> = { starter: 29, pro: 79, enterprise: 199, trial: 0, expired: 0 }
const PLAN_COLOR: Record<string, string> = {
  trial: '#60a5fa', starter: '#34d399', pro: '#fbbf24', enterprise: '#35c0db', expired: '#f87171',
}
const DAY = 24 * 60 * 60 * 1000

const STATUS_PILL: Record<string, { bg: string; color: string; label: string }> = {
  new:             { bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24', label: 'Neu' },
  cooking:         { bg: 'rgba(99,102,241,0.12)',  color: '#818cf8', label: 'Kocht' },
  served:          { bg: 'rgba(52,211,153,0.12)',  color: '#34d399', label: 'Serviert' },
  cancelled:       { bg: 'rgba(248,113,113,0.12)', color: '#f87171', label: 'Storno' },
  pending_payment: { bg: 'rgba(34,211,238,0.12)',  color: '#22d3ee', label: 'Zahlung' },
}

function greeting() {
  const h = new Date().getHours()
  if (h < 5)  return 'Gute Nacht'
  if (h < 12) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

function firstName(email: string) {
  const n = email.split('@')[0].split(/[._-]/)[0]
  return n.charAt(0).toUpperCase() + n.slice(1)
}

export default async function PlatformDashboard() {
  const { user, role } = await requirePlatformAccess()
  if (role === 'support') redirect('/platform/restaurants')
  if (role === 'billing') redirect('/platform/billing')

  const admin = createSupabaseAdmin()
  const now = Date.now()

  const [{ data: restaurants }, { data: orders30 }, { data: recentFeed }] = await Promise.all([
    admin.from('restaurants').select('id, name, slug, plan, active, trial_ends_at, created_at, owner_id'),
    admin.from('orders')
      .select('restaurant_id, total, created_at, status')
      .gte('created_at', new Date(now - 30 * DAY).toISOString())
      .neq('status', 'cancelled'),
    admin.from('orders')
      .select('id, restaurant_id, total, created_at, status')
      .order('created_at', { ascending: false })
      .limit(12),
  ])

  const list = restaurants ?? []

  const nameById: Record<string, string> = {}
  for (const r of list) nameById[r.id] = r.name

  const count30: Record<string, number> = {}
  const rev30: Record<string, number> = {}
  const lastOrder: Record<string, number> = {}
  for (const o of orders30 ?? []) {
    count30[o.restaurant_id] = (count30[o.restaurant_id] ?? 0) + 1
    rev30[o.restaurant_id] = (rev30[o.restaurant_id] ?? 0) + (Number(o.total) || 0)
    const t = new Date(o.created_at).getTime()
    if (!lastOrder[o.restaurant_id] || t > lastOrder[o.restaurant_id]) lastOrder[o.restaurant_id] = t
  }

  // KPIs
  const activePaid = list.filter(r => r.active && ['starter', 'pro', 'enterprise'].includes(r.plan))
  const trials = list.filter(r => r.plan === 'trial')
  const mrr = activePaid.reduce((s, r) => s + PLAN_MRR[r.plan], 0)
  const rev30total = (orders30 ?? []).reduce((s, o) => s + (Number(o.total) || 0), 0)
  const newThisWeek = list.filter(r => now - new Date(r.created_at).getTime() < 7 * DAY).length

  // Alerts
  const expiringTrials = trials.filter(r => {
    if (!r.trial_ends_at) return false
    const d = Math.ceil((new Date(r.trial_ends_at).getTime() - now) / DAY)
    return d >= 0 && d <= 7
  })
  const churnRisk = activePaid.filter(r => !lastOrder[r.id] || now - lastOrder[r.id] > 14 * DAY)

  // Top restaurants by rev (30d)
  const topList = Object.entries(rev30)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id, rev]) => ({ id, name: nameById[id] ?? id.slice(0, 8), rev, orders: count30[id] ?? 0 }))

  // 14-day daily revenue
  const dailyRev: Record<string, number> = {}
  const dailyOrders: Record<string, number> = {}
  for (const o of orders30 ?? []) {
    const d = o.created_at.slice(0, 10)
    if (now - new Date(d).getTime() <= 14 * DAY) {
      dailyRev[d] = (dailyRev[d] ?? 0) + (Number(o.total) || 0)
      dailyOrders[d] = (dailyOrders[d] ?? 0) + 1
    }
  }
  const days14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now - (13 - i) * DAY).toISOString().slice(0, 10)
    return {
      d, rev: dailyRev[d] ?? 0, orders: dailyOrders[d] ?? 0,
      label: new Date(d).toLocaleDateString('de-DE', { weekday: 'short' }),
      day: new Date(d).getDate(),
    }
  })
  const maxDayRev = Math.max(...days14.map(d => d.rev), 1)
  const todayStr = new Date().toISOString().slice(0, 10)

  // Plan distribution
  const planDist = list.reduce((acc, r) => {
    acc[r.plan] = (acc[r.plan] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const alertCount = expiringTrials.length + churnRisk.length
  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

  // Compare last 7d vs prev 7d for orders
  const orders7 = (orders30 ?? []).filter(o => now - new Date(o.created_at).getTime() <= 7 * DAY)
  const ordersPrev7 = (orders30 ?? []).filter(o => {
    const t = now - new Date(o.created_at).getTime()
    return t > 7 * DAY && t <= 14 * DAY
  })
  const orderGrowth = ordersPrev7.length > 0 ? Math.round(((orders7.length - ordersPrev7.length) / ordersPrev7.length) * 100) : null

  return (
    <div style={{ padding: '36px 36px 48px', maxWidth: '1240px', margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: '36px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.72rem', letterSpacing: '0.06em', marginBottom: '6px', textTransform: 'uppercase' }}>
            {today}
          </div>
          <h1 style={{
            fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(196,181,253,0.9) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            {greeting()}, {firstName(user?.email ?? 'Team')}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem', marginTop: '4px' }}>
            {list.length} Restaurants · {activePaid.length} aktive Abos · MRR €{mrr.toLocaleString('de-DE')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {alertCount > 0 && (
            <Link href="/platform/trials" style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 14px', borderRadius: '10px',
                background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)',
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: '#f43f5e', flexShrink: 0,
                  boxShadow: '0 0 0 0 rgba(244,63,94,0.5)',
                  animation: 'livePulse 2s ease-in-out infinite',
                }} />
                <span style={{ color: '#fda4af', fontSize: '0.78rem', fontWeight: 600 }}>
                  {alertCount} Alert{alertCount > 1 ? 's' : ''}
                </span>
              </div>
            </Link>
          )}
          <Link href="/platform/monitor" style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
              borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', flexShrink: 0,
                animation: 'livePulse 2s ease-in-out infinite',
              }} />
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', fontWeight: 500 }}>Live</span>
            </div>
          </Link>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <KPICard
          label="MRR"
          value={`€${mrr.toLocaleString('de-DE')}`}
          sub={`ARR €${(mrr * 12).toLocaleString('de-DE')}`}
          accent="violet"
          delta={newThisWeek > 0 ? `+${newThisWeek} neue Restaurants` : undefined}
          deltaPositive
        />
        <KPICard
          label="GMV 30 Tage"
          value={`€${Math.round(rev30total).toLocaleString('de-DE')}`}
          sub={`${(orders30 ?? []).length} Bestellungen`}
          accent="green"
        />
        <KPICard
          label="Aktive Abos"
          value={String(activePaid.length)}
          sub={`${trials.length} Trials`}
          accent="blue"
        />
        <KPICard
          label="Orders 7d"
          value={String(orders7.length)}
          sub={orderGrowth !== null ? `${orderGrowth >= 0 ? '+' : ''}${orderGrowth}% vs. Vorwoche` : undefined}
          accent={churnRisk.length > 0 ? 'red' : 'default'}
          delta={churnRisk.length > 0 ? `${churnRisk.length} Churn-Risiko` : undefined}
          deltaPositive={false}
        />
      </div>

      {/* ── Alerts ── */}
      {alertCount > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
          {expiringTrials.slice(0, 2).map(r => {
            const dLeft = Math.ceil((new Date(r.trial_ends_at!).getTime() - now) / DAY)
            return (
              <AlertRow key={r.id} href={`/platform/restaurants/${r.id}`} color="#f59e0b">
                Trial endet in <strong>{dLeft} Tag{dLeft !== 1 ? 'e' : ''}</strong> — <strong>{r.name}</strong> · {count30[r.id] ?? 0} Bestellungen (30d)
              </AlertRow>
            )
          })}
          {churnRisk.slice(0, 2).map(r => (
            <AlertRow key={r.id} href={`/platform/restaurants/${r.id}`} color="#f43f5e">
              <strong>{r.name}</strong> — {PLAN_MRR[r.plan]}€/mo · keine Bestellungen seit 14+ Tagen
            </AlertRow>
          ))}
        </div>
      )}

      {/* ── Main 2-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '14px', marginBottom: '14px' }}>

        {/* Revenue chart */}
        <Section title="Umsatz · 14 Tage" action={<ChipLink href="/platform/analytics">Analytics →</ChipLink>}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '140px', marginBottom: '10px', paddingTop: '8px' }}>
            {days14.map((d, i) => {
              const h = Math.round((d.rev / maxDayRev) * 100)
              const isToday = d.d === todayStr
              const isWeekend = [0, 6].includes(new Date(d.d).getDay())
              return (
                <div
                  key={d.d}
                  title={`${d.d}: €${d.rev.toFixed(0)} · ${d.orders} Bestellungen`}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end', cursor: 'default' }}
                >
                  {d.rev > 0 && (
                    <div style={{
                      color: isToday ? '#7dd3e8' : 'rgba(255,255,255,0.18)',
                      fontSize: '0.52rem', fontWeight: 700, lineHeight: 1,
                    }}>
                      {d.rev >= 1000 ? `${(d.rev / 1000).toFixed(1)}k` : d.rev.toFixed(0)}
                    </div>
                  )}
                  <div style={{
                    width: '100%',
                    height: `${Math.max(h, d.rev > 0 ? 6 : 1.5)}%`,
                    borderRadius: '4px 4px 0 0',
                    background: isToday
                      ? 'linear-gradient(to top, #0e7490, #0e7490)'
                      : isWeekend && d.rev > 0
                        ? 'rgba(196,181,253,0.35)'
                        : d.rev > 0
                          ? 'rgba(14,116,144,0.45)'
                          : 'rgba(255,255,255,0.04)',
                    boxShadow: isToday ? '0 0 12px rgba(14,116,144,0.4)' : undefined,
                    transition: 'height 0.3s ease',
                  }} />
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            {days14.map((d) => (
              <div key={d.d} style={{
                flex: 1, textAlign: 'center',
                color: d.d === todayStr ? '#7dd3e8' : 'rgba(255,255,255,0.18)',
                fontSize: '0.58rem', fontWeight: d.d === todayStr ? 700 : 400,
              }}>
                {d.day}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
            <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: '0.58rem' }}>
              {days14[0]?.label} {days14[0]?.day}.
            </span>
            <span style={{ color: '#7dd3e8', fontSize: '0.6rem', fontWeight: 600 }}>Heute</span>
          </div>
        </Section>

        {/* Live feed */}
        <Section title="Live Orders" action={<ChipLink href="/platform/monitor">Monitor →</ChipLink>}>
          {(recentFeed?.length ?? 0) === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.14)', fontSize: '0.82rem', padding: '28px 0', textAlign: 'center' }}>
              Noch keine Bestellungen heute.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {(recentFeed ?? []).slice(0, 9).map((o, i) => {
                const ago = Math.round((now - new Date(o.created_at).getTime()) / 60000)
                const pill = STATUS_PILL[o.status]
                return (
                  <div key={o.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0',
                    borderBottom: i < Math.min((recentFeed?.length ?? 0), 9) - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}>
                    {pill ? (
                      <span style={{
                        padding: '2px 7px', borderRadius: '5px',
                        background: pill.bg, color: pill.color,
                        fontSize: '0.6rem', fontWeight: 700, flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}>
                        {pill.label}
                      </span>
                    ) : (
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.2)' }} />
                    )}
                    <span style={{
                      color: 'rgba(255,255,255,0.58)', fontSize: '0.78rem', flex: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {nameById[o.restaurant_id] ?? '—'}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.78rem', fontWeight: 700, flexShrink: 0 }}>
                      €{Number(o.total).toFixed(2)}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.16)', fontSize: '0.65rem', minWidth: '28px', textAlign: 'right', flexShrink: 0 }}>
                      {ago < 60 ? `${ago}m` : `${Math.floor(ago / 60)}h`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Section>
      </div>

      {/* ── Bottom 3-column ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>

        {/* Top Restaurants */}
        <Section title="Top Restaurants · 30d" action={<ChipLink href="/platform/restaurants">Alle →</ChipLink>}>
          {topList.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.14)', fontSize: '0.82rem', padding: '20px 0', textAlign: 'center' }}>Keine Daten</div>
          ) : (
            <div>
              {topList.map((r, i) => {
                const maxRev = topList[0]?.rev || 1
                const pct = (r.rev / maxRev) * 100
                return (
                  <Link key={r.id} href={`/platform/restaurants/${r.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      padding: '8px 0',
                      borderBottom: i < topList.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.62rem', fontWeight: 700, width: '14px', textAlign: 'right' }}>
                          #{i + 1}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.8rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.name}
                        </span>
                        <span style={{ color: '#34d399', fontSize: '0.8rem', fontWeight: 700 }}>
                          €{Math.round(r.rev).toLocaleString('de-DE')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '24px' }}>
                        <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'rgba(52,211,153,0.5)', borderRadius: '2px' }} />
                        </div>
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.6rem', flexShrink: 0 }}>{r.orders} Orders</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </Section>

        {/* Plan distribution */}
        <Section title="Plan-Verteilung">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(planDist).sort((a, b) => b[1] - a[1]).map(([plan, cnt]) => {
              const pct = list.length > 0 ? (cnt / list.length) * 100 : 0
              const c = PLAN_COLOR[plan] ?? '#888'
              const rev = plan === 'trial' || plan === 'expired' ? 0 : (PLAN_MRR[plan] ?? 0) * cnt
              return (
                <div key={plan}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c, flexShrink: 0 }} />
                      <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize' }}>{plan}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', fontWeight: 700 }}>{cnt}</span>
                      {rev > 0 && <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.65rem' }}> · €{rev}/mo</span>}
                    </div>
                  </div>
                  <div style={{ height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: c, borderRadius: '3px', opacity: 0.65, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.68rem' }}>Gesamt Restaurants</span>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', fontWeight: 700 }}>{list.length}</span>
            </div>
          </div>
        </Section>

        {/* Quick access */}
        <Section title="Schnellzugriff">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {[
              { label: 'Revenue',         href: '/platform/revenue',     dot: '#34d399', sub: 'MRR & GMV Übersicht' },
              { label: 'Churn Risk',      href: '/platform/churn',       dot: '#f43f5e', sub: churnRisk.length > 0 ? `${churnRisk.length} gefährdet` : 'Alles grün' },
              { label: 'Trial Pipeline',  href: '/platform/trials',      dot: '#fbbf24', sub: `${trials.length} aktive Trials` },
              { label: 'AI Insights',     href: '/platform/insights',    dot: '#35c0db', sub: 'Optimierungsideen' },
              { label: 'Outreach',        href: '/platform/outreach',    dot: '#60a5fa', sub: 'Campaigns & E-Mails' },
              { label: 'Audit Log',       href: '/platform/audit',       dot: 'rgba(255,255,255,0.2)', sub: 'Alle Aktionen' },
            ].map(a => (
              <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }} className="p-quick-link">
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                  borderRadius: '9px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.055)',
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: a.dot, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 600 }}>{a.label}</div>
                    <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.65rem' }}>{a.sub}</div>
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.14)', fontSize: '0.65rem' }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}

// ─── Components ───────────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, accent = 'default', delta, deltaPositive,
}: {
  label: string; value: string; sub?: string
  accent?: 'violet' | 'green' | 'blue' | 'red' | 'default'
  delta?: string; deltaPositive?: boolean
}) {
  const ACCENTS = {
    violet: { border: 'rgba(14,116,144,0.25)', bg: 'rgba(14,116,144,0.07)', value: '#7dd3e8' },
    green:  { border: 'rgba(52,211,153,0.2)',  bg: 'rgba(52,211,153,0.06)',  value: '#6ee7b7' },
    blue:   { border: 'rgba(96,165,250,0.2)',  bg: 'rgba(96,165,250,0.06)',  value: '#93c5fd' },
    red:    { border: 'rgba(244,63,94,0.2)',   bg: 'rgba(244,63,94,0.06)',   value: '#fda4af' },
    default:{ border: 'rgba(255,255,255,0.07)',bg: 'rgba(255,255,255,0.03)', value: 'rgba(255,255,255,0.9)' },
  }
  const a = ACCENTS[accent]
  return (
    <div style={{
      padding: '20px 22px', borderRadius: '14px',
      background: a.bg, border: `1px solid ${a.border}`,
    }}>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
        {label}
      </div>
      <div style={{ color: a.value, fontSize: '1.75rem', fontWeight: 800, lineHeight: 1, marginBottom: '6px', letterSpacing: '-0.02em' }}>
        {value}
      </div>
      {sub && (
        <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.7rem', marginBottom: delta ? '4px' : 0 }}>{sub}</div>
      )}
      {delta && (
        <div style={{ color: deltaPositive ? '#34d399' : '#f87171', fontSize: '0.68rem', fontWeight: 600 }}>{delta}</div>
      )}
    </div>
  )
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{
      padding: '20px', borderRadius: '16px',
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: '0.78rem', letterSpacing: '0.01em' }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function AlertRow({ children, href, color }: { children: React.ReactNode; href: string; color: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
        borderRadius: '10px', background: `${color}0c`, border: `1px solid ${color}28`,
        fontSize: '0.8rem',
      }}>
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0, background: color }} />
        <span style={{ color: 'rgba(255,255,255,0.7)', flex: 1 }}>{children}</span>
        <span style={{ color: color, fontSize: '0.65rem' }}>→</span>
      </div>
    </Link>
  )
}

function ChipLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{
      color: 'rgba(255,255,255,0.28)', fontSize: '0.7rem', textDecoration: 'none',
      padding: '3px 9px', borderRadius: '7px',
      border: '1px solid rgba(255,255,255,0.08)',
      transition: 'color 0.1s, border-color 0.1s',
    }}>
      {children}
    </Link>
  )
}
