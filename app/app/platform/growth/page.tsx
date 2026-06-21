import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

const PLAN_MRR: Record<string, number> = { starter: 29, pro: 79, enterprise: 199, trial: 0, expired: 0 }

function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0 }

export default async function GrowthPage() {
  await requirePlatformAccess()
  const admin = createSupabaseAdmin()

  const now = Date.now()
  const d7   = new Date(now - 7   * 24 * 60 * 60 * 1000).toISOString()
  const d14  = new Date(now - 14  * 24 * 60 * 60 * 1000).toISOString()
  const d30  = new Date(now - 30  * 24 * 60 * 60 * 1000).toISOString()
  const d90  = new Date(now - 90  * 24 * 60 * 60 * 1000).toISOString()
  const d180 = new Date(now - 180 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: allRests }, { data: allOrders }] = await Promise.all([
    admin.from('restaurants').select('id, plan, active, created_at, trial_ends_at'),
    admin.from('orders').select('restaurant_id, total, created_at, status').gte('created_at', d180),
  ])

  const rests = allRests ?? []
  const orders = allOrders ?? []

  // ── Funnel stages ─────────────────────────────────────────────────────────
  const totalSignups = rests.length
  const hasAnyOrder = new Set(orders.map(o => o.restaurant_id))
  const activated   = rests.filter(r => hasAnyOrder.has(r.id)).length        // at least 1 order ever
  const active7d    = new Set(orders.filter(o => o.created_at >= d7).map(o => o.restaurant_id)).size
  const active30d   = new Set(orders.filter(o => o.created_at >= d30).map(o => o.restaurant_id)).size
  const paid        = rests.filter(r => r.plan !== 'trial' && r.plan !== 'expired').length
  const retained90  = rests.filter(r => {
    if (new Date(r.created_at).getTime() > now - 90 * 24 * 60 * 60 * 1000) return false
    return orders.some(o => o.restaurant_id === r.id && o.created_at >= d30)
  }).length

  const stages = [
    { label: 'Signups', value: totalSignups, pctOf: null, color: '#c4b5fd', desc: 'Alle registrierten Restaurants' },
    { label: 'Aktiviert', value: activated, pctOf: totalSignups, color: '#60a5fa', desc: 'Mind. 1 Bestellung je platziert' },
    { label: 'Aktiv (30d)', value: active30d, pctOf: activated, color: '#34d399', desc: 'Bestellung in letzten 30 Tagen' },
    { label: 'Aktiv (7d)', value: active7d, pctOf: active30d, color: '#34d399', desc: 'Bestellung in letzten 7 Tagen' },
    { label: 'Paid', value: paid, pctOf: activated, color: '#fbbf24', desc: 'Starter / Pro / Enterprise' },
    { label: 'Retained (90d+)', value: retained90, pctOf: paid, color: '#a78bfa', desc: 'Paid & noch aktiv nach 90d' },
  ]

  // ── Weekly new signups last 24 weeks ──────────────────────────────────────
  const weeks: { label: string; signups: number; paid: number; activated: number }[] = []
  for (let i = 23; i >= 0; i--) {
    const wStart = new Date(now - (i + 1) * 7 * 24 * 60 * 60 * 1000)
    const wEnd   = new Date(now - i       * 7 * 24 * 60 * 60 * 1000)
    const wRests = rests.filter(r => {
      const t = new Date(r.created_at).getTime()
      return t >= wStart.getTime() && t < wEnd.getTime()
    })
    const wActivated = wRests.filter(r => orders.some(o => o.restaurant_id === r.id)).length
    weeks.push({
      label: wStart.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
      signups: wRests.length,
      paid: wRests.filter(r => r.plan !== 'trial' && r.plan !== 'expired').length,
      activated: wActivated,
    })
  }
  const maxWeek = Math.max(...weeks.map(w => w.signups), 1)

  // ── Day-1 / Day-7 / Day-30 activation rate (cohort) ──────────────────────
  type ActivationRow = { label: string; total: number; d1: number; d7: number; d30: number }
  const activationRows: ActivationRow[] = []

  for (let i = 5; i >= 0; i--) {
    const mStart = new Date(now); mStart.setDate(1); mStart.setMonth(mStart.getMonth() - i); mStart.setHours(0,0,0,0)
    const mEnd   = new Date(mStart); mEnd.setMonth(mEnd.getMonth() + 1)
    const cohort = rests.filter(r => new Date(r.created_at) >= mStart && new Date(r.created_at) < mEnd)
    if (cohort.length === 0) continue

    const d1Act  = cohort.filter(r => orders.some(o => o.restaurant_id === r.id && new Date(o.created_at).getTime() - new Date(r.created_at).getTime() < 1  * 24 * 60 * 60 * 1000)).length
    const d7Act  = cohort.filter(r => orders.some(o => o.restaurant_id === r.id && new Date(o.created_at).getTime() - new Date(r.created_at).getTime() < 7  * 24 * 60 * 60 * 1000)).length
    const d30Act = cohort.filter(r => orders.some(o => o.restaurant_id === r.id && new Date(o.created_at).getTime() - new Date(r.created_at).getTime() < 30 * 24 * 60 * 60 * 1000)).length

    activationRows.push({
      label: mStart.toLocaleString('de-DE', { month: 'short', year: '2-digit' }),
      total: cohort.length,
      d1:  pct(d1Act,  cohort.length),
      d7:  pct(d7Act,  cohort.length),
      d30: pct(d30Act, cohort.length),
    })
  }

  // ── MRR growth week-over-week ────────────────────────────────────────────
  const mrrWeeks = weeks.map(w => {
    // MRR = sum over all paid restaurants created up to that week's end
    // (simplified: count paid rests at end of that period)
    return 0 // placeholder — actual MRR growth requires historical plan snapshots
  })

  // ── Plan upgrade funnel ──────────────────────────────────────────────────
  const planCounts: Record<string, number> = {}
  for (const r of rests) planCounts[r.plan] = (planCounts[r.plan] ?? 0) + 1

  // ── Engagement score distribution ────────────────────────────────────────
  const engScores = rests.map(r => {
    const ro = orders.filter(o => o.restaurant_id === r.id)
    const ro7 = ro.filter(o => o.created_at >= d7).length
    const ro30 = ro.filter(o => o.created_at >= d30).length
    let score = 0
    if (ro30 > 0) score += 30
    if (ro7 > 0)  score += 30
    if (ro30 >= 20) score += 20
    else if (ro30 >= 5) score += 10
    if (r.plan !== 'trial' && r.plan !== 'expired') score += 20
    return Math.min(score, 100)
  })

  const engBuckets = [
    { label: '0', min: 0,  max: 1,   color: 'rgba(248,113,113,0.5)' },
    { label: '1–25', min: 1,  max: 26,  color: 'rgba(251,191,36,0.4)' },
    { label: '26–50', min: 26, max: 51,  color: 'rgba(251,191,36,0.6)' },
    { label: '51–75', min: 51, max: 76,  color: 'rgba(52,211,153,0.5)' },
    { label: '76–100', min: 76, max: 101, color: 'rgba(52,211,153,0.8)' },
  ].map(b => ({ ...b, count: engScores.filter(s => s >= b.min && s < b.max).length }))
  const maxEng = Math.max(...engBuckets.map(b => b.count), 1)

  return (
    <div style={{ padding: '32px 28px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ color: 'rgba(52,211,153,0.7)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Wachstum</div>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.03em', marginBottom: '6px' }}>Growth Funnel</h1>
        <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.85rem' }}>Aktivierungs-Funnel · Engagement-Score · Wöchentliche Signups · Retention</p>
      </div>

      {/* Funnel */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '28px', marginBottom: '24px' }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '20px' }}>Aktivierungs-Funnel</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {stages.map((s, i) => {
            const convPct = s.pctOf !== null ? pct(s.value, s.pctOf) : 100
            const barW = s.pctOf !== null ? (s.value / Math.max(s.pctOf, 1)) * 100 : 100
            return (
              <div key={s.label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                  <div style={{ width: '120px', flexShrink: 0 }}>
                    <div style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 700, fontSize: '0.8rem' }}>{s.label}</div>
                    <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem' }}>{s.desc}</div>
                  </div>
                  <div style={{ flex: 1, position: 'relative', height: '28px' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.04)', borderRadius: '6px' }} />
                    <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${barW}%`, background: s.color, borderRadius: '6px', opacity: 0.7, transition: 'width 0.3s' }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', paddingLeft: '10px', gap: '8px' }}>
                      <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.82rem' }}>{s.value.toLocaleString('de')}</span>
                      {s.pctOf !== null && (
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem' }}>({convPct}% des vorigen Schritts)</span>
                      )}
                    </div>
                  </div>
                  {s.pctOf !== null && i > 0 && (
                    <div style={{ width: '48px', textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)' }}>Drop-off</div>
                      <div style={{ fontWeight: 700, fontSize: '0.78rem', color: (100 - convPct) > 50 ? '#f87171' : '#fbbf24' }}>{100 - convPct}%</div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Weekly signups chart */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '4px' }}>Signups pro Woche (24 Wochen)</div>
        <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '0.7rem', marginBottom: '16px' }}>
          Grün = Anteil Aktivierter, Violett = nicht aktiviert
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '90px' }}>
          {weeks.map((w, i) => {
            const total = w.signups
            const actH = total > 0 ? Math.round((w.activated / total) * (w.signups / maxWeek * 84)) : 0
            const totalH = Math.max(2, Math.round((w.signups / maxWeek) * 84))
            return (
              <div key={i} title={`KW ${w.label}: ${w.signups} Signups · ${w.activated} aktiviert`}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', gap: '0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: `${totalH}px` }}>
                  <div style={{ height: `${actH}px`, background: 'rgba(52,211,153,0.6)', borderRadius: '0' }} />
                  <div style={{ height: `${totalH - actH}px`, background: 'rgba(124,58,237,0.35)', borderRadius: '2px 2px 0 0' }} />
                </div>
                {i % 4 === 0 && <div style={{ fontSize: '0.48rem', color: 'rgba(255,255,255,0.15)', marginTop: '3px', textAlign: 'center' }}>{w.label}</div>}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {/* Activation rate by cohort */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.85rem' }}>Aktivierungsrate nach Kohorte</div>
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem', marginTop: '2px' }}>% die innerhalb von D1/D7/D30 erste Bestellung platzierten</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.77rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Kohorte', 'Signups', 'D+1', 'D+7', 'D+30'].map(h => (
                  <th key={h} style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.22)', fontWeight: 700, fontSize: '0.63rem', textTransform: 'uppercase', textAlign: h === 'Kohorte' ? 'left' : 'center', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activationRows.map(r => (
                <tr key={r.label} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{r.label}</td>
                  <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>{r.total}</td>
                  {[r.d1, r.d7, r.d30].map((v, i) => (
                    <td key={i} style={{ padding: '9px 14px', textAlign: 'center' }}>
                      <span style={{ color: v >= 50 ? '#34d399' : v >= 20 ? '#fbbf24' : '#f87171', fontWeight: 700 }}>{v}%</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Engagement score distribution */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>Engagement Score Verteilung</div>
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem', marginBottom: '16px' }}>0–100 · basierend auf Bestellfrequenz & Plan</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '80px', marginBottom: '12px' }}>
            {engBuckets.map(b => (
              <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: '3px' }}>
                <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)' }}>{b.count}</div>
                <div style={{ width: '100%', height: `${Math.max(3, Math.round((b.count / maxEng) * 70))}px`, background: b.color, borderRadius: '3px 3px 0 0' }} />
                <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.2)' }}>{b.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {[
              { label: 'Inaktiv (Score 0)', count: engBuckets[0].count, color: '#f87171' },
              { label: 'Low', count: engBuckets[1].count + engBuckets[2].count, color: '#fbbf24' },
              { label: 'High', count: engBuckets[3].count + engBuckets[4].count, color: '#34d399' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: l.color, display: 'inline-block' }} />
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem' }}>{l.label}: <strong style={{ color: l.color }}>{l.count}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Plan distribution */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '22px' }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '16px' }}>Plan-Verteilung aller Restaurants</div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { plan: 'trial',      color: '#60a5fa', mrr: 0 },
            { plan: 'starter',    color: '#34d399', mrr: 29 },
            { plan: 'pro',        color: '#fbbf24', mrr: 79 },
            { plan: 'enterprise', color: '#a78bfa', mrr: 199 },
            { plan: 'expired',    color: '#f87171', mrr: 0 },
          ].map(p => {
            const cnt = planCounts[p.plan] ?? 0
            const totalCnt = rests.length
            return (
              <div key={p.plan} style={{ background: `${p.color}08`, border: `1px solid ${p.color}20`, borderRadius: '12px', padding: '14px 18px', minWidth: '130px' }}>
                <div style={{ color: p.color, fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '6px' }}>{p.plan}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: p.color, lineHeight: 1, marginBottom: '2px' }}>{cnt}</div>
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem' }}>
                  {pct(cnt, totalCnt)}% · {p.mrr > 0 ? `€${cnt * p.mrr}/mo` : '—'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
