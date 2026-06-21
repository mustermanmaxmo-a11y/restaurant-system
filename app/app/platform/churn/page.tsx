import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const PLAN_MRR: Record<string, number> = { starter: 29, pro: 79, enterprise: 199, trial: 0, expired: 0 }

type ChurnScore = {
  id: string; name: string; slug: string; plan: string; active: boolean
  score: number; signals: string[]; mrr: number; lastOrderDaysAgo: number | null
  orderCount30: number; orderCount60: number; trialEndsInDays: number | null
  stripeOk: boolean
}

function churnColor(score: number) {
  if (score >= 75) return { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', label: 'Kritisch' }
  if (score >= 50) return { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)', label: 'Risiko' }
  if (score >= 25) return { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.15)', label: 'Beobachten' }
  return { color: '#34d399', bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.15)', label: 'Gesund' }
}

export default async function ChurnPage() {
  const { role } = await requirePlatformAccess()
  const admin = createSupabaseAdmin()

  const now = Date.now()
  const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
  const d60 = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString()
  const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: restaurants }, { data: allOrders }] = await Promise.all([
    admin.from('restaurants')
      .select('id, name, slug, plan, active, created_at, trial_ends_at, stripe_subscription_id, stripe_connect_account_id'),
    admin.from('orders')
      .select('restaurant_id, total, created_at, status')
      .gte('created_at', d60)
      .neq('status', 'cancelled'),
  ])

  const rests = restaurants ?? []
  const orders = allOrders ?? []

  const scores: ChurnScore[] = rests.map(r => {
    const ro = orders.filter(o => o.restaurant_id === r.id)
    const ro30 = ro.filter(o => o.created_at >= d30)
    const ro60_30 = ro.filter(o => o.created_at < d30)
    const ro7 = ro.filter(o => o.created_at >= d7)

    const lastOrder = ro.sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    const lastDaysAgo = lastOrder ? Math.floor((now - new Date(lastOrder.created_at).getTime()) / (1000 * 60 * 60 * 24)) : null

    const trialEnd = r.trial_ends_at ? new Date(r.trial_ends_at) : null
    const trialDays = trialEnd ? Math.floor((trialEnd.getTime() - now) / (1000 * 60 * 60 * 24)) : null

    let score = 0
    const signals: string[] = []

    // No orders last 7d (high risk)
    if (ro7.length === 0 && ro30.length === 0) { score += 30; signals.push('Keine Orders (30d)') }
    else if (ro7.length === 0) { score += 10; signals.push('Keine Orders (7d)') }

    // Order decline
    if (ro60_30.length > 0 && ro30.length < ro60_30.length * 0.5) { score += 20; signals.push('Orders ↓ >50%') }
    else if (ro60_30.length > 0 && ro30.length < ro60_30.length * 0.75) { score += 10; signals.push('Orders ↓ leicht') }

    // Trial expiring
    if (trialDays !== null && trialDays >= 0 && trialDays <= 7) { score += 25; signals.push(`Trial endet in ${trialDays}d`) }
    else if (trialDays !== null && trialDays < 0) { score += 35; signals.push('Trial abgelaufen') }

    // Inactive restaurant
    if (!r.active) { score += 30; signals.push('Inaktiv') }

    // Expired plan
    if (r.plan === 'expired') { score += 40; signals.push('Plan: Expired') }

    // No stripe on paid plan
    if ((r.plan === 'starter' || r.plan === 'pro' || r.plan === 'enterprise') && !r.stripe_subscription_id) {
      score += 15; signals.push('Kein Stripe-Abo')
    }

    // Long since last order
    if (lastDaysAgo !== null && lastDaysAgo > 14) { score += 15; signals.push(`Last Order ${lastDaysAgo}d`) }
    else if (lastDaysAgo === null) { score += 10; signals.push('Nie bestellt') }

    return {
      id: r.id, name: r.name, slug: r.slug, plan: r.plan, active: r.active,
      score: Math.min(score, 100), signals,
      mrr: PLAN_MRR[r.plan] ?? 0,
      lastOrderDaysAgo: lastDaysAgo,
      orderCount30: ro30.length,
      orderCount60: ro.length,
      trialEndsInDays: trialDays,
      stripeOk: !!r.stripe_subscription_id,
    }
  })

  scores.sort((a, b) => b.score - a.score)

  const critical = scores.filter(s => s.score >= 75)
  const risk = scores.filter(s => s.score >= 50 && s.score < 75)
  const watching = scores.filter(s => s.score >= 25 && s.score < 50)
  const healthy = scores.filter(s => s.score < 25)

  const atRiskMrr = [...critical, ...risk].reduce((s, r) => s + r.mrr, 0)
  const criticalMrr = critical.reduce((s, r) => s + r.mrr, 0)

  const canEmail = role === 'owner' || role === 'co_founder'

  return (
    <div style={{ padding: '32px 28px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ color: 'rgba(248,113,113,0.7)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Retention</div>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.03em', marginBottom: '6px' }}>Churn Risk</h1>
        <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.85rem' }}>Algorithmus-basiertes Risiko-Scoring für alle Restaurants — täglich aktualisiert</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '32px' }}>
        <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '14px', padding: '18px 20px' }}>
          <div style={{ color: 'rgba(248,113,113,0.6)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Kritisch</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f87171', lineHeight: 1 }}>{critical.length}</div>
          <div style={{ color: 'rgba(248,113,113,0.5)', fontSize: '0.7rem', marginTop: '4px' }}>MRR-Risiko: €{criticalMrr}</div>
        </div>
        <div style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.18)', borderRadius: '14px', padding: '18px 20px' }}>
          <div style={{ color: 'rgba(251,191,36,0.6)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Risiko</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fbbf24', lineHeight: 1 }}>{risk.length}</div>
          <div style={{ color: 'rgba(251,191,36,0.5)', fontSize: '0.7rem', marginTop: '4px' }}>MRR-Risiko gesamt: €{atRiskMrr}</div>
        </div>
        <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '14px', padding: '18px 20px' }}>
          <div style={{ color: 'rgba(96,165,250,0.6)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Beobachten</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#60a5fa', lineHeight: 1 }}>{watching.length}</div>
          <div style={{ color: 'rgba(96,165,250,0.4)', fontSize: '0.7rem', marginTop: '4px' }}>leichte Warnsignale</div>
        </div>
        <div style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.12)', borderRadius: '14px', padding: '18px 20px' }}>
          <div style={{ color: 'rgba(52,211,153,0.5)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Gesund</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34d399', lineHeight: 1 }}>{healthy.length}</div>
          <div style={{ color: 'rgba(52,211,153,0.4)', fontSize: '0.7rem', marginTop: '4px' }}>kein Handlungsbedarf</div>
        </div>
      </div>

      {/* Sections */}
      {[
        { title: 'Kritisch', sub: 'Score ≥ 75 — sofortige Aktion empfohlen', list: critical },
        { title: 'Risiko', sub: 'Score 50–74 — proaktiv ansprechen', list: risk },
        { title: 'Beobachten', sub: 'Score 25–49 — im Blick behalten', list: watching },
      ].filter(s => s.list.length > 0).map(section => (
        <div key={section.title} style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '12px' }}>
            <h2 style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: '0.95rem' }}>{section.title}</h2>
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.72rem' }}>{section.sub}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {section.list.map(r => {
              const c = churnColor(r.score)
              return (
                <div key={r.id} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  {/* Score */}
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: `2px solid ${c.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: c.color, fontWeight: 800, fontSize: '0.85rem' }}>{r.score}</span>
                  </div>

                  {/* Name */}
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <Link href={`/platform/restaurants/${r.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: '0.88rem' }}>{r.name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>/{r.slug}</div>
                    </Link>
                  </div>

                  {/* Plan + MRR */}
                  <div style={{ textAlign: 'center', minWidth: '60px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plan</div>
                    <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: '0.78rem' }}>{r.plan}</div>
                    {r.mrr > 0 && <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.65rem' }}>€{r.mrr}/mo</div>}
                  </div>

                  {/* Orders */}
                  <div style={{ textAlign: 'center', minWidth: '70px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Orders 30d</div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: '0.82rem' }}>{r.orderCount30}</div>
                  </div>

                  {/* Last order */}
                  <div style={{ textAlign: 'center', minWidth: '80px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Letzter Order</div>
                    <div style={{ color: r.lastOrderDaysAgo !== null && r.lastOrderDaysAgo > 7 ? c.color : 'rgba(255,255,255,0.55)', fontWeight: 700, fontSize: '0.82rem' }}>
                      {r.lastOrderDaysAgo === null ? 'Nie' : `${r.lastOrderDaysAgo}d`}
                    </div>
                  </div>

                  {/* Signals */}
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', flex: 1, minWidth: '180px' }}>
                    {r.signals.map(s => (
                      <span key={s} style={{ padding: '2px 8px', borderRadius: '10px', background: `${c.color}15`, color: c.color, fontSize: '0.65rem', fontWeight: 600, border: `1px solid ${c.color}30` }}>
                        {s}
                      </span>
                    ))}
                  </div>

                  {/* Action */}
                  {canEmail && (
                    <a href={`/platform/outreach`} style={{ padding: '5px 12px', borderRadius: '7px', border: `1px solid ${c.border}`, background: `${c.color}10`, color: c.color, fontSize: '0.7rem', fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                      Kontakt →
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Scoring methodology */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '20px 22px' }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 700, marginBottom: '12px' }}>Score-Algorithmus</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
          {[
            ['+40', 'Plan: Expired'],
            ['+35', 'Trial abgelaufen'],
            ['+30', 'Inaktiv (active=false)'],
            ['+30', 'Keine Orders 30d'],
            ['+25', 'Trial endet ≤7d'],
            ['+20', 'Orders -50% MoM'],
            ['+15', 'Kein Stripe-Abo'],
            ['+15', 'Letzter Order >14d'],
            ['+10', 'Keine Orders 7d'],
            ['+10', 'Orders -25% MoM'],
            ['+10', 'Nie bestellt'],
          ].map(([pts, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#f87171', fontWeight: 700, fontSize: '0.72rem', minWidth: '30px' }}>{pts}</span>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
