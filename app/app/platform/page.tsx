import { redirect } from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'
import { Building2, CreditCard, Clock, Euro, ShoppingBag, UserPlus, AlertTriangle } from 'lucide-react'

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

export default async function PlatformDashboard() {
  const { role } = await requirePlatformAccess()
  // Support sieht nur Restaurants, Billing sieht nur Billing
  if (role === 'support') redirect('/platform/restaurants')
  if (role === 'billing') redirect('/platform/billing')

  const admin = createSupabaseAdmin()
  const { data: restaurants } = await admin
    .from('restaurants')
    .select('id, name, plan, active, trial_ends_at, created_at')

  const list = restaurants ?? []
  const now = Date.now()

  const total = list.length
  const activePaid = list.filter(r => r.active && (r.plan === 'starter' || r.plan === 'pro' || r.plan === 'enterprise')).length
  const activeTrials = list.filter(r => r.plan === 'trial' && r.trial_ends_at && new Date(r.trial_ends_at).getTime() > now).length
  const expired = list.filter(r => r.plan === 'expired').length
  const mrr = list
    .filter(r => r.active)
    .reduce((sum, r) => sum + (PLAN_MRR[r.plan] ?? 0), 0)
  const arr = mrr * 12
  const conversionRate = activeTrials > 0 ? Math.round((activePaid / (activePaid + activeTrials)) * 100) : (activePaid > 0 ? 100 : 0)

  const planBreakdown: Record<string, number> = {}
  list.forEach(r => {
    planBreakdown[r.plan] = (planBreakdown[r.plan] ?? 0) + 1
  })

  const recent = [...list]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  // Recent orders across all restaurants
  const { data: recentOrders } = await admin
    .from('orders')
    .select('id, restaurant_id, status, total, order_type, created_at')
    .order('created_at', { ascending: false })
    .limit(15)

  const restaurantNameById: Record<string, string> = {}
  list.forEach(r => {
    restaurantNameById[r.id] = r.name
  })
  // Fetch names for restaurants not yet in list (unlikely but safe)
  const orderRestaurantIds = [...new Set((recentOrders ?? []).map(o => o.restaurant_id))]
  const missingIds = orderRestaurantIds.filter(id => !restaurantNameById[id])
  if (missingIds.length > 0) {
    const { data: extra } = await admin.from('restaurants').select('id, name').in('id', missingIds)
    ;(extra ?? []).forEach(r => { restaurantNameById[r.id] = r.name })
  }

  // Trials expiring in the next 7 days
  const expiringTrials = list.filter(r =>
    r.plan === 'trial' && r.trial_ends_at &&
    new Date(r.trial_ends_at).getTime() > now &&
    new Date(r.trial_ends_at).getTime() < now + 7 * 24 * 60 * 60 * 1000
  )

  // New restaurants in last 24h
  const newToday = list.filter(r =>
    new Date(r.created_at).getTime() > now - 24 * 60 * 60 * 1000
  ).length

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>Überblick</h1>
        <p style={{ color: '#888', fontSize: '0.85rem' }}>Platform-weite Kennzahlen über alle Restaurants.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <KPI icon={Building2} label="Restaurants gesamt" value={String(total)} accent />
        <KPI icon={CreditCard} label="Aktive Abos" value={String(activePaid)} />
        <KPI icon={Clock} label="Laufende Trials" value={String(activeTrials)} />
        <KPI icon={Euro} label="MRR" value={`€${mrr}`} />
        <KPI icon={Euro} label="ARR (est.)" value={`€${arr}`} />
        <KPI icon={ShoppingBag} label="Trial→Paid" value={`${conversionRate}%`} />
      </div>

      {/* Alerts */}
      {(expiringTrials.length > 0 || expired > 0) && (
        <div style={{ marginBottom: '28px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {expiringTrials.map(r => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 16px', borderRadius: '10px',
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
              fontSize: '0.82rem',
            }}>
              <AlertTriangle size={14} color="#f59e0b" />
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                Trial läuft ab {r.trial_ends_at ? new Date(r.trial_ends_at).toLocaleDateString('de-DE') : '—'}
              </span>
              <span style={{ color: '#888' }}>· {r.name}</span>
            </div>
          ))}
          {expired > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 16px', borderRadius: '10px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              fontSize: '0.82rem',
            }}>
              <AlertTriangle size={14} color="#ef4444" />
              <span style={{ color: '#ef4444', fontWeight: 600 }}>{expired} abgelaufene Abos</span>
              <span style={{ color: '#888' }}>· mögliche Reaktivierung</span>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '20px' }}>
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
                  <span style={{ color: '#ccc' }}>{r.name}</span>
                  <span style={{ color: '#888' }}>{new Date(r.created_at).toLocaleDateString('de-DE')}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Letzte Bestellungen + Heute */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <Card title="Letzte Bestellungen (alle Restaurants)">
          {(recentOrders ?? []).length === 0 ? (
            <p style={{ color: '#666', fontSize: '0.85rem' }}>Noch keine Bestellungen.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0' }}>
              {(recentOrders ?? []).map(o => {
                const age = Math.round((now - new Date(o.created_at).getTime()) / 60000)
                const ageLabel = age < 60 ? `${age}m` : `${Math.round(age / 60)}h`
                const statusColor: Record<string, string> = {
                  new: '#f59e0b', cooking: '#6366f1', served: '#10b981',
                  cancelled: '#ef4444', pending_payment: '#888', out_for_delivery: '#3b82f6',
                }
                return (
                  <li key={o.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 0', borderBottom: '1px solid #1f1f30', fontSize: '0.78rem',
                  }}>
                    <span style={{
                      width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                      background: statusColor[o.status] ?? '#888',
                    }} />
                    <span style={{ color: '#ccc', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {restaurantNameById[o.restaurant_id] ?? '—'}
                    </span>
                    <span style={{ color: '#888', flexShrink: 0 }}>{o.total.toFixed(2)} €</span>
                    <span style={{ color: '#555', flexShrink: 0, minWidth: '28px', textAlign: 'right' }}>{ageLabel}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card title="Heute">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <UserPlus size={16} color="#6366f1" />
              <span style={{ color: '#ccc', fontSize: '0.85rem' }}>
                <strong style={{ color: '#fff' }}>{newToday}</strong> neue Restaurants in den letzten 24h
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ShoppingBag size={16} color="#10b981" />
              <span style={{ color: '#ccc', fontSize: '0.85rem' }}>
                <strong style={{ color: '#fff' }}>{(recentOrders ?? []).length}</strong> Bestellungen (letzte angezeigt)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Clock size={16} color="#f59e0b" />
              <span style={{ color: '#ccc', fontSize: '0.85rem' }}>
                <strong style={{ color: '#fff' }}>{expiringTrials.length}</strong> Trials laufen in 7 Tagen ab
              </span>
            </div>
          </div>
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
