import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Zap, Rocket, AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

const PLAN_MRR: Record<string, number> = { starter: 29, pro: 79, enterprise: 199, trial: 0, expired: 0 }
const DAY = 24 * 60 * 60 * 1000

type Insight = {
  priorities: { action: string; reasoning: string; urgency: 'critical' | 'high' | 'medium' }[]
  opportunities: { opportunity: string; restaurant: string; restaurant_id: string; estimated_impact: string }[]
  risks: { risk: string; mrr_at_risk: number; recommendation: string }[]
  health: { status: 'excellent' | 'good' | 'warning' | 'critical'; summary: string }
}

async function getPlatformKey(): Promise<string | null> {
  const admin = createSupabaseAdmin()
  const { data } = await admin.from('platform_settings').select('anthropic_api_key').single()
  return (data as unknown as { anthropic_api_key?: string } | null)?.anthropic_api_key
    ?? process.env.ANTHROPIC_API_KEY
    ?? null
}

async function generateInsights(apiKey: string): Promise<Insight | null> {
  const admin = createSupabaseAdmin()
  const now = Date.now()
  const thirtyDaysAgo = new Date(now - 30 * DAY).toISOString()
  const fourteenDaysAgo = new Date(now - 14 * DAY).toISOString()

  const [{ data: restaurants }, { data: orders30 }, { data: orders14 }] = await Promise.all([
    admin.from('restaurants').select('id, name, plan, active, trial_ends_at, created_at'),
    admin.from('orders').select('restaurant_id, total').gte('created_at', thirtyDaysAgo).neq('status', 'cancelled'),
    admin.from('orders').select('restaurant_id').gte('created_at', fourteenDaysAgo).neq('status', 'cancelled'),
  ])

  const list = restaurants ?? []
  const count30: Record<string, number> = {}
  const rev30: Record<string, number> = {}
  for (const o of orders30 ?? []) {
    count30[o.restaurant_id] = (count30[o.restaurant_id] ?? 0) + 1
    rev30[o.restaurant_id] = (rev30[o.restaurant_id] ?? 0) + (Number(o.total) || 0)
  }
  const active14 = new Set((orders14 ?? []).map(o => o.restaurant_id))

  const activePaid = list.filter(r => r.active && ['starter','pro','enterprise'].includes(r.plan))
  const trials = list.filter(r => r.plan === 'trial')
  const expiringSoon = trials.filter(r => {
    if (!r.trial_ends_at) return false
    const daysLeft = Math.ceil((new Date(r.trial_ends_at).getTime() - now) / DAY)
    return daysLeft >= 0 && daysLeft <= 5
  })
  const upgradeCandidates = trials.filter(r => (count30[r.id] ?? 0) >= 5)
  const churnRisk = activePaid.filter(r => !active14.has(r.id))
  const mrr = activePaid.reduce((s, r) => s + PLAN_MRR[r.plan], 0)

  const prompt = `You are a SaaS platform analyst for a restaurant ordering system. Analyze this data and provide strategic insights.

PLATFORM DATA (as of today):
- Total restaurants: ${list.length}
- Active paid subscriptions: ${activePaid.length} (MRR: €${mrr})
- Active trials: ${trials.length}
- Expiring trials (≤5 days): ${expiringSoon.length} restaurants: ${expiringSoon.slice(0,3).map(r => `"${r.name}" (${Math.ceil((new Date(r.trial_ends_at!).getTime()-now)/DAY)}d left, ${count30[r.id]??0} orders 30d)`).join(', ')}
- Churn risks (paid, no orders 14d): ${churnRisk.length} — at-risk MRR: €${churnRisk.reduce((s,r)=>s+PLAN_MRR[r.plan],0)}
- Upgrade candidates (trial ≥5 orders/30d): ${upgradeCandidates.length}: ${upgradeCandidates.slice(0,3).map(r=>`"${r.name}" (${count30[r.id]}orders, €${Math.round(rev30[r.id]??0)})`).join(', ')}
- New this month: ${list.filter(r => new Date(r.created_at) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)).length}

Respond ONLY with valid JSON in this exact format (no markdown):
{
  "priorities": [
    {"action": "string (specific action to take today)", "reasoning": "string (why this matters now)", "urgency": "critical|high|medium"}
  ],
  "opportunities": [
    {"opportunity": "string (specific opportunity)", "restaurant": "string (restaurant name)", "restaurant_id": "string (id or empty)", "estimated_impact": "string (€ impact or % growth)"}
  ],
  "risks": [
    {"risk": "string (specific risk)", "mrr_at_risk": number, "recommendation": "string (concrete action)"}
  ],
  "health": {"status": "excellent|good|warning|critical", "summary": "string (1-2 sentences)"}
}

Generate 3 priorities, 3 opportunities, 2-3 risks. Be specific with restaurant names and numbers.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data.content?.[0]?.text ?? ''
    return JSON.parse(text) as Insight
  } catch {
    return null
  }
}

const URGENCY_STYLE = {
  critical: { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',   dot: '#ef4444', label: 'Kritisch' },
  high:     { bg: 'rgba(245,158,11,0.07)',   border: 'rgba(245,158,11,0.2)',  dot: '#f59e0b', label: 'Hoch' },
  medium:   { bg: 'rgba(99,102,241,0.07)',   border: 'rgba(99,102,241,0.18)', dot: '#818cf8', label: 'Mittel' },
}

const HEALTH_STYLE = {
  excellent: { color: '#10b981', label: 'Exzellent' },
  good:      { color: '#10b981', label: 'Gut' },
  warning:   { color: '#f59e0b', label: 'Achtung' },
  critical:  { color: '#ef4444', label: 'Kritisch' },
}

export default async function PlatformInsightsPage() {
  const { role } = await requirePlatformAccess()
  if (!['owner', 'co_founder'].includes(role)) redirect('/platform')

  const apiKey = await getPlatformKey()

  let insights: Insight | null = null
  let error: string | null = null
  if (apiKey) {
    insights = await generateInsights(apiKey)
    if (!insights) error = 'Claude API hat keine gültige Antwort geliefert.'
  }

  const generatedAt = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ padding: '32px 28px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0f0f8', letterSpacing: '-0.025em', marginBottom: '4px' }}>
            AI Platform Insights
          </h1>
          <p style={{ color: '#44445a', fontSize: '0.82rem' }}>
            Powered by Claude · Generiert um {generatedAt} · Täglich aktuell
          </p>
        </div>
        {insights?.health && (() => {
          const hs = HEALTH_STYLE[insights!.health.status]
          return (
            <div style={{ padding: '8px 16px', borderRadius: '10px', background: hs.color + '14', border: `1px solid ${hs.color}30` }}>
              <div style={{ color: '#44445a', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>Plattform-Status</div>
              <div style={{ color: hs.color, fontWeight: 800, fontSize: '0.95rem' }}>{hs.label}</div>
            </div>
          )
        })()}
      </div>

      {!apiKey && (
        <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.88rem', marginBottom: '6px' }}>
            ⚠ Kein Anthropic API-Key konfiguriert
          </div>
          <p style={{ color: '#44445a', fontSize: '0.82rem', lineHeight: 1.5 }}>
            Gehe zu{' '}
            <Link href="/platform/settings" style={{ color: '#f59e0b' }}>Platform Settings</Link>
            {' '}und trage deinen Anthropic API-Key ein, um KI-Insights zu aktivieren.
          </p>
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: '12px', padding: '16px', marginBottom: '24px', color: '#fca5a5', fontSize: '0.82rem' }}>
          ✕ {error}
        </div>
      )}

      {insights && (
        <>
          {/* Health summary */}
          <div style={{ background: '#242438', border: '1px solid #2a2a3e', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px' }}>
            <div style={{ color: '#44445a', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
              Plattform-Zusammenfassung
            </div>
            <p style={{ color: '#c0c0d8', fontSize: '0.88rem', lineHeight: 1.6 }}>{insights.health.summary}</p>
          </div>

          {/* Priority Actions */}
          <Section title="Prioritäten für heute" icon={<Zap size={15} />}>
            {insights.priorities.map((p, i) => {
              const s = URGENCY_STYLE[p.urgency]
              return (
                <div key={i} style={{ padding: '14px 16px', borderRadius: '10px', background: s.bg, border: `1px solid ${s.border}`, marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                    <span style={{ color: s.dot, fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {s.label}
                    </span>
                  </div>
                  <p style={{ color: '#e0e0f0', fontSize: '0.88rem', fontWeight: 600, marginBottom: '4px' }}>{p.action}</p>
                  <p style={{ color: '#5a5a78', fontSize: '0.78rem', lineHeight: 1.5 }}>{p.reasoning}</p>
                </div>
              )
            })}
          </Section>

          {/* Growth Opportunities */}
          <Section title="Wachstums-Chancen" icon={<Rocket size={15} />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
              {insights.opportunities.map((o, i) => (
                <div key={i} style={{ padding: '14px 16px', borderRadius: '10px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)' }}>
                  <div style={{ color: '#818cf8', fontSize: '0.72rem', fontWeight: 700, marginBottom: '6px' }}>
                    {o.restaurant}
                  </div>
                  <p style={{ color: '#c0c0d8', fontSize: '0.83rem', fontWeight: 600, marginBottom: '6px' }}>{o.opportunity}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 700 }}>{o.estimated_impact}</span>
                    {o.restaurant_id && (
                      <Link href={`/platform/restaurants/${o.restaurant_id}`} style={{ color: '#818cf8', fontSize: '0.7rem', textDecoration: 'none' }}>
                        Details →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Risks */}
          <Section title="Risiken im Fokus" icon={<AlertTriangle size={15} />}>
            {insights.risks.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: '16px', padding: '14px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', marginBottom: '10px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#f0c0c0', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>{r.risk}</p>
                  <p style={{ color: '#5a5a78', fontSize: '0.78rem', lineHeight: 1.5 }}>{r.recommendation}</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: '#ef4444', fontSize: '1.1rem', fontWeight: 800 }}>€{r.mrr_at_risk}</div>
                  <div style={{ color: '#44445a', fontSize: '0.65rem' }}>gefährdet</div>
                </div>
              </div>
            ))}
          </Section>
        </>
      )}
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ display: 'inline-flex', color: '#35c0db' }}>{icon}</span>
        <h2 style={{ color: '#f0f0f8', fontWeight: 700, fontSize: '0.95rem' }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}
