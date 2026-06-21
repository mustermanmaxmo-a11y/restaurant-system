import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const DAY_JS = [1, 2, 3, 4, 5, 6, 0] // JS getDay() mapping

function fmtHour(h: number) {
  return `${String(h).padStart(2, '0')}:00`
}

export default async function HeatmapPage() {
  await requirePlatformAccess()
  const admin = createSupabaseAdmin()

  const d90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: orders }, { data: restaurants }] = await Promise.all([
    admin.from('orders')
      .select('restaurant_id, total, created_at, status')
      .gte('created_at', d90)
      .neq('status', 'cancelled'),
    admin.from('restaurants').select('id, name'),
  ])

  const allOrders = orders ?? []

  // ── Hour × Day heatmap ──────────────────────────────────────────────────
  // grid[day_idx][hour] = { count, gmv }
  const grid: { count: number; gmv: number }[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ count: 0, gmv: 0 }))
  )

  for (const o of allOrders) {
    const d = new Date(o.created_at)
    const jsDay = d.getDay() // 0=Sun
    const dayIdx = DAY_JS.indexOf(jsDay)
    const hour = d.getHours()
    if (dayIdx >= 0) {
      grid[dayIdx][hour].count++
      grid[dayIdx][hour].gmv += o.total ?? 0
    }
  }

  const maxCount = Math.max(...grid.flatMap(row => row.map(c => c.count)), 1)
  const maxGmv = Math.max(...grid.flatMap(row => row.map(c => c.gmv)), 1)

  // ── Peak times ──────────────────────────────────────────────────────────
  const peakHour = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: grid.reduce((s, row) => s + row[h].count, 0),
    gmv: grid.reduce((s, row) => s + row[h].gmv, 0),
  })).sort((a, b) => b.count - a.count)

  const peakDay = DAYS.map((label, i) => ({
    label,
    count: grid[i].reduce((s, c) => s + c.count, 0),
    gmv: grid[i].reduce((s, c) => s + c.gmv, 0),
  })).sort((a, b) => b.count - a.count)

  // ── Per-restaurant busiest hour ─────────────────────────────────────────
  const restMap = new Map((restaurants ?? []).map(r => [r.id, r.name]))
  const byRest: Record<string, { count: number; peakHour: number; gmv: number }> = {}
  for (const o of allOrders) {
    if (!byRest[o.restaurant_id]) byRest[o.restaurant_id] = { count: 0, peakHour: 0, gmv: 0 }
    byRest[o.restaurant_id].count++
    byRest[o.restaurant_id].gmv += o.total ?? 0
  }
  // simplify - just top 8 restaurants by count
  const topRests = Object.entries(byRest)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([id, data]) => ({ id, name: restMap.get(id) ?? id.slice(0, 8), ...data }))

  // Per-restaurant hour breakdown (top 5 only)
  const restHourGrid: Record<string, number[]> = {}
  for (const r of topRests.slice(0, 5)) {
    restHourGrid[r.id] = Array(24).fill(0)
  }
  for (const o of allOrders) {
    if (restHourGrid[o.restaurant_id]) {
      restHourGrid[o.restaurant_id][new Date(o.created_at).getHours()]++
    }
  }

  // ── Hourly totals ────────────────────────────────────────────────────────
  const hourlyTotals = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: grid.reduce((s, row) => s + row[h].count, 0),
    gmv: grid.reduce((s, row) => s + row[h].gmv, 0),
  }))
  const maxHourly = Math.max(...hourlyTotals.map(h => h.count), 1)

  // ── Stats ────────────────────────────────────────────────────────────────
  const totalOrders = allOrders.length
  const totalGmv = allOrders.reduce((s, o) => s + (o.total ?? 0), 0)
  const avgPerHour = totalOrders / (90 * 24)

  return (
    <div style={{ padding: '32px 28px', maxWidth: '1300px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ color: 'rgba(251,191,36,0.7)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Analytics</div>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.03em', marginBottom: '6px' }}>Order Heatmap</h1>
        <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.85rem' }}>Bestelldichte nach Wochentag × Uhrzeit — letzte 90 Tage · {totalOrders.toLocaleString('de')} Bestellungen</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
        {[
          { label: 'Bestellungen (90d)', value: totalOrders.toLocaleString('de'), color: '#c4b5fd' },
          { label: 'GMV (90d)', value: `€${(totalGmv / 1000).toFixed(1)}k`, color: '#34d399' },
          { label: 'Top Stunde', value: fmtHour(peakHour[0]?.hour ?? 12), color: '#fbbf24' },
          { label: 'Top Tag', value: peakDay[0]?.label ?? '—', color: '#60a5fa' },
        ].map(k => (
          <div key={k.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '16px 18px' }}>
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>{k.label}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Main Heatmap */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '24px', marginBottom: '24px', overflowX: 'auto' }}>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '4px' }}>Bestelldichte — Wochentag × Stunde</div>
        <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.7rem', marginBottom: '18px' }}>Farbe = Bestellanzahl (je dunkler = mehr Bestellungen)</div>

        {/* Hour labels */}
        <div style={{ display: 'flex', gap: '0', marginLeft: '32px', marginBottom: '4px' }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} style={{ flex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.5rem', minWidth: '24px' }}>
              {h % 3 === 0 ? `${h}h` : ''}
            </div>
          ))}
        </div>

        {/* Grid */}
        {DAYS.map((day, di) => (
          <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '3px' }}>
            <div style={{ width: '28px', color: 'rgba(255,255,255,0.35)', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 }}>{day}</div>
            {grid[di].map((cell, h) => {
              const intensity = cell.count / maxCount
              const r = Math.round(124 + (248 - 124) * intensity)
              const g = Math.round(58  + (113 - 58)  * (1 - intensity) * 0.3)
              const b = Math.round(237 + (113 - 237) * intensity)
              const bg = cell.count === 0
                ? 'rgba(255,255,255,0.03)'
                : `rgba(${r},${g < 0 ? 0 : g},${b < 0 ? 0 : b},${0.15 + intensity * 0.7})`
              return (
                <div
                  key={h}
                  title={`${day} ${fmtHour(h)}: ${cell.count} Orders · €${cell.gmv.toFixed(0)}`}
                  style={{
                    flex: 1, height: '28px', background: bg,
                    borderRadius: '3px', margin: '1px',
                    cursor: 'default', minWidth: '22px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'opacity 0.1s',
                  }}
                >
                  {cell.count > 0 && intensity > 0.6 && (
                    <span style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>{cell.count}</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', justifyContent: 'flex-end' }}>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.62rem' }}>Wenig</span>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map(v => (
            <div key={v} style={{ width: '20px', height: '12px', borderRadius: '3px', background: `rgba(${Math.round(124 + (248-124)*v)},${Math.round(Math.max(0,58+(113-58)*(1-v)*0.3))},${Math.round(Math.max(0,237+(113-237)*v))},${0.15+v*0.7})` }} />
          ))}
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.62rem' }}>Viel</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {/* Top hours */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '22px' }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '16px' }}>Stunden-Verteilung (gesamt)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '80px', marginBottom: '8px' }}>
            {hourlyTotals.map(h => {
              const pct = h.count / maxHourly
              const isPeak = h.hour === peakHour[0]?.hour
              return (
                <div key={h.hour} title={`${fmtHour(h.hour)}: ${h.count} Orders`}
                  style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <div style={{
                    width: '100%', height: `${Math.max(2, Math.round(pct * 76))}px`,
                    background: isPeak ? 'rgba(251,191,36,0.8)' : 'rgba(124,58,237,0.45)',
                    borderRadius: '2px 2px 0 0',
                  }} />
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.58rem' }}>0h</span>
            <span style={{ color: '#fbbf24', fontSize: '0.68rem', fontWeight: 700 }}>Peak: {fmtHour(peakHour[0]?.hour ?? 12)} ({peakHour[0]?.count ?? 0} Orders)</span>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.58rem' }}>23h</span>
          </div>
        </div>

        {/* Top days */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '22px' }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '16px' }}>Ranking nach Wochentag</div>
          {DAYS.map((d, i) => {
            const data = grid[i]
            const cnt = data.reduce((s, c) => s + c.count, 0)
            const gmv = data.reduce((s, c) => s + c.gmv, 0)
            const maxDay = Math.max(...DAYS.map((_, j) => grid[j].reduce((s, c) => s + c.count, 0)), 1)
            const isWeekend = i >= 5
            return (
              <div key={d} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ color: isWeekend ? '#fbbf24' : 'rgba(255,255,255,0.55)', fontSize: '0.78rem', fontWeight: 600 }}>{d}{isWeekend ? ' 🔥' : ''}</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem' }}>{cnt} · €{(gmv/1000).toFixed(1)}k</span>
                </div>
                <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(cnt / maxDay) * 100}%`, background: isWeekend ? 'rgba(251,191,36,0.7)' : 'rgba(124,58,237,0.5)', borderRadius: '3px' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top restaurants comparison */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '24px' }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>Stunden-Profil: Top 5 Restaurants</div>
        <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.7rem', marginBottom: '18px' }}>Bestellanzahl pro Stunde (letzte 90 Tage)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {topRests.slice(0, 5).map((r, ri) => {
            const hours = restHourGrid[r.id] ?? Array(24).fill(0)
            const maxH = Math.max(...hours, 1)
            const colors = ['#c4b5fd', '#60a5fa', '#34d399', '#fbbf24', '#f87171']
            return (
              <div key={r.id}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', marginBottom: '4px', fontWeight: 600 }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: colors[ri], marginRight: '6px' }} />
                  {r.name} <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400 }}>· {r.count} Orders</span>
                </div>
                <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '28px' }}>
                  {hours.map((cnt, h) => (
                    <div key={h} title={`${fmtHour(h)}: ${cnt}`} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <div style={{ width: '100%', height: `${Math.max(1, Math.round((cnt / maxH) * 26))}px`, background: `${colors[ri]}60`, borderRadius: '1px 1px 0 0' }} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingLeft: '14px' }}>
          <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: '0.55rem' }}>0h</span>
          <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: '0.55rem' }}>12h</span>
          <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: '0.55rem' }}>23h</span>
        </div>
      </div>
    </div>
  )
}
