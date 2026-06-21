import Link from 'next/link'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requirePlatformAccess } from '@/lib/platform-auth'

export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000

type Event = {
  id: string
  type: 'new_restaurant' | 'trial_expiring' | 'trial_expired' | 'churn_risk' | 'hot_today' | 'upgrade_ready'
  restaurantId: string
  restaurantName: string
  restaurantSlug: string
  ts: number
  meta?: string
}

const EVENT_CONFIG = {
  new_restaurant: { label: 'Neues Restaurant',   dot: '#818cf8', bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.2)', icon: '✦' },
  trial_expiring: { label: 'Trial läuft ab',      dot: '#f59e0b', bg: 'rgba(245,158,11,0.06)',  border: 'rgba(245,158,11,0.2)',  icon: '⏳' },
  trial_expired:  { label: 'Trial abgelaufen',    dot: '#ef4444', bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.18)',  icon: '✕' },
  churn_risk:     { label: 'Churn-Risiko',        dot: '#ef4444', bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.18)',  icon: '⚠' },
  hot_today:      { label: 'Starker Tag',         dot: '#10b981', bg: 'rgba(16,185,129,0.06)',  border: 'rgba(16,185,129,0.2)',  icon: '🔥' },
  upgrade_ready:  { label: 'Upgrade-Kandidat',   dot: '#6366f1', bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.2)',  icon: '🚀' },
} as const

