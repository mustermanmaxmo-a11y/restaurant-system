import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { Building2, CreditCard, Clock, Euro } from 'lucide-react'

export const dynamic = 'force-dynamic'

const PLAN_MRR: Record<string, number> = {
  starter: 29,
  pro: 59,
  trial: 0,
  expired: 0,
  enterprise: 0,
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Professional',
  trial: 'Trial',
  expired: 'Abgelaufen',
  enterprise: 'Enterprise',
}

export default async function PlatformDashboard() {
  const admin = createSupabaseAdmin()
  const { data: restaurants } = await admin
    .from('restaurants')
    .select('id, plan, active, trial_ends_at, created_at')

  const list = restaurants ?? []
  const now = Date.now()

  const total = list.length
  const activePaid = list.filter(r => r.active && (r.plan === 'starter' || r.plan === 'pro')).length
  const activeTrials = list.filter(r => r.plan === 'trial' && r.trial_ends_at && new Date(r.trial_ends_at).getTime() > now).length
  const expired = list.filter(r => r.plan === 'expired').length
  const mrr = list
    .filter(r => r.active)
    .reduce((sum, r) => sum + (PLAN_MRR[r.plan] ?? 0), 0)

  const planBreakdown: Record<string, number> = {}
  list.forEach(r => {
    planBreakdown[r.plan] = (planBreakdown[r.plan] ?? 0) + 1
  })

  const recent = [...list]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>Überblick</h1>
        <p style={{ color: '#888', fontSize: '0.85rem' }}>Platform-weite Kennzahlen über alle Restaurants.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <KPI icon={Building2} label="Restaurants gesamt" value={String(total)} accent />
        <KPI icon={CreditCard} label="Aktive zahlende Abos" value={String(activePaid)} />
        <KPI icon={Clock} label="Laufende Trials" value={String(activeTrials)} />
        <KPI icon={Euro} label="MRR" value={`${mrr} €`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <Card title="Verteilung nach Plan">
          {Object.entries(planBreakdown).length === 0 ? (
            <p style={{ color: '#666', fontSize: '0.85rem' }}>Noch keine Restaurants.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(planBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([plan, count]) => {
                  const pct = total > 0 ? (count / total) * 100 : 0
                  return (
                    <div key={plan}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8rem' }}>
                        <span style={{ color: '#ccc', fontWeight: 600 }}>{PLAN_LABELS[plan] ?? plan}</span>
                        <span style={{ color: '#888' }}>{count} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div style={{ height: '6px', background: '#2a2a3e', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#ef4444' }} />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
          {expired > 0 && (
            <p style={{ color: '#f59e0b', fontSize: '0.75rem', marginTop: '12px' }}>
              {expired} abgelaufene Abos — potenzielle Reaktivierung
            </p>
          )}
        </Card>

        <Card title="Zuletzt angelegt">
          {recent.length === 0 ? (
            <p style={{ color: '#666', fontSize: '0.85rem' }}>—</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recent.map(r => (
                <li key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #2a2a3e', fontSize: '0.8rem' }}>
                  <span style={{ color: '#ccc' }}>{PLAN_LABELS[r.plan] ?? r.plan}</span>
                  <span style={{ color: '#888' }}>{new Date(r.created_at).toLocaleDateString('de-DE')}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function KPI({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ size?: number; color?: string }>; label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ background: '#242438', border: '1px solid #2a2a3e', borderRadius: '14px', padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <Icon size={14} color={accent ? '#ef4444' : '#888'} />
        <p style={{ color: '#888', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      </div>
      <p style={{ color: accent ? '#ef4444' : '#fff', fontWeight: 800, fontSize: '1.6rem', lineHeight: 1 }}>{value}</p>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#242438', border: '1px solid #2a2a3e', borderRadius: '14px', padding: '20px' }}>
      <h2 style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', marginBottom: '16px' }}>{title}</h2>
      {children}
    </div>
  )
}
