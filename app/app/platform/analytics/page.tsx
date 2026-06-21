import Link from 'next/link'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

const PLAN_MRR: Record<string, number> = { starter: 29, pro: 79, enterprise: 199, trial: 0, expired: 0 }

function fmt(n: number) { return `€${n.toFixed(2)}` }
function fmtShort(n: number) { return n >= 1000 ? `€${(n / 1000).toFixed(1)}k` : fmt(n) }

const STATUS_COLORS: Record<string, string> = {
  served: '#10b981', cooking: '#6366f1', new: '#f59e0b',
  cancelled: '#ef4444', pending_payment: '#888', out_for_delivery: '#3b82f6',
}

export default async function PlatformAnalytics() {
  await requirePlatformAccess()
  const admin = createSupabaseAdmin()

  const now = Date.now()
  const d60 = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString()
  const d365 = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: allOrders }, { data: restaurants }, { data: historicOrders }] = await Promise.all([
    admin.from('orders')
      .select('id, restaurant_id, total, created_at, status')
      .gte('created_at', d60),
    admin.from('restaurants')
      .select('id, name, slug, plan, active, created_at'),
    admin.from('orders')
      .select('total, created_at, status')
      .gte('created_at', d365)
      .neq('status', 'cancelled'),
  ])

  const orders = allOrders ?? []
  const restList = restaurants ?? []

  const orders30 = orders.filter(o => new Date(o.created_at).getTime() >= now - 30 * 24 * 60 * 60 * 1000)
  const ordersPrev = orders.filter(o => {
    const t = new Date(o.created_at).getTime()
    return t < now - 30 * 24 * 60 * 60 * 1000
  })
  const orders14 = orders30.filter(o => new Date(o.created_at).getTime() >= now - 14 * 24 * 60 * 60 * 1000)

  const paid30 = orders30.filter(o => o.status !== 'cancelled')
  const paidPrev = ordersPrev.filter(o => o.status !== 'cancelled')

  const revenue30 = paid30.reduce((s, o) => s + (Number(o.total) || 0), 0)
  const revenuePrev = paidPrev.reduce((s, o) => s + (Number(o.total) || 0), 0)
  const revenueGrowth = revenuePrev > 0 ? (revenue30 - revenuePrev) / revenuePrev * 100 : null

  const orderCount30 = paid30.length
  const orderCountPrev = paidPrev.length
  const orderGrowth = orderCountPrev > 0 ? (orderCount30 - orderCountPrev) / orderCountPrev * 100 : null

  const aov = orderCount30 > 0 ? revenue30 / orderCount30 : 0
  const aovPrev = orderCountPrev > 0 ? revenuePrev / orderCountPrev : 0
  const aovGrowth = aovPrev > 0 ? (aov - aovPrev) / aovPrev * 100 : null

  const newRest30 = restList.filter(r => new Date(r.created_at).getTime() >= now - 30 * 24 * 60 * 60 * 1000).length
  const newRestPrev = restList.filter(r => {
    const t = new Date(r.created_at).getTime()
    return t >= now - 60 * 24 * 60 * 60 * 1000 && t < now - 30 * 24 * 60 * 60 * 1000
  }).length

  // Top restaurants by revenue
  const revenueById: Record<string, number> = {}
  const countById: Record<string, number> = {}
  for (const o of paid30) {
    revenueById[o.restaurant_id] = (revenueById[o.restaurant_id] ?? 0) + (Number(o.total) || 0)
    countById[o.restaurant_id] = (countById[o.restaurant_id] ?? 0) + 1
  }
  const nameById: Record<string, string> = {}
  for (const r of restList) nameById[r.id] = r.name

  const topRevenue = Object.entries(revenueById)
    .map(([id, rev]) => ({ id, name: nameById[id] ?? '—', rev, orders: countById[id] ?? 0 }))
    .sort((a, b) => b.rev - a.rev)
    .slice(0, 10)
  const maxRev = topRevenue[0]?.rev ?? 1

  // Daily chart (last 14 days)
  const days14: string[] = []
  const dailyOrders: Record<string, number> = {}
  const dailyRev: Record<string, number> = {}
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    days14.push(key)
    dailyOrders[key] = 0
    dailyRev[key] = 0
  }
  for (const o of orders14) {
    if (o.status === 'cancelled') continue
    const key = new Date(o.created_at).toISOString().slice(0, 10)
    if (dailyOrders[key] !== undefined) {
      dailyOrders[key]++
      dailyRev[key] += Number(o.total) || 0
    }
  }
  const maxDailyOrders = Math.max(...Object.values(dailyOrders), 1)

  // Hourly heatmap
  const hourly: number[] = new Array(24).fill(0)
  for (const o of paid30) hourly[new Date(o.created_at).getHours()]++
  const maxHourly = Math.max(...hourly, 1)
  const busiestHour = hourly.indexOf(Math.max(...hourly))

  // Status distribution
  const statusMap: Record<string, number> = {}
  for (const o of orders30) statusMap[o.status] = (statusMap[o.status] ?? 0) + 1

  // Weekday heatmap
  const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
  const weekdayOrders: number[] = new Array(7).fill(0)
  for (const o of paid30) weekdayOrders[new Date(o.created_at).getDay()]++
  const maxWeekday = Math.max(...weekdayOrders, 1)

  // Monthly revenue trend (last 12 months)
  const monthlyRev: Record<string, number> = {}
  const monthlyOrders: Record<string, number> = {}
  const months12: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const key = d.toISOString().slice(0, 7)
    months12.push(key)
    monthlyRev[key] = 0
    monthlyOrders[key] = 0
  }
  for (const o of historicOrders ?? []) {
    const key = new Date(o.created_at).toISOString().slice(0, 7)
    if (monthlyRev[key] !== undefined) {
      monthlyRev[key] += Number(o.total) || 0
      monthlyOrders[key]++
    }
  }
  const maxMonthlyRev = Math.max(...Object.values(monthlyRev), 1)

  // Cohort health: restaurants grouped by creation month, current status
  const cohortMap: Record<string, { total: number; active: number; expired: number; trial: number }> = {}
  for (const r of restList) {
    const key = new Date(r.created_at).toISOString().slice(0, 7)
    if (!cohortMap[key]) cohortMap[key] = { total: 0, active: 0, expired: 0, trial: 0 }
    cohortMap[key].total++
    if (r.plan === 'expired') cohortMap[key].expired++
    else if (r.plan === 'trial') cohortMap[key].trial++
    else cohortMap[key].active++
  }
  const cohortMonths = Object.keys(cohortMap).sort().slice(-9)

  // Churn risk: active paid, zero orders last 14d
  const activeWith14d = new Set(orders14.filter(o => o.status !== 'cancelled').map(o => o.restaurant_id))
  const churnRisk = restList.filter(r =>
    r.active && (r.plan === 'starter' || r.plan === 'pro' || r.plan === 'enterprise') &&
    !activeWith14d.has(r.id)
  )

  // Plan-to-order mapping: trial restaurants ordered a lot → upgrade candidate
  const trialActiveIds = restList.filter(r => r.plan === 'trial').map(r => r.id)
  const upgradeMap: Record<string, number> = {}
  for (const o of paid30) {
    if (trialActiveIds.includes(o.restaurant_id)) {
      upgradeMap[o.restaurant_id] = (upgradeMap[o.restaurant_id] ?? 0) + 1
    }
  }
  const upgradeCandidates = Object.entries(upgradeMap)
    .map(([id, cnt]) => ({ id, name: nameById[id] ?? '—', orders: cnt, rev: revenueById[id] ?? 0 }))
    .filter(u => u.orders >= 5)
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 5)

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em', marginBottom: '6px' }}>Analytics</h1>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>Alle Restaurants · Letzte 30 Tage vs. vorige 30 Tage</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        <KPI label="Umsatz (30d)" value={fmtShort(revenue30)} growth={revenueGrowth} />
        <KPI label="Bestellungen (30d)" value={String(orderCount30)} growth={orderGrowth} />
        <KPI label="Ø Bestellwert" value={fmt(aov)} growth={aovGrowth} />
        <KPI label="Neue Restaurants" value={String(newRest30)} diff={newRest30 - newRestPrev} />
        <KPI label="Stoßzeit" value={`${busiestHour}:00 Uhr`} sub="täglich" />
        <KPI label="Churn-Risiko" value={String(churnRisk.length)} warn={churnRisk.length > 0} sub="Abos ohne Orders 14d" />
      </div>

      {/* Top Restaurants */}
      <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
        <h2 style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '18px' }}>Top 10 Restaurants nach Umsatz (30d)</h2>
        {topRevenue.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem' }}>Keine Bestellungen in den letzten 30 Tagen.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {topRevenue.map((r, i) => (
              <Link key={r.id} href={`/platform/restaurants/${r.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: i < 3 ? '#fbbf24' : 'rgba(255,255,255,0.2)', fontSize: '0.75rem', width: '20px', textAlign: 'right', fontWeight: 700 }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.83rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{r.name}</span>
                      <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
                        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem' }}>{r.orders} Orders · Ø {r.orders > 0 ? fmt(r.rev / r.orders) : '—'}</span>
                        <span style={{ color: '#34d399', fontSize: '0.83rem', fontWeight: 800 }}>{fmt(r.rev)}</span>
                      </div>
                    </div>
                    <div style={{ height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(r.rev / maxRev) * 100}%`,
                        background: i === 0 ? '#34d399' : i < 3 ? 'rgba(52,211,153,0.6)' : 'rgba(124,58,237,0.5)',
                        borderRadius: '3px',
                      }} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '20px' }}>

        {/* Daily bar chart */}
        <ChartCard title="Tägliche Bestellungen (14d)">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '110px', paddingBottom: '20px' }}>
            {days14.map(day => {
              const cnt = dailyOrders[day] ?? 0
              const barH = cnt > 0 ? Math.max(6, Math.round((cnt / maxDailyOrders) * 100)) : 0
              const label = new Date(day + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
              const isToday = day === new Date().toISOString().slice(0, 10)
              return (
                <div
                  key={day}
                  title={`${label}: ${cnt} Bestellungen · ${fmt(dailyRev[day] ?? 0)}`}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', position: 'relative', cursor: 'default' }}
                >
                  {cnt > 0 && (
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.55rem', marginBottom: '2px' }}>{cnt}</span>
                  )}
                  <div style={{
                    width: '100%', height: `${barH}%`, minHeight: cnt > 0 ? '4px' : 0,
                    background: isToday ? '#7c3aed' : 'rgba(124,58,237,0.5)',
                    borderRadius: '2px 2px 0 0',
                  }} />
                  <span style={{
                    position: 'absolute', bottom: '-18px', fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)',
                    transform: 'rotate(-35deg)', transformOrigin: 'top center', whiteSpace: 'nowrap',
                  }}>{label}</span>
                </div>
              )
            })}
          </div>
        </ChartCard>

        {/* Hourly */}
        <ChartCard title={`Bestellungen nach Uhrzeit (30d) · Stoßzeit ${busiestHour}:00`}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '100px' }}>
            {hourly.map((cnt, h) => {
              const pct = (cnt / maxHourly) * 100
              const isBusiest = cnt === Math.max(...hourly) && cnt > 0
              return (
                <div
                  key={h}
                  title={`${h}:00 Uhr — ${cnt} Bestellungen`}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', cursor: 'default' }}
                >
                  <div style={{
                    width: '100%',
                    height: `${Math.max(pct > 0 ? 4 : 0, pct)}%`,
                    background: isBusiest ? '#f59e0b' : `rgba(124,58,237,${0.15 + pct / 100 * 0.7})`,
                    borderRadius: '2px 2px 0 0',
                  }} />
                  {h % 6 === 0 && <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', marginTop: '3px' }}>{h}h</span>}
                </div>
              )
            })}
          </div>
        </ChartCard>

        {/* Weekday heatmap */}
        <ChartCard title="Bestellungen nach Wochentag (30d)">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '100px' }}>
            {weekdays.map((day, i) => {
              const cnt = weekdayOrders[i]
              const pct = (cnt / maxWeekday) * 100
              const isBest = cnt === Math.max(...weekdayOrders)
              return (
                <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: '4px' }}>
                  {cnt > 0 && <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.6rem' }}>{cnt}</span>}
                  <div style={{
                    width: '100%', height: `${Math.max(4, pct)}%`,
                    background: isBest ? '#fbbf24' : 'rgba(124,58,237,0.45)',
                    borderRadius: '4px 4px 0 0',
                  }} />
                  <span style={{ fontSize: '0.65rem', color: isBest ? '#fbbf24' : 'rgba(255,255,255,0.25)', fontWeight: isBest ? 700 : 400 }}>{day}</span>
                </div>
              )
            })}
          </div>
        </ChartCard>

        {/* Status */}
        <ChartCard title="Bestellstatus-Verteilung (30d)">
          {Object.keys(statusMap).length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem' }}>Keine Daten.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(statusMap).sort((a, b) => b[1] - a[1]).map(([status, cnt]) => {
                const pct = orders30.length > 0 ? (cnt / orders30.length) * 100 : 0
                const color = STATUS_COLORS[status] ?? 'rgba(255,255,255,0.3)'
                return (
                  <div key={status}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '0.78rem' }}>
                      <span style={{ color, fontWeight: 600 }}>{status}</span>
                      <span style={{ color: 'rgba(255,255,255,0.28)' }}>{cnt} · {pct.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, opacity: 0.7 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Upgrade candidates */}
      {upgradeCandidates.length > 0 && (
        <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
          <h2 style={{ color: 'rgba(255,255,255,0.82)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>
            Upgrade-Kandidaten — Trials mit starker Aktivität
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', marginBottom: '16px' }}>Trial-Restaurants mit ≥5 Bestellungen in 30 Tagen — bereit für Konvertierung</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {upgradeCandidates.map(u => (
              <Link key={u.id} href={`/platform/restaurants/${u.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: '8px', cursor: 'pointer' }}>
                  <span style={{ color: 'rgba(255,255,255,0.82)', fontWeight: 600, fontSize: '0.85rem' }}>{u.name}</span>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span style={{ color: '#c4b5fd', fontSize: '0.78rem', fontWeight: 700 }}>{u.orders} Bestellungen</span>
                    <span style={{ color: '#34d399', fontSize: '0.78rem', fontWeight: 700 }}>{fmt(u.rev)} Umsatz</span>
                    <span style={{ color: '#c4b5fd', fontSize: '0.72rem' }}>→ Plan setzen</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Monthly revenue trend */}
      <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
        <h2 style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '18px' }}>Monatlicher Umsatz-Trend · 12 Monate</h2>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px', paddingBottom: '24px' }}>
          {months12.map((month, i) => {
            const rev = monthlyRev[month] ?? 0
            const cnt = monthlyOrders[month] ?? 0
            const pct = Math.max(rev > 0 ? 4 : 0, (rev / maxMonthlyRev) * 100)
            const isCurrentMonth = month === new Date().toISOString().slice(0, 7)
            const label = new Date(month + '-15').toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
            return (
              <div
                key={month}
                title={`${label}: €${rev.toFixed(2)} · ${cnt} Bestellungen`}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: '3px', cursor: 'default' }}
              >
                {rev > 0 && <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.55rem' }}>{rev >= 1000 ? `€${(rev/1000).toFixed(1)}k` : `€${Math.round(rev)}`}</span>}
                <div style={{
                  width: '100%', height: `${pct}%`, minHeight: rev > 0 ? '4px' : 0,
                  background: isCurrentMonth ? '#7c3aed' : i === months12.length - 2 ? 'rgba(124,58,237,0.65)' : 'rgba(124,58,237,0.4)',
                  borderRadius: '3px 3px 0 0',
                  boxShadow: isCurrentMonth ? '0 0 10px rgba(124,58,237,0.4)' : undefined,
                }} />
                <span style={{ fontSize: '0.55rem', color: isCurrentMonth ? '#c4b5fd' : 'rgba(255,255,255,0.18)', position: 'absolute', marginTop: '100px', whiteSpace: 'nowrap' }}>{label}</span>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: '20px', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
          {(['last3', 'prev3'] as const).map((period, pi) => {
            const slice = pi === 0 ? months12.slice(-3) : months12.slice(-6, -3)
            const total = slice.reduce((s, m) => s + (monthlyRev[m] ?? 0), 0)
            const label = pi === 0 ? 'Letzte 3 Monate' : 'Vorige 3 Monate'
            return (
              <div key={period}>
                <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.68rem' }}>{label}</div>
                <div style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700, fontSize: '0.9rem' }}>€{total.toFixed(2)}</div>
              </div>
            )
          })}
          {(() => {
            const last3 = months12.slice(-3).reduce((s, m) => s + (monthlyRev[m] ?? 0), 0)
            const prev3 = months12.slice(-6, -3).reduce((s, m) => s + (monthlyRev[m] ?? 0), 0)
            const growth = prev3 > 0 ? ((last3 - prev3) / prev3 * 100) : null
            return growth !== null ? (
              <div>
                <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.68rem' }}>Wachstum</div>
                <div style={{ color: growth >= 0 ? '#34d399' : '#f87171', fontWeight: 700, fontSize: '0.9rem' }}>
                  {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                </div>
              </div>
            ) : null
          })()}
        </div>
      </div>

      {/* Cohort health */}
      <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px', marginBottom: '20px', overflowX: 'auto' }}>
        <h2 style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '4px' }}>Kohorten-Analyse — Status nach Registrierungsmonat</h2>
        <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.75rem', marginBottom: '16px' }}>Wie viele Restaurants aus einem Anmeldemonat sind heute noch aktiv (bezahlter Plan)?</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: '500px' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              <th style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left' }}>Kohorte</th>
              <th style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>Gesamt</th>
              <th style={{ padding: '10px 12px', color: '#34d399', fontWeight: 700, fontSize: '0.62rem', textTransform: 'uppercase', textAlign: 'center' }}>Aktiv</th>
              <th style={{ padding: '10px 12px', color: '#60a5fa', fontWeight: 700, fontSize: '0.62rem', textTransform: 'uppercase', textAlign: 'center' }}>Trial</th>
              <th style={{ padding: '10px 12px', color: '#f87171', fontWeight: 700, fontSize: '0.62rem', textTransform: 'uppercase', textAlign: 'center' }}>Expired</th>
              <th style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, fontSize: '0.62rem', textTransform: 'uppercase', textAlign: 'center' }}>Retention</th>
            </tr>
          </thead>
          <tbody>
            {cohortMonths.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'rgba(255,255,255,0.18)' }}>Keine Daten.</td></tr>
            ) : cohortMonths.map(month => {
              const c = cohortMap[month]
              const label = new Date(month + '-15').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
              const retentionPct = c.total > 0 ? Math.round((c.active / c.total) * 100) : 0
              return (
                <tr key={month} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{label}</td>
                  <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.88)', textAlign: 'center', fontWeight: 700 }}>{c.total}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ color: '#34d399', fontWeight: 700 }}>{c.active}</span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ color: '#93c5fd' }}>{c.trial}</span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ color: c.expired > 0 ? '#fca5a5' : 'rgba(255,255,255,0.2)' }}>{c.expired}</span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                      <div style={{ width: '60px', height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${retentionPct}%`, background: retentionPct >= 50 ? '#34d399' : retentionPct >= 25 ? '#fbbf24' : '#f87171' }} />
                      </div>
                      <span style={{ color: retentionPct >= 50 ? '#34d399' : retentionPct >= 25 ? '#fbbf24' : '#f87171', fontWeight: 700, fontSize: '0.78rem', minWidth: '32px' }}>
                        {retentionPct}%
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Churn risk */}
      <div style={{ background: churnRisk.length > 0 ? 'rgba(244,63,94,0.05)' : 'rgba(255,255,255,0.025)', border: `1px solid ${churnRisk.length > 0 ? 'rgba(244,63,94,0.22)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '14px', padding: '20px' }}>
        <h2 style={{ color: 'rgba(255,255,255,0.82)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>
          Churn-Risiko · {churnRisk.length}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', marginBottom: '16px' }}>Aktive bezahlte Abos ohne Bestellungen in den letzten 14 Tagen</p>
        {churnRisk.length === 0 ? (
          <p style={{ color: '#34d399', fontSize: '0.85rem' }}>Kein Churn-Risiko erkannt.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {churnRisk.map(r => (
              <Link key={r.id} href={`/platform/restaurants/${r.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.16)', borderRadius: '8px', cursor: 'pointer' }}>
                  <div>
                    <span style={{ color: 'rgba(255,255,255,0.82)', fontWeight: 600, fontSize: '0.85rem' }}>{r.name}</span>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem', marginLeft: '8px' }}>/{r.slug}</span>
                  </div>
                  <span style={{ color: '#fda4af', fontSize: '0.75rem', fontWeight: 700 }}>{r.plan} →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KPI({ label, value, growth, diff, warn, sub }: {
  label: string; value: string; growth?: number | null; diff?: number; warn?: boolean; sub?: string
}) {
  const hasGrowth = growth !== null && growth !== undefined
  const hasDiff = diff !== undefined && diff !== 0
  return (
    <div style={{
      background: warn ? 'rgba(244,63,94,0.06)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${warn ? 'rgba(244,63,94,0.22)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: '14px', padding: '16px 18px',
    }}>
      <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '8px' }}>{label}</p>
      <p style={{ color: warn ? '#fda4af' : 'rgba(255,255,255,0.92)', fontWeight: 800, fontSize: '1.45rem', lineHeight: 1, marginBottom: '4px' }}>{value}</p>
      {sub && <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.68rem' }}>{sub}</p>}
      {hasGrowth && (
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: (growth ?? 0) >= 0 ? '#34d399' : '#f87171' }}>
          {(growth ?? 0) >= 0 ? '+' : ''}{growth!.toFixed(1)}% vs. -30d
        </span>
      )}
      {hasDiff && (
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: diff! > 0 ? '#34d399' : '#f87171' }}>
          {diff! > 0 ? '+' : ''}{diff} vs. -30d
        </span>
      )}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
      <h2 style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>{title}</h2>
      {children}
    </div>
  )
}