export default async function PlatformActivityPage() {
  await requirePlatformAccess()
  const admin = createSupabaseAdmin()
  const now = Date.now()

  const [{ data: restaurants }, { data: recentOrders }, { data: todayOrders }] = await Promise.all([
    admin.from('restaurants').select('id, name, slug, plan, active, trial_ends_at, created_at').order('created_at', { ascending: false }),
    admin.from('orders').select('restaurant_id, created_at, status')
      .gte('created_at', new Date(now - 30 * DAY).toISOString())
      .neq('status', 'cancelled'),
    admin.from('orders').select('restaurant_id')
      .gte('created_at', new Date(now - 24 * 60 * 60 * 1000).toISOString())
      .neq('status', 'cancelled'),
  ])

  const list = restaurants ?? []
  const orders = recentOrders ?? []

  // Per-restaurant order stats
  const count30: Record<string, number> = {}
  const lastOrderAt: Record<string, number> = {}
  for (const o of orders) {
    count30[o.restaurant_id] = (count30[o.restaurant_id] ?? 0) + 1
    const t = new Date(o.created_at).getTime()
    if (!lastOrderAt[o.restaurant_id] || t > lastOrderAt[o.restaurant_id]) lastOrderAt[o.restaurant_id] = t
  }

  const todayCount: Record<string, number> = {}
  for (const o of todayOrders ?? []) todayCount[o.restaurant_id] = (todayCount[o.restaurant_id] ?? 0) + 1

  const events: Event[] = []

  for (const r of list) {
    const base = { restaurantId: r.id, restaurantName: r.name, restaurantSlug: r.slug }

    // New restaurant (last 14 days)
    const age = now - new Date(r.created_at).getTime()
    if (age < 14 * DAY) {
      events.push({ id: `new-${r.id}`, type: 'new_restaurant', ts: new Date(r.created_at).getTime(), ...base,
        meta: `vor ${Math.floor(age / DAY) === 0 ? 'heute' : Math.floor(age / DAY) + ' Tagen'}` })
    }

    // Trial expiring < 7 days
    if (r.plan === 'trial' && r.trial_ends_at) {
      const end = new Date(r.trial_ends_at).getTime()
      const daysLeft = Math.ceil((end - now) / DAY)
      if (daysLeft > 0 && daysLeft <= 7) {
        events.push({ id: `expiring-${r.id}`, type: 'trial_expiring', ts: now - daysLeft * 100, ...base,
          meta: `noch ${daysLeft} ${daysLeft === 1 ? 'Tag' : 'Tage'}` })
      }
      // Recently expired (last 14 days)
      if (end < now && now - end < 14 * DAY) {
        events.push({ id: `expired-${r.id}`, type: 'trial_expired', ts: end, ...base,
          meta: `vor ${Math.floor((now - end) / DAY)} Tagen` })
      }
    }

    // Churn risk: active paid, no orders 14d
    if (r.active && ['starter', 'pro', 'enterprise'].includes(r.plan)) {
      if (!lastOrderAt[r.id] || now - lastOrderAt[r.id] > 14 * DAY) {
        events.push({ id: `churn-${r.id}`, type: 'churn_risk', ts: lastOrderAt[r.id] ?? new Date(r.created_at).getTime(), ...base,
          meta: lastOrderAt[r.id] ? `${Math.floor((now - lastOrderAt[r.id]) / DAY)} Tage ohne Bestellungen` : 'noch nie bestellt' })
      }
    }

    // Hot today: ≥5 orders in last 24h
    if ((todayCount[r.id] ?? 0) >= 5) {
      events.push({ id: `hot-${r.id}`, type: 'hot_today', ts: now, ...base,
        meta: `${todayCount[r.id]} Bestellungen heute` })
    }

    // Upgrade ready: trial with ≥5 orders in 30d
    if (r.plan === 'trial' && (count30[r.id] ?? 0) >= 5) {
      events.push({ id: `upgrade-${r.id}`, type: 'upgrade_ready', ts: now - 1000, ...base,
        meta: `${count30[r.id]} Bestellungen in 30 Tagen` })
    }
  }

  // Sort by timestamp desc, deduplicate by restaurantId+type priority
  const seen = new Set<string>()
  const sorted = events
    .sort((a, b) => b.ts - a.ts)
    .filter(e => {
      const key = `${e.restaurantId}-${e.type}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 60)

  // Group by date
  const byDate: Record<string, Event[]> = {}
  for (const e of sorted) {
    const d = new Date(e.ts)
    const key = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
    byDate[key] = byDate[key] ?? []
    byDate[key].push(e)
  }

  const typeGroups = ['new_restaurant', 'hot_today', 'upgrade_ready', 'trial_expiring', 'churn_risk', 'trial_expired'] as const
  const countsByType = typeGroups.map(t => ({ type: t, count: sorted.filter(e => e.type === t).length }))

  return (
    <div style={{ padding: '32px 28px', maxWidth: '860px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0f0f8', letterSpacing: '-0.025em', marginBottom: '4px' }}>
          Activity Feed
        </h1>
        <p style={{ color: '#44445a', fontSize: '0.82rem' }}>
          Alle plattformweiten Ereignisse · Automatisch aus Live-Daten berechnet
        </p>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '28px' }}>
        {countsByType.filter(c => c.count > 0).map(({ type, count }) => {
          const cfg = EVENT_CONFIG[type]
          return (
            <div key={type} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 12px', borderRadius: '20px',
              background: cfg.bg, border: `1px solid ${cfg.border}`,
            }}>
              <span style={{ fontSize: '0.75rem' }}>{cfg.icon}</span>
              <span style={{ color: cfg.dot, fontSize: '0.75rem', fontWeight: 700 }}>{count}</span>
              <span style={{ color: '#44445a', fontSize: '0.72rem' }}>{cfg.label}</span>
            </div>
          )
        })}
      </div>

      {/* Timeline */}
      {Object.entries(byDate).map(([date, evs]) => (
        <div key={date} style={{ marginBottom: '28px' }}>
          <div style={{
            color: '#2e2e48', fontSize: '0.68rem', fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px',
          }}>
            {date}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {evs.map(e => {
              const cfg = EVENT_CONFIG[e.type]
              const time = new Date(e.ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
              return (
                <Link key={e.id} href={`/platform/restaurants/${e.restaurantId}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '10px 14px', borderRadius: '10px',
                    background: cfg.bg, border: `1px solid ${cfg.border}`,
                  }}>
                    {/* Dot */}
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />

                    {/* Time */}
                    <span style={{ color: '#2e2e48', fontSize: '0.7rem', fontFamily: 'ui-monospace, monospace', flexShrink: 0, minWidth: '36px' }}>
                      {time}
                    </span>

                    {/* Event label */}
                    <span style={{ color: cfg.dot, fontSize: '0.72rem', fontWeight: 700, flexShrink: 0, minWidth: '120px' }}>
                      {cfg.label}
                    </span>

                    {/* Restaurant name */}
                    <span style={{ color: '#c8c8e0', fontSize: '0.82rem', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.restaurantName}
                    </span>

                    {/* Meta */}
                    {e.meta && (
                      <span style={{ color: '#44445a', fontSize: '0.72rem', flexShrink: 0 }}>{e.meta}</span>
                    )}

                    <span style={{ color: cfg.dot, fontSize: '0.68rem', flexShrink: 0 }}>→</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      ))}

      {sorted.length === 0 && (
        <div style={{ color: '#2e2e48', textAlign: 'center', padding: '60px', fontSize: '0.85rem' }}>
          Keine Ereignisse gefunden.
        </div>
      )}
    </div>
  )
}
