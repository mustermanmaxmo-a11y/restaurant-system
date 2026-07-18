import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

const PLAN_MRR: Record<string, number> = { starter: 29, pro: 79, enterprise: 199, trial: 0, expired: 0 }

function monthKey(d: string) {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleString('de-DE', { month: 'short', year: '2-digit' })
}

export default async function CohortsPage() {
  await requirePlatformAccess()
  const admin = createSupabaseAdmin()

  const now = new Date()
  const d18m = new Date(now.getTime() - 18 * 30 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: restaurants }, { data: allOrders }] = await Promise.all([
    admin.from('restaurants')
      .select('id, plan, active, created_at, trial_ends_at')
      .gte('created_at', d18m)
      .order('created_at'),
    admin.from('orders')
      .select('restaurant_id, total, created_at')
      .gte('created_at', d18m),
  ])

  const rests = restaurants ?? []
  const orders = allOrders ?? []

  // ── 1. Monthly signup cohorts ────────────────────────────────────────────────
  const cohortMonths = [...new Set(rests.map(r => monthKey(r.created_at)))].sort()

  // Build per-restaurant last-active month (last order month)
  const lastActiveByRest = new Map<string, string>()
  for (const o of orders) {
    const om = monthKey(o.created_at)
    const prev = lastActiveByRest.get(o.restaurant_id)
    if (!prev || om > prev) lastActiveByRest.set(o.restaurant_id, om)
  }

  // All months from d18m until now for column headers
  const allMonths: string[] = []
  const cur = new Date(d18m)
  while (cur <= now) {
    allMonths.push(monthKey(cur.toISOString()))
    cur.setMonth(cur.getMonth() + 1)
  }

  // Cohort retention: for each cohort month, how many are still active (ordered in) each subsequent month
  type CohortRow = {
    month: string
    signups: number
    paid: number
    trialConversion: number
    mrrAtStart: number
    retention: number[] // % for each offset 0..N
    offsets: number[]
  }

  const cohortRows: CohortRow[] = cohortMonths.map(cm => {
    const cohortRests = rests.filter(r => monthKey(r.created_at) === cm)
    const cmIdx = allMonths.indexOf(cm)
    const offsets = allMonths.slice(cmIdx).map((_, i) => i)

    const restIds = new Set(cohortRests.map(r => r.id))
    const restOrderMonths = new Map<string, Set<string>>()
    for (const o of orders) {
      if (!restIds.has(o.restaurant_id)) continue
      if (!restOrderMonths.has(o.restaurant_id)) restOrderMonths.set(o.restaurant_id, new Set())
      restOrderMonths.get(o.restaurant_id)!.add(monthKey(o.created_at))
    }

    const paid = cohortRests.filter(r => r.plan !== 'trial' && r.plan !== 'expired').length
    const mrrAtStart = cohortRests.reduce((s, r) => s + (PLAN_MRR[r.plan] ?? 0), 0)

    const retention = allMonths.slice(cmIdx).map(targetMonth => {
      const active = cohortRests.filter(r => restOrderMonths.get(r.id)?.has(targetMonth)).length
      return cohortRests.length > 0 ? Math.round((active / cohortRests.length) * 100) : 0
    })

    return {
      month: cm,
      signups: cohortRests.length,
      paid,
      trialConversion: cohortRests.length > 0 ? Math.round((paid / cohortRests.length) * 100) : 0,
      mrrAtStart,
      retention,
      offsets,
    }
  })

  // ── 2. Monthly MRR trend ────────────────────────────────────────────────────
  const mrrByMonth = allMonths.map(m => {
    const monthRests = rests.filter(r => monthKey(r.created_at) <= m)
    const mrr = monthRests.reduce((s, r) => {
      if (r.plan === 'trial' || r.plan === 'expired') return s
      return s + (PLAN_MRR[r.plan] ?? 0)
    }, 0)
    const rev = orders.filter(o => monthKey(o.created_at) === m).reduce((s, o) => s + (o.total ?? 0), 0)
    return { month: m, mrr, gmv: rev }
  })

  const maxMrr = Math.max(...mrrByMonth.map(x => x.mrr), 1)
  const maxGmv = Math.max(...mrrByMonth.map(x => x.gmv), 1)

  // ── 3. Plan distribution trend ──────────────────────────────────────────────
  const plansByMonth = allMonths.map(m => {
    const active = rests.filter(r => monthKey(r.created_at) <= m)
    const counts: Record<string, number> = {}
    for (const r of active) counts[r.plan] = (counts[r.plan] ?? 0) + 1
    return { month: m, counts, total: active.length }
  })

  // ── 4. Trial → Paid funnel ──────────────────────────────────────────────────
  const totalSignups = rests.length
  const totalEverPaid = rests.filter(r => r.plan !== 'trial' && r.plan !== 'expired').length
  const totalActive = rests.filter(r => r.active).length
  const totalExpired = rests.filter(r => r.plan === 'expired').length
  const overallConversion = totalSignups > 0 ? Math.round((totalEverPaid / totalSignups) * 100) : 0

  // ── 5. Week-by-week new restaurants ────────────────────────────────────────
  const weeks: { label: string; count: number; paid: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const wStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000)
    const wEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
    const wRests = rests.filter(r => new Date(r.created_at) >= wStart && new Date(r.created_at) < wEnd)
    weeks.push({
      label: wStart.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
      count: wRests.length,
      paid: wRests.filter(r => r.plan !== 'trial' && r.plan !== 'expired').length,
    })
  }
  const maxWeek = Math.max(...weeks.map(w => w.count), 1)

  return (
    <div style={{ padding: '32px 28px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ color: 'rgba(196,181,253,0.7)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
          Wachstum
        </div>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.92)', marginBottom: '6px', letterSpacing: '-0.03em' }}>
          Cohort Analysis
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
          Monatliche Kohorten · Trial-Conversion · Retention · MRR-Trend
        </p>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
        {[
          { label: 'Gesamt Signups', value: totalSignups, sub: 'letzte 18 Monate', color: '#7dd3e8' },
          { label: 'Konversion', value: `${overallConversion}%`, sub: `${totalEverPaid} zu Paid`, color: '#34d399' },
          { label: 'Aktiv', value: totalActive, sub: `${Math.round(totalActive/Math.max(totalSignups,1)*100)}% der Signups`, color: '#60a5fa' },
          { label: 'Abgelaufen', value: totalExpired, sub: `${Math.round(totalExpired/Math.max(totalSignups,1)*100)}% Churn`, color: '#f87171' },
        ].map(k => (
          <div key={k.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '18px 20px' }}>
            <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{k.label}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: k.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{k.value}</div>
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem', marginTop: '5px' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Weekly signups chart */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '24px', marginBottom: '28px' }}>
        <div style={{ marginBottom: '18px' }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: '0.9rem' }}>Neue Restaurants / Woche</div>
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.73rem' }}>letzte 12 Wochen</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px' }}>
          {weeks.map((w, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>{w.count || ''}</div>
              <div style={{ width: '100%', borderRadius: '3px 3px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', height: `${Math.round((w.count / maxWeek) * 72)}px`, background: `linear-gradient(180deg, rgba(14,116,144,0.7), rgba(79,70,229,0.4))`, borderRadius: '3px 3px 0 0', transition: 'height 0.3s' }} />
              </div>
              <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}>{w.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* MRR + GMV dual chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '28px' }}>
        {/* MRR trend */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '22px' }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '4px' }}>Kumuliertes MRR</div>
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.7rem', marginBottom: '16px' }}>nach Signup-Monat</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px' }}>
            {mrrByMonth.map((m, i) => (
              <div key={i} title={`${monthLabel(m.month)}: €${m.mrr}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                <div style={{ width: '100%', height: `${Math.max(2, Math.round((m.mrr / maxMrr) * 76))}px`, background: 'rgba(52,211,153,0.5)', borderRadius: '2px 2px 0 0' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.58rem' }}>{monthLabel(allMonths[0])}</span>
            <span style={{ color: '#34d399', fontSize: '0.7rem', fontWeight: 700 }}>€{mrrByMonth[mrrByMonth.length - 1]?.mrr ?? 0}/mo</span>
          </div>
        </div>

        {/* GMV trend */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '22px' }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '4px' }}>GMV (Bestellungen)</div>
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.7rem', marginBottom: '16px' }}>monatlicher Umsatz über die Plattform</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px' }}>
            {mrrByMonth.map((m, i) => (
              <div key={i} title={`${monthLabel(m.month)}: €${m.gmv.toFixed(0)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                <div style={{ width: '100%', height: `${Math.max(2, Math.round((m.gmv / maxGmv) * 76))}px`, background: 'rgba(251,191,36,0.5)', borderRadius: '2px 2px 0 0' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.58rem' }}>{monthLabel(allMonths[0])}</span>
            <span style={{ color: '#fbbf24', fontSize: '0.7rem', fontWeight: 700 }}>€{(mrrByMonth[mrrByMonth.length - 1]?.gmv ?? 0).toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Cohort Retention Table */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden', marginBottom: '28px' }}>
        <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: '0.9rem' }}>Cohort Retention Matrix</div>
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem', marginTop: '3px' }}>
            % der Signups aus Monat X mit mind. 1 Bestellung in Monat X+N
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.28)', fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Kohorte</th>
                <th style={{ padding: '10px 10px', color: 'rgba(255,255,255,0.28)', fontWeight: 700, textAlign: 'center', fontSize: '0.65rem' }}>Signups</th>
                <th style={{ padding: '10px 10px', color: 'rgba(255,255,255,0.28)', fontWeight: 700, textAlign: 'center', fontSize: '0.65rem' }}>→ Paid</th>
                <th style={{ padding: '10px 10px', color: 'rgba(255,255,255,0.28)', fontWeight: 700, textAlign: 'center', fontSize: '0.65rem' }}>MRR</th>
                {Array.from({ length: Math.min(7, allMonths.length) }, (_, i) => (
                  <th key={i} style={{ padding: '10px 6px', color: 'rgba(255,255,255,0.28)', fontWeight: 700, textAlign: 'center', fontSize: '0.65rem' }}>M+{i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohortRows.map((row, ri) => (
                <tr key={row.month} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.65)', fontWeight: 600, whiteSpace: 'nowrap' }}>{monthLabel(row.month)}</td>
                  <td style={{ padding: '10px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>{row.signups}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <span style={{ color: row.trialConversion >= 30 ? '#34d399' : row.trialConversion >= 10 ? '#fbbf24' : '#f87171', fontWeight: 700 }}>
                      {row.trialConversion}%
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center', color: '#35c0db', fontWeight: 700 }}>
                    {row.mrrAtStart > 0 ? `€${row.mrrAtStart}` : '—'}
                  </td>
                  {row.retention.slice(0, 7).map((pct, i) => {
                    const bg = pct === 0 ? 'transparent'
                      : pct >= 70 ? `rgba(52,211,153,${0.1 + pct / 500})`
                      : pct >= 40 ? `rgba(251,191,36,${0.08 + pct / 600})`
                      : `rgba(248,113,113,${0.08 + pct / 700})`
                    const color = pct === 0 ? 'rgba(255,255,255,0.1)'
                      : pct >= 70 ? '#34d399'
                      : pct >= 40 ? '#fbbf24'
                      : '#f87171'
                    return (
                      <td key={i} style={{ padding: '8px 6px', textAlign: 'center', background: bg, borderLeft: '1px solid rgba(255,255,255,0.03)' }}>
                        <span style={{ color, fontWeight: pct > 0 ? 700 : 400, fontSize: '0.7rem' }}>
                          {pct > 0 ? `${pct}%` : ri === 0 && i === 0 ? '—' : '·'}
                        </span>
                      </td>
                    )
                  })}
                  {/* Pad missing months */}
                  {Array.from({ length: Math.max(0, 7 - row.retention.length) }, (_, i) => (
                    <td key={`pad-${i}`} style={{ padding: '8px 6px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderLeft: '1px solid rgba(255,255,255,0.03)' }}>
                      <span style={{ color: 'rgba(255,255,255,0.07)' }}>·</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plan distribution trend */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '22px' }}>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>Plan-Mix Entwicklung</div>
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem', marginBottom: '18px' }}>kumulierte Anzahl je Plan pro Monat</div>
        <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '80px' }}>
          {plansByMonth.map((m, i) => {
            const t = Math.max(m.total, 1)
            const plans = [
              { key: 'enterprise', color: 'rgba(53,192,219,0.7)' },
              { key: 'pro', color: 'rgba(251,191,36,0.7)' },
              { key: 'starter', color: 'rgba(52,211,153,0.7)' },
              { key: 'trial', color: 'rgba(96,165,250,0.5)' },
              { key: 'expired', color: 'rgba(248,113,113,0.4)' },
            ]
            return (
              <div key={i} title={monthLabel(m.month)} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', borderRadius: '2px 2px 0 0', overflow: 'hidden', gap: '1px' }}>
                {plans.map(p => {
                  const cnt = m.counts[p.key] ?? 0
                  const h = Math.round((cnt / t) * 76)
                  return h > 0 ? (
                    <div key={p.key} style={{ width: '100%', height: `${h}px`, background: p.color, flexShrink: 0 }} />
                  ) : null
                })}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: '14px', marginTop: '14px', flexWrap: 'wrap' }}>
          {[
            { label: 'Enterprise', color: '#35c0db' },
            { label: 'Pro', color: '#fbbf24' },
            { label: 'Starter', color: '#34d399' },
            { label: 'Trial', color: '#60a5fa' },
            { label: 'Expired', color: '#f87171' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: l.color }} />
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
