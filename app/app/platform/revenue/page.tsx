import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const PLAN_MRR: Record<string, number> = { starter: 29, pro: 79, enterprise: 199, trial: 0, expired: 0 }
const PLAN_COLOR: Record<string, string> = {
  trial: '#60a5fa', starter: '#34d399', pro: '#fbbf24', enterprise: '#a78bfa', expired: '#f87171',
}

function fmt(n: number) { return n >= 1000 ? `€${(n / 1000).toFixed(1)}k` : `€${n.toFixed(0)}` }

export default async function RevenuePage() {
  await requirePlatformAccess()
  const admin = createSupabaseAdmin()

  const now = Date.now()
  const d365 = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString()
  const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
  const d60 = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString()
  const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: restaurants }, { data: allOrders }] = await Promise.all([
    admin.from('restaurants').select('id, name, slug, plan, active, created_at, stripe_subscription_id'),
    admin.from('orders')
      .select('restaurant_id, total, created_at, status')
      .gte('created_at', d365)
      .neq('status', 'cancelled'),
  ])

  const rests = restaurants ?? []
  const orders = allOrders ?? []

  // MRR breakdown
  const mrrByPlan: Record<string, number> = {}
  const countByPlan: Record<string, number> = {}
  for (const r of rests) {
    mrrByPlan[r.plan] = (mrrByPlan[r.plan] ?? 0) + (PLAN_MRR[r.plan] ?? 0)
    countByPlan[r.plan] = (countByPlan[r.plan] ?? 0) + 1
  }
  const totalMrr = Object.values(mrrByPlan).reduce((s, v) => s + v, 0)

  // GMV metrics
  const gmv30 = orders.filter(o => o.created_at >= d30).reduce((s, o) => s + (o.total ?? 0), 0)
  const gmvPrev30 = orders.filter(o => o.created_at >= d60 && o.created_at < d30).reduce((s, o) => s + (o.total ?? 0), 0)
  const gmv7 = orders.filter(o => o.created_at >= d7).reduce((s, o) => s + (o.total ?? 0), 0)
  const gmv365 = orders.reduce((s, o) => s + (o.total ?? 0), 0)
  const gmvGrowth = gmvPrev30 > 0 ? ((gmv30 - gmvPrev30) / gmvPrev30) * 100 : 0

  // Monthly GMV last 13 months
  const monthlyGmv: { label: string; gmv: number; orders: number; key: string }[] = []
  for (let i = 12; i >= 0; i--) {
    const mStart = new Date(now); mStart.setDate(1); mStart.setMonth(mStart.getMonth() - i); mStart.setHours(0,0,0,0)
    const mEnd = new Date(mStart); mEnd.setMonth(mEnd.getMonth() + 1)
    const mo = orders.filter(o => o.created_at >= mStart.toISOString() && o.created_at < mEnd.toISOString())
    const key = `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2,'0')}`
    monthlyGmv.push({
      label: mStart.toLocaleString('de-DE', { month: 'short', year: '2-digit' }),
      gmv: mo.reduce((s, o) => s + (o.total ?? 0), 0),
      orders: mo.length,
      key,
    })
  }
  const maxMonthGmv = Math.max(...monthlyGmv.map(m => m.gmv), 1)

  // Daily GMV last 30 days
  const dailyGmv: { label: string; gmv: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const dStart = new Date(now - (i + 1) * 24 * 60 * 60 * 1000)
    const dEnd = new Date(now - i * 24 * 60 * 60 * 1000)
    dStart.setHours(0,0,0,0); dEnd.setHours(0,0,0,0)
    const do_ = orders.filter(o => o.created_at >= dStart.toISOString() && o.created_at < dEnd.toISOString())
    dailyGmv.push({
      label: dStart.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
      gmv: do_.reduce((s, o) => s + (o.total ?? 0), 0),
    })
  }
  const maxDayGmv = Math.max(...dailyGmv.map(d => d.gmv), 1)

  // Revenue by restaurant (top 20)
  const restRevenue = rests.map(r => {
    const ro = orders.filter(o => o.restaurant_id === r.id)
    const rev30 = orders.filter(o => o.restaurant_id === r.id && o.created_at >= d30).reduce((s, o) => s + (o.total ?? 0), 0)
    return { ...r, gmv: ro.reduce((s, o) => s + (o.total ?? 0), 0), gmv30: rev30, orderCount: ro.length }
  }).sort((a, b) => b.gmv - a.gmv).slice(0, 20)

  // Order size distribution (buckets)
  const buckets = [
    { label: '<€10', min: 0, max: 10 }, { label: '€10–25', min: 10, max: 25 },
    { label: '€25–50', min: 25, max: 50 }, { label: '€50–100', min: 50, max: 100 },
    { label: '>€100', min: 100, max: Infinity },
  ]
  const dist = buckets.map(b => ({
    ...b, count: orders.filter(o => (o.total ?? 0) >= b.min && (o.total ?? 0) < b.max).length
  }))
  const maxDist = Math.max(...dist.map(d => d.count), 1)

  // Platform take rate (example: platform earns nothing from orders but tracks GMV)
  const avgOrderSize = orders.length > 0 ? orders.reduce((s, o) => s + (o.total ?? 0), 0) / orders.length : 0

  return (
    <div style={{ padding: '32px 28px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ color: 'rgba(52,211,153,0.7)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Finance</div>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.03em', marginBottom: '6px' }}>Revenue Intelligence</h1>
        <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.85rem' }}>MRR, GMV, Wachstum und Verteilungen — letztes Jahr</p>
      </div>

      {/* Top KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '28px' }}>
        {[
          { label: 'MRR', value: `€${totalMrr}`, sub: `€${totalMrr * 12} ARR`, color: '#34d399' },
          { label: 'GMV (30d)', value: fmt(gmv30), sub: `${gmvGrowth >= 0 ? '+' : ''}${gmvGrowth.toFixed(0)}% vs. Vormonat`, color: gmvGrowth >= 0 ? '#34d399' : '#f87171' },
          { label: 'GMV (7d)', value: fmt(gmv7), sub: 'letzte 7 Tage', color: '#60a5fa' },
          { label: 'GMV (1 Jahr)', value: fmt(gmv365), sub: `Ø ${fmt(gmv365 / 12)}/mo`, color: '#a78bfa' },
          { label: 'Ø Bestellwert', value: `€${avgOrderSize.toFixed(2)}`, sub: `${orders.length} Orders gesamt`, color: '#fbbf24' },
        ].map(k => (
          <div key={k.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '16px 18px' }}>
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>{k.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: k.color, lineHeight: 1, marginBottom: '4px' }}>{k.value}</div>
            <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.68rem' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* MRR by Plan */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '22px', marginBottom: '20px' }}>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '16px' }}>MRR nach Plan</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {['enterprise', 'pro', 'starter', 'trial', 'expired'].map(plan => {
            const mrr = mrrByPlan[plan] ?? 0
            const cnt = countByPlan[plan] ?? 0
            const pct = totalMrr > 0 ? (mrr / totalMrr) * 100 : 0
            return (
              <div key={plan}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: PLAN_COLOR[plan] ?? '#888', display: 'inline-block' }} />
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontWeight: 600 }}>{plan}</span>
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>{cnt}×</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>{pct.toFixed(0)}%</span>
                    <span style={{ color: PLAN_COLOR[plan] ?? '#888', fontWeight: 700, fontSize: '0.82rem', minWidth: '60px', textAlign: 'right' }}>{mrr > 0 ? `€${mrr}` : '—'}</span>
                  </div>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: PLAN_COLOR[plan] ?? '#888', borderRadius: '2px' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Monthly GMV chart + Daily */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '16px', marginBottom: '20px' }}>
        {/* Monthly */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '22px' }}>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '4px' }}>GMV pro Monat</div>
          <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.7rem', marginBottom: '16px' }}>letzte 13 Monate</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '90px' }}>
            {monthlyGmv.map((m, i) => {
              const h = Math.max(2, Math.round((m.gmv / maxMonthGmv) * 84))
              const isLast = i === monthlyGmv.length - 1
              return (
                <div key={m.key} title={`${m.label}: ${fmt(m.gmv)} · ${m.orders} Orders`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%', gap: '4px' }}>
                  {m.gmv > 0 && <div style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.2)' }}>{fmt(m.gmv)}</div>}
                  <div style={{ width: '100%', height: `${h}px`, background: isLast ? 'rgba(52,211,153,0.7)' : 'rgba(124,58,237,0.45)', borderRadius: '3px 3px 0 0' }} />
                  <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.18)', whiteSpace: 'nowrap' }}>{m.label}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Order size distribution */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '22px' }}>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '4px' }}>Bestellgröße</div>
          <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.7rem', marginBottom: '16px' }}>Verteilung aller Orders</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {dist.map(b => (
              <div key={b.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem' }}>{b.label}</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem' }}>{b.count}</span>
                </div>
                <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(b.count / maxDist) * 100}%`, background: 'rgba(251,191,36,0.6)', borderRadius: '3px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily GMV sparkline */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '22px', marginBottom: '20px' }}>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '4px' }}>Täglicher GMV (30d)</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '60px' }}>
          {dailyGmv.map((d, i) => {
            const h = Math.max(2, Math.round((d.gmv / maxDayGmv) * 56))
            return (
              <div key={i} title={`${d.label}: ${fmt(d.gmv)}`} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', height: `${h}px`, background: d.gmv > 0 ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.04)', borderRadius: '2px 2px 0 0' }} />
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.6rem' }}>{dailyGmv[0]?.label}</span>
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.6rem' }}>heute</span>
        </div>
      </div>

      {/* Restaurant revenue table */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 700, fontSize: '0.88rem' }}>Top 20 Restaurants nach GMV</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              {['#', 'Restaurant', 'Plan', 'MRR', 'GMV (1J)', 'GMV (30d)', 'Orders', 'Ø/Order'].map(h => (
                <th key={h} style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.2)', fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {restRevenue.map((r, i) => (
              <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '9px 14px', color: i < 3 ? '#fbbf24' : 'rgba(255,255,255,0.2)', fontWeight: 700 }}>{i + 1}</td>
                <td style={{ padding: '9px 14px' }}>
                  <Link href={`/platform/restaurants/${r.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{r.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.65rem' }}>/{r.slug}</div>
                  </Link>
                </td>
                <td style={{ padding: '9px 14px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '10px', background: `${PLAN_COLOR[r.plan] ?? '#888'}18`, color: PLAN_COLOR[r.plan] ?? '#888', fontSize: '0.65rem', fontWeight: 700 }}>{r.plan}</span>
                </td>
                <td style={{ padding: '9px 14px', color: '#34d399', fontWeight: 600 }}>{PLAN_MRR[r.plan] > 0 ? `€${PLAN_MRR[r.plan]}` : '—'}</td>
                <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>{fmt(r.gmv)}</td>
                <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.5)' }}>{fmt(r.gmv30)}</td>
                <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.4)' }}>{r.orderCount}</td>
                <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.35)' }}>{r.orderCount > 0 ? `€${(r.gmv / r.orderCount).toFixed(2)}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
