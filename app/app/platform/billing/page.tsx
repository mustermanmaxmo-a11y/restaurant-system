import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import type { Restaurant } from '@/types/database'
import { CreditCard, Clock, XCircle, Euro, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react'

export const dynamic = 'force-dynamic'

const PLAN_MRR: Record<string, number> = {
  starter: 29,
  pro: 79,
  enterprise: 199,
  trial: 0,
  expired: 0,
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Professional',
  trial: 'Trial',
  expired: 'Abgelaufen',
  enterprise: 'Enterprise',
}

type Row = Pick<Restaurant,
  'id' | 'name' | 'slug' | 'plan' | 'active' | 'trial_ends_at' | 'created_at' | 'stripe_customer_id' | 'stripe_subscription_id'
>

const DAY = 24 * 60 * 60 * 1000

export default async function PlatformBilling() {
  const { role } = await requirePlatformAccess()
  if (role === 'support' || role === 'developer') redirect('/platform/restaurants')

  const admin = createSupabaseAdmin()
  const { data: restaurants } = await admin
    .from('restaurants')
    .select('id, name, slug, plan, active, trial_ends_at, created_at, stripe_customer_id, stripe_subscription_id')
    .order('created_at', { ascending: false })

  const list = (restaurants ?? []) as Row[]
  const now = Date.now()

  const activePaid = list
    .filter(r => r.active && (r.plan === 'starter' || r.plan === 'pro' || r.plan === 'enterprise'))
    .sort((a, b) => (PLAN_MRR[b.plan] ?? 0) - (PLAN_MRR[a.plan] ?? 0))

  const trials = list
    .filter(r => r.plan === 'trial' && r.trial_ends_at)
    .sort((a, b) => new Date(a.trial_ends_at ?? 0).getTime() - new Date(b.trial_ends_at ?? 0).getTime())

  const recentlyExpired = list
    .filter(r => r.plan === 'expired' && new Date(r.created_at).getTime() > now - 30 * DAY)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const mrr = activePaid.reduce((sum, r) => sum + (PLAN_MRR[r.plan] ?? 0), 0)
  const arr = mrr * 12

  const thirtyDaysAgo = new Date(now - 30 * DAY).toISOString()
  const fourteenDaysAgo = new Date(now - 14 * DAY).toISOString()

  // Fetch orders for two windows: 30d (upgrade candidates) + 14d (at-risk detection)
  const [{ data: trialOrders }, { data: recentPaidOrders }] = await Promise.all([
    admin.from('orders').select('restaurant_id').gte('created_at', thirtyDaysAgo).neq('status', 'cancelled'),
    admin.from('orders').select('restaurant_id').gte('created_at', fourteenDaysAgo).neq('status', 'cancelled'),
  ])

  const trialIds = new Set(trials.map(r => r.id))
  const orderCountByRestId: Record<string, number> = {}
  for (const o of trialOrders ?? []) {
    if (trialIds.has(o.restaurant_id)) {
      orderCountByRestId[o.restaurant_id] = (orderCountByRestId[o.restaurant_id] ?? 0) + 1
    }
  }
  const upgradeCandidates = trials
    .filter(r => (orderCountByRestId[r.id] ?? 0) >= 5)
    .sort((a, b) => (orderCountByRestId[b.id] ?? 0) - (orderCountByRestId[a.id] ?? 0))

  const mrrPotential = upgradeCandidates.length * PLAN_MRR['starter']

  // RevOps: at-risk MRR = active paid with no orders in 14d
  const activeOrderSet = new Set((recentPaidOrders ?? []).map(o => o.restaurant_id))
  const atRisk = activePaid.filter(r => !activeOrderSet.has(r.id))
  const atRiskMrr = atRisk.reduce((s, r) => s + (PLAN_MRR[r.plan] ?? 0), 0)

  // RevOps: new MRR this calendar month (restaurants on paid plans created this month)
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const newThisMonth = activePaid.filter(r => r.created_at >= startOfMonth)
  const newMrr = newThisMonth.reduce((s, r) => s + (PLAN_MRR[r.plan] ?? 0), 0)

  // RevOps: plan distribution (# and MRR per plan)
  const planDist = ['starter', 'pro', 'enterprise'].map(plan => ({
    plan,
    count: activePaid.filter(r => r.plan === plan).length,
    mrr: activePaid.filter(r => r.plan === plan).reduce((s, r) => s + (PLAN_MRR[r.plan] ?? 0), 0),
  }))

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>Billing</h1>
          <p style={{ color: '#888', fontSize: '0.85rem' }}>Abos, Trials und kürzlich abgelaufene Accounts — Daten aus Stripe-Webhook-Sync.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a href="/api/platform/export?type=restaurants" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 13px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)', fontSize: '0.73rem', textDecoration: 'none', fontWeight: 600 }}>
            ↓ Restaurants CSV
          </a>
          <a href="/api/platform/export?type=orders&days=30" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 13px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)', fontSize: '0.73rem', textDecoration: 'none', fontWeight: 600 }}>
            ↓ Orders CSV (30d)
          </a>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <KPI icon={Euro} label="MRR" value={`€${mrr}`} accent />
        <KPI icon={Euro} label="ARR (projiziert)" value={`€${arr}`} />
        <KPI icon={CreditCard} label="Aktive Abos" value={String(activePaid.length)} />
        <KPI icon={Clock} label="Laufende Trials" value={String(trials.length)} />
        <KPI icon={TrendingUp} label="MRR-Potenzial (Trials)" value={`€${mrrPotential}`} />
      </div>

      {/* Revenue Operations Section */}
      <div style={{ marginBottom: '28px', background: '#242438', border: '1px solid #2a2a3e', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #2a2a3e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={15} color="#a78bfa" />
          <h2 style={{ color: '#f0f0f8', fontWeight: 700, fontSize: '0.95rem' }}>Revenue Operations</h2>
          <span style={{ color: '#44445a', fontSize: '0.75rem' }}>· Laufend berechnet</span>
        </div>
        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>

          {/* Plan distribution */}
          <div>
            <div style={{ color: '#44445a', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
              MRR nach Plan
            </div>
            {planDist.map(({ plan, count, mrr: planMrr }) => {
              const pct = mrr > 0 ? Math.round((planMrr / mrr) * 100) : 0
              const colors: Record<string, { bar: string; fg: string }> = {
                starter: { bar: '#065f46', fg: '#6ee7b7' },
                pro: { bar: '#78350f', fg: '#fcd34d' },
                enterprise: { bar: '#4c1d95', fg: '#c4b5fd' },
              }
              const { bar, fg } = colors[plan] ?? { bar: '#333', fg: '#888' }
              return (
                <div key={plan} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ color: fg, fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize' }}>{plan}</span>
                    <span style={{ color: '#a0a0c0', fontSize: '0.72rem' }}>
                      {count}× · €{planMrr} ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: '5px', background: '#1e1e30', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: bar, borderRadius: '4px', transition: 'width 0.4s' }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* New MRR this month */}
          <div>
            <div style={{ color: '#44445a', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
              Neu diesen Monat
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981', lineHeight: 1, marginBottom: '4px' }}>
              €{newMrr}
            </div>
            <div style={{ color: '#44445a', fontSize: '0.73rem', marginBottom: '14px' }}>
              {newThisMonth.length} neue zahlende Restaurants
            </div>
            {newThisMonth.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {newThisMonth.slice(0, 4).map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #1e1e30' }}>
                    <span style={{ color: '#c0c0d8', fontSize: '0.75rem', fontWeight: 600 }}>{r.name}</span>
                    <span style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 700 }}>+€{PLAN_MRR[r.plan]}</span>
                  </div>
                ))}
                {newThisMonth.length > 4 && (
                  <div style={{ color: '#44445a', fontSize: '0.7rem', marginTop: '4px' }}>+{newThisMonth.length - 4} weitere</div>
                )}
              </div>
            )}
            {newThisMonth.length === 0 && (
              <div style={{ color: '#2e2e48', fontSize: '0.78rem' }}>Noch kein neues MRR diesen Monat.</div>
            )}
          </div>

          {/* At-risk MRR */}
          <div>
            <div style={{ color: '#44445a', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
              Gefährdetes MRR
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: atRiskMrr > 0 ? '#ef4444' : '#10b981', lineHeight: 1, marginBottom: '4px' }}>
              €{atRiskMrr}
            </div>
            <div style={{ color: '#44445a', fontSize: '0.73rem', marginBottom: '14px' }}>
              {atRisk.length} aktive Abos ohne Bestellungen (14d)
            </div>
            {atRisk.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {atRisk.slice(0, 4).map(r => (
                  <Link key={r.id} href={`/platform/restaurants/${r.id}`} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #1e1e30' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={11} color="#ef4444" />
                      <span style={{ color: '#c0c0d8', fontSize: '0.75rem', fontWeight: 600 }}>{r.name}</span>
                    </div>
                    <span style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 700 }}>€{PLAN_MRR[r.plan]}</span>
                  </Link>
                ))}
                {atRisk.length > 4 && (
                  <div style={{ color: '#44445a', fontSize: '0.7rem', marginTop: '4px' }}>+{atRisk.length - 4} weitere</div>
                )}
              </div>
            )}
            {atRisk.length === 0 && (
              <div style={{ color: '#10b981', fontSize: '0.78rem' }}>Alle zahlenden Kunden aktiv.</div>
            )}
          </div>
        </div>
      </div>

      {upgradeCandidates.length > 0 && (
        <Section icon={TrendingUp} title="Upgrade-Kandidaten — Trials bereit zur Konvertierung" count={upgradeCandidates.length} color="#6366f1">
          <Table headers={['Restaurant', 'Trial-Ende', 'Bestellungen (30d)', 'MRR-Potenzial', '']}>
            {upgradeCandidates.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid #2a2a3e' }}>
                <Td>
                  <div style={{ color: '#fff', fontWeight: 600 }}>{r.name}</div>
                  <div style={{ color: '#666', fontSize: '0.7rem' }}>/{r.slug}</div>
                </Td>
                <Td>{formatDate(r.trial_ends_at)}</Td>
                <Td><Badge bg="#1e1b4b" fg="#a5b4fc">{orderCountByRestId[r.id] ?? 0} Bestellungen</Badge></Td>
                <Td>{PLAN_MRR['starter']} €/mo (Starter)</Td>
                <Td>
                  <Link href={`/platform/restaurants/${r.id}`} style={{ color: '#6366f1', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none' }}>
                    Plan setzen →
                  </Link>
                </Td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      <Section icon={CreditCard} title="Aktive zahlende Abos" count={activePaid.length} color="#10b981">
        {activePaid.length === 0 ? (
          <Empty>Noch keine zahlenden Abos.</Empty>
        ) : (
          <Table headers={['Restaurant', 'Plan', 'MRR', 'Stripe-Sub', 'Seit']}>
            {activePaid.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid #2a2a3e' }}>
                <Td>
                  <div style={{ color: '#fff', fontWeight: 600 }}>{r.name}</div>
                  <div style={{ color: '#666', fontSize: '0.7rem' }}>/{r.slug}</div>
                </Td>
                <Td>
                  <Badge bg="#065f46" fg="#6ee7b7">{PLAN_LABELS[r.plan] ?? r.plan}</Badge>
                </Td>
                <Td>{PLAN_MRR[r.plan] ?? 0} €</Td>
                <Td mono>{r.stripe_subscription_id ? r.stripe_subscription_id.slice(0, 14) + '…' : <Dash />}</Td>
                <Td>{formatDate(r.created_at)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section icon={Clock} title="Laufende Trials" count={trials.length} color="#3b82f6">
        {trials.length === 0 ? (
          <Empty>Keine aktiven Trials.</Empty>
        ) : (
          <Table headers={['Restaurant', 'Angelegt', 'Trial endet', 'Tage übrig']}>
            {trials.map(r => {
              const end = r.trial_ends_at ? new Date(r.trial_ends_at).getTime() : 0
              const daysLeft = end ? Math.ceil((end - now) / DAY) : 0
              const isExpired = daysLeft <= 0
              const isUrgent = daysLeft > 0 && daysLeft <= 3
              return (
                <tr key={r.id} style={{ borderTop: '1px solid #2a2a3e' }}>
                  <Td>
                    <div style={{ color: '#fff', fontWeight: 600 }}>{r.name}</div>
                    <div style={{ color: '#666', fontSize: '0.7rem' }}>/{r.slug}</div>
                  </Td>
                  <Td>{formatDate(r.created_at)}</Td>
                  <Td>{formatDate(r.trial_ends_at)}</Td>
                  <Td>
                    <Badge
                      bg={isExpired ? '#450a0a' : isUrgent ? '#78350f' : '#1e3a8a'}
                      fg={isExpired ? '#fca5a5' : isUrgent ? '#fcd34d' : '#93c5fd'}
                    >
                      {isExpired ? 'abgelaufen' : `${daysLeft} Tag${daysLeft === 1 ? '' : 'e'}`}
                    </Badge>
                  </Td>
                </tr>
              )
            })}
          </Table>
        )}
      </Section>

      <Section icon={XCircle} title="Kürzlich abgelaufen (30 Tage)" count={recentlyExpired.length} color="#ef4444">
        {recentlyExpired.length === 0 ? (
          <Empty>Keine abgelaufenen Abos in den letzten 30 Tagen.</Empty>
        ) : (
          <Table headers={['Restaurant', 'Letzter Plan', 'Angelegt', 'Stripe-Sub']}>
            {recentlyExpired.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid #2a2a3e' }}>
                <Td>
                  <div style={{ color: '#fff', fontWeight: 600 }}>{r.name}</div>
                  <div style={{ color: '#666', fontSize: '0.7rem' }}>/{r.slug}</div>
                </Td>
                <Td>
                  <Badge bg="#450a0a" fg="#fca5a5">abgelaufen</Badge>
                </Td>
                <Td>{formatDate(r.created_at)}</Td>
                <Td mono>{r.stripe_subscription_id ? r.stripe_subscription_id.slice(0, 14) + '…' : <Dash />}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
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

function Section({ icon: Icon, title, count, color, children }: { icon: React.ComponentType<{ size?: number; color?: string }>; title: string; count: number; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <Icon size={16} color={color} />
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>{title}</h2>
        <span style={{ color: '#666', fontSize: '0.8rem', fontWeight: 600 }}>({count})</span>
      </div>
      <div style={{ background: '#242438', border: '1px solid #2a2a3e', borderRadius: '14px', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr style={{ background: '#1f1f30', textAlign: 'left' }}>
            {headers.map(h => (
              <th key={h} style={{ padding: '12px 14px', color: '#888', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td style={{ padding: '12px 14px', color: '#ccc', fontFamily: mono ? 'ui-monospace, monospace' : undefined }}>{children}</td>
}

function Badge({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '10px',
      background: bg, color: fg, fontSize: '0.7rem', fontWeight: 700,
    }}>{children}</span>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontSize: '0.85rem' }}>{children}</div>
}

function Dash() {
  return <span style={{ color: '#555' }}>—</span>
}

function formatDate(d: string | null) {
  if (!d) return <Dash />
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
