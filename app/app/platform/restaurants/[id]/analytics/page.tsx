import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const STATUS_COLORS: Record<string, string> = {
  new: '#fbbf24', cooking: '#818cf8', served: '#34d399',
  cancelled: '#f87171', pending_payment: '#22d3ee',
}

export default async function RestaurantAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAccess()
  const { id } = await params
  const admin = createSupabaseAdmin()

  const ninetyDaysAgo = new Date(Date.now() - 90 * DAY).toISOString()

  const [{ data: restaurant }, { data: orders }] = await Promise.all([
    admin.from('restaurants').select('id, name, slug').eq('id', id).single(),
    admin.from('orders')
      .select('id, total, status, created_at')
      .eq('restaurant_id', id)
      .gte('created_at', ninetyDaysAgo)
      .order('created_at', { ascending: true }),
  ])

  if (!restaurant) notFound()

  const list = orders ?? []
  const nonCancelled = list.filter(o => o.status !== 'cancelled')

  // 90-day daily trend
  const dailyMap: Record<string, { count: number; revenue: number }> = {}
  for (const o of nonCancelled) {
    const d = o.created_at.slice(0, 10)
    dailyMap[d] = dailyMap[d] ?? { count: 0, revenue: 0 }
    dailyMap[d].count++
    dailyMap[d].revenue += Number(o.total) || 0
  }

  const days90: { date: string; count: number; revenue: number }[] = []
  for (let i = 89; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY).toISOString().slice(0, 10)
    days90.push({ date: d, ...(dailyMap[d] ?? { count: 0, revenue: 0 }) })
  }
  const maxRevDay = Math.max(...days90.map(d => d.revenue), 1)

  // Hour-of-day distribution
  const hourMap: Record<number, number> = {}
  for (const o of nonCancelled) {
    const h = new Date(o.created_at).getHours()
    hourMap[h] = (hourMap[h] ?? 0) + 1
  }
  const maxHour = Math.max(...Object.values(hourMap), 1)

  // Day-of-week distribution
  const dowMap: Record<number, { count: number; revenue: number }> = {}
  for (const o of nonCancelled) {
    const d = new Date(o.created_at).getDay()
    dowMap[d] = dowMap[d] ?? { count: 0, revenue: 0 }
    dowMap[d].count++
    dowMap[d].revenue += Number(o.total) || 0
  }
  const maxDow = Math.max(...Object.values(dowMap).map(d => d.count), 1)

  // Status breakdown
  const statusMap: Record<string, number> = {}
  for (const o of list) statusMap[o.status] = (statusMap[o.status] ?? 0) + 1
  const totalOrders = list.length

  // KPIs
  const totalRevenue = nonCancelled.reduce((s, o) => s + (Number(o.total) || 0), 0)
  const avgOrderValue = nonCancelled.length > 0 ? totalRevenue / nonCancelled.length : 0
  const last30 = nonCancelled.filter(o => new Date(o.created_at).getTime() >= Date.now() - 30 * DAY)
  const prev30 = nonCancelled.filter(o => {
    const t = new Date(o.created_at).getTime()
    return t >= Date.now() - 60 * DAY && t < Date.now() - 30 * DAY
  })
  const growthPct = prev30.length > 0 ? Math.round(((last30.length - prev30.length) / prev30.length) * 100) : null

  // Weekly trend (13 weeks)
  const weekMap: Record<string, { count: number; revenue: number }> = {}
  for (const o of nonCancelled) {
    const d = new Date(o.created_at)
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const key = monday.toISOString().slice(0, 10)
    weekMap[key] = weekMap[key] ?? { count: 0, revenue: 0 }
    weekMap[key].count++
    weekMap[key].revenue += Number(o.total) || 0
  }
  const weeks = Object.entries(weekMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-13)
  const maxWeekRev = Math.max(...weeks.map(([, v]) => v.revenue), 1)

  const SUB_NAV = [
    { label: 'Übersicht',   href: `/platform/restaurants/${id}` },
    { label: 'Analytics',   href: `/platform/restaurants/${id}/analytics`, active: true },
    { label: 'Orders',      href: `/platform/restaurants/${id}/orders` },
    { label: 'Speisekarte', href: `/platform/restaurants/${id}/menu` },
    { label: 'Tische',      href: `/platform/restaurants/${id}/tables` },
  ]

  return (
    <div style={{ padding: '32px 28px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '28px' }}>
        {SUB_NAV.map(n => (
          <Link key={n.href} href={n.href} style={{
            padding: '5px 14px', borderRadius: '20px', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600,
            background: n.active ? 'rgba(124,58,237,0.18)' : 'transparent',
            border: `1px solid ${n.active ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
            color: n.active ? '#c4b5fd' : 'rgba(255,255,255,0.35)',
          }}>{n.label}</Link>
        ))}
      </div>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.55rem', fontWeight: 800, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          {restaurant.name} · Analytics
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.82rem' }}>Letzte 90 Tage · /{restaurant.slug}</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px,1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Bestellungen 90d', value: String(nonCancelled.length), color: '#c4b5fd' },
          { label: 'Umsatz 90d',       value: `€${totalRevenue.toFixed(0)}`, color: '#6ee7b7' },
          { label: 'Ø Bestellwert',    value: `€${avgOrderValue.toFixed(2)}`, color: '#fbbf24' },
          { label: 'Bestellungen 30d', value: String(last30.length), color: '#93c5fd', sub: growthPct !== null ? `${growthPct >= 0 ? '+' : ''}${growthPct}% vs. Vormonat` : undefined, subColor: growthPct !== null ? (growthPct >= 0 ? '#34d399' : '#f87171') : undefined },
          { label: 'Stornierungen',    value: String(statusMap['cancelled'] ?? 0), color: '#f87171' },
          { label: 'Aktive Wochen',    value: String(Object.keys(weekMap).length), color: 'rgba(255,255,255,0.7)' },
        ].map(k => (
          <div key={k.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '13px', padding: '16px 18px' }}>
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{k.label}</div>
            <div style={{ color: k.color, fontWeight: 800, fontSize: '1.45rem', lineHeight: 1 }}>{k.value}</div>
            {k.sub && <div style={{ color: k.subColor ?? 'rgba(255,255,255,0.3)', fontSize: '0.68rem', marginTop: '4px' }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* 90-day revenue trend */}
      <Card title="Umsatz-Trend · 90 Tage">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '130px', paddingBottom: '4px' }}>
          {days90.map(d => {
            const h = Math.round((d.revenue / maxRevDay) * 100)
            const isToday = d.date === new Date().toISOString().slice(0, 10)
            return (
              <div key={d.date} title={`${d.date}: €${d.revenue.toFixed(2)} · ${d.count} Bestellungen`}
                style={{
                  flex: 1, minWidth: '2px',
                  background: isToday ? '#7c3aed' : d.revenue > 0 ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.04)',
                  height: `${Math.max(h, d.revenue > 0 ? 3 : 1)}%`,
                  borderRadius: '2px 2px 0 0',
                  boxShadow: isToday ? '0 0 8px rgba(124,58,237,0.5)' : undefined,
                  cursor: 'pointer',
                }} />
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
          <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.62rem' }}>{days90[0].date}</span>
          <span style={{ color: '#c4b5fd', fontSize: '0.62rem', fontWeight: 600 }}>Heute</span>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
        {/* Hour of day */}
        <Card title="Bestellungen nach Uhrzeit">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '80px' }}>
            {Array.from({ length: 24 }, (_, h) => {
              const cnt = hourMap[h] ?? 0
              const pct = Math.round((cnt / maxHour) * 100)
              const isPeak = cnt === maxHour && cnt > 0
              return (
                <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div title={`${h}:00 — ${cnt} Bestellungen`} style={{
                    width: '100%',
                    background: isPeak ? '#f59e0b' : cnt > 0 ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.04)',
                    height: `${Math.max(pct, cnt > 0 ? 5 : 1)}%`,
                    borderRadius: '2px 2px 0 0',
                  }} />
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            {[0, 6, 12, 18, 23].map(h => (
              <span key={h} style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.6rem' }}>{h}h</span>
            ))}
          </div>
        </Card>

        {/* Day of week */}
        <Card title="Bestellungen nach Wochentag">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = dowMap[i] ?? { count: 0, revenue: 0 }
              const pct = Math.round((d.count / maxDow) * 100)
              const isWeekend = i === 0 || i === 6
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: isWeekend ? '#fbbf24' : 'rgba(255,255,255,0.3)', fontSize: '0.65rem', fontWeight: 700, width: '20px', textAlign: 'right' }}>{WEEKDAYS[i]}</span>
                  <div style={{ flex: 1, height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: isWeekend ? 'rgba(251,191,36,0.5)' : 'rgba(124,58,237,0.5)', borderRadius: '5px' }} />
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.62rem', width: '28px', textAlign: 'right' }}>{d.count}</span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {/* Weekly revenue */}
        <Card title="Wöchentlicher Umsatz · 13 Wochen">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px' }}>
            {weeks.map(([week, v]) => {
              const pct = Math.round((v.revenue / maxWeekRev) * 100)
              return (
                <div key={week} title={`KW ${week}: €${v.revenue.toFixed(0)} · ${v.count} Bestellungen`}
                  style={{ flex: 1, background: 'rgba(124,58,237,0.5)', height: `${Math.max(pct, 3)}%`, borderRadius: '2px 2px 0 0' }} />
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.6rem' }}>{weeks[0]?.[0]?.slice(5)}</span>
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.6rem' }}>Aktuell</span>
          </div>
        </Card>

        {/* Status breakdown */}
        <Card title="Bestellstatus-Verteilung">
          {totalOrders === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.8rem' }}>Keine Daten</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {Object.entries(statusMap).sort((a, b) => b[1] - a[1]).map(([status, cnt]) => {
                const pct = Math.round((cnt / totalOrders) * 100)
                const color = STATUS_COLORS[status] ?? 'rgba(255,255,255,0.3)'
                return (
                  <div key={status}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color, fontSize: '0.72rem', fontWeight: 600, textTransform: 'capitalize' }}>{status}</span>
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.68rem' }}>{cnt} ({pct}%)</span>
                    </div>
                    <div style={{ height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', opacity: 0.6 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '14px', padding: '18px', marginBottom: '14px',
    }}>
      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
        {title}
      </div>
      {children}
    </div>
  )
}
