'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'

type Stats = {
  todayCount: number
  todayTotal: number
  ordersThisHour: number
  activeRestaurantCount: number
  statusCounts: Record<string, number>
}

type ActiveRestaurant = {
  id: string; name: string; ordersToday: number; revenueToday: number
}

type Order = {
  id: string; restaurantId: string; restaurantName: string
  total: number; status: string; createdAt: string; tableId: string | null
}

type MonitorData = {
  stats: Stats; activeRestaurants: ActiveRestaurant[]; feed: Order[]; generatedAt: string
}

const STATUS_CONFIG: Record<string, { color: string; label: string; bg: string }> = {
  new:             { color: '#93c5fd', label: 'Neu',       bg: 'rgba(147,197,253,0.08)' },
  cooking:         { color: '#fcd34d', label: 'Cooking',   bg: 'rgba(252,211,77,0.07)' },
  served:          { color: '#6ee7b7', label: 'Served',    bg: 'rgba(110,231,183,0.07)' },
  cancelled:       { color: '#fca5a5', label: 'Storniert', bg: 'rgba(252,165,165,0.06)' },
  pending_payment: { color: '#c4b5fd', label: 'Zahlung',  bg: 'rgba(196,181,253,0.07)' },
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 10) return 'gerade'
  if (diff < 60) return `${Math.floor(diff)}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h`
}

const REFRESH_SECONDS = 12

export function LiveMonitor({ initial }: { initial: MonitorData }) {
  const [data, setData] = useState(initial)
  const [countdown, setCountdown] = useState(REFRESH_SECONDS)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<string | null>(null)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const prevIds = useRef(new Set(initial.feed.map(o => o.id)))

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/platform/monitor', { cache: 'no-store' })
      if (!res.ok) return
      const next: MonitorData = await res.json()
      const fresh = new Set<string>()
      for (const o of next.feed) {
        if (!prevIds.current.has(o.id)) fresh.add(o.id)
      }
      prevIds.current = new Set(next.feed.map(o => o.id))
      setNewIds(fresh)
      setData(next)
      setCountdown(REFRESH_SECONDS)
      if (fresh.size > 0) setTimeout(() => setNewIds(new Set()), 4000)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { refresh(); return REFRESH_SECONDS }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [refresh])

  const visibleFeed = filter
    ? data.feed.filter(o => o.status === filter)
    : data.feed

  return (
    <div>
      {/* Header stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <StatCard label="Heute gesamt" value={String(data.stats.todayCount)} sub={`€${data.stats.todayTotal.toFixed(0)}`} />
        <StatCard label="Diese Stunde" value={String(data.stats.ordersThisHour)} accent />
        <StatCard label="Aktive Restaurants" value={String(data.stats.activeRestaurantCount)} />
        <StatCard label="Neue" value={String(data.stats.statusCounts['new'] ?? 0)} color="#93c5fd" />
        <StatCard label="Am Kochen" value={String(data.stats.statusCounts['cooking'] ?? 0)} color="#fcd34d" />
        <StatCard label="Serviert" value={String(data.stats.statusCounts['served'] ?? 0)} color="#6ee7b7" />
      </div>

      {/* Active restaurants */}
      {data.activeRestaurants.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ color: '#2e2e48', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
            Aktive Restaurants (letzte Stunde)
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {data.activeRestaurants.slice(0, 12).map(r => (
              <Link key={r.id} href={`/platform/restaurants/${r.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ padding: '8px 12px', borderRadius: '8px', background: '#111120', border: '1px solid #1e1e30', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                    <span style={{ color: '#c0c0d8', fontSize: '0.75rem', fontWeight: 600 }}>{r.name}</span>
                  </div>
                  <div style={{ color: '#44445a', fontSize: '0.65rem' }}>
                    {r.ordersToday} Bestellungen · €{r.revenueToday.toFixed(0)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filter + refresh bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ color: '#44445a', fontSize: '0.72rem', fontWeight: 600 }}>Filter:</span>
        {[null, 'new', 'cooking', 'served', 'cancelled'].map(s => {
          const cfg = s ? STATUS_CONFIG[s] : null
          const active = filter === s
          return (
            <button key={String(s)} onClick={() => setFilter(s)}
              style={{
                padding: '4px 12px', borderRadius: '20px', border: `1px solid ${active ? (cfg?.color ?? '#ef4444') : '#1e1e30'}`,
                background: active ? (cfg?.bg ?? 'rgba(239,68,68,0.08)') : 'transparent',
                color: active ? (cfg?.color ?? '#ef4444') : '#44445a',
                fontSize: '0.72rem', fontWeight: active ? 700 : 400, cursor: 'pointer',
              }}>
              {s ? (cfg?.label ?? s) : 'Alle'}
            </button>
          )
        })}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {loading && <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #ef4444', borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite' }} />}
          <span style={{ color: '#2e2e48', fontSize: '0.7rem' }}>↻ in {countdown}s</span>
          <button onClick={refresh} disabled={loading}
            style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #1e1e30', background: 'transparent', color: '#44445a', fontSize: '0.7rem', cursor: 'pointer' }}>
            Jetzt
          </button>
        </div>
      </div>

      {/* Live feed */}
      <div style={{ background: '#0e0e1c', border: '1px solid #1e1e30', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ background: '#111120', padding: '10px 16px', borderBottom: '1px solid #1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <span style={{ color: '#44445a', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Live Feed · {visibleFeed.length} Bestellungen
          </span>
        </div>
        <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
          {visibleFeed.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#2e2e48', fontSize: '0.82rem' }}>
              Keine Bestellungen für diesen Filter.
            </div>
          ) : visibleFeed.map(o => {
            const cfg = STATUS_CONFIG[o.status] ?? { color: '#888', label: o.status, bg: 'transparent' }
            const isNew = newIds.has(o.id)
            return (
              <div key={o.id} style={{
                display: 'grid', gridTemplateColumns: '52px 1fr 80px 80px 80px', alignItems: 'center', gap: '12px',
                padding: '10px 16px', borderBottom: '1px solid #0e0e1c',
                background: isNew ? 'rgba(239,68,68,0.06)' : undefined,
                transition: 'background 1s ease',
              }}>
                <span style={{ color: '#2e2e48', fontSize: '0.68rem', fontFamily: 'ui-monospace, monospace', textAlign: 'right' }}>
                  {timeAgo(o.createdAt)}
                </span>
                <div>
                  <div style={{ color: '#c0c0d8', fontSize: '0.8rem', fontWeight: 600 }}>{o.restaurantName}</div>
                  {o.tableId && <div style={{ color: '#2e2e48', fontSize: '0.65rem' }}>Tisch {o.tableId.slice(-4)}</div>}
                </div>
                <span style={{ padding: '3px 8px', borderRadius: '8px', background: cfg.bg, color: cfg.color, fontSize: '0.65rem', fontWeight: 700, textAlign: 'center' }}>
                  {cfg.label}
                </span>
                <span style={{ color: '#f0f0f8', fontSize: '0.82rem', fontWeight: 700, textAlign: 'right' }}>
                  €{o.total.toFixed(2)}
                </span>
                {isNew && <span style={{ color: '#ef4444', fontSize: '0.65rem', fontWeight: 800 }}>● NEU</span>}
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  )
}

function StatCard({ label, value, sub, accent, color }: { label: string; value: string; sub?: string; accent?: boolean; color?: string }) {
  return (
    <div style={{ background: '#111120', border: '1px solid #1e1e30', borderRadius: '12px', padding: '14px 16px' }}>
      <div style={{ color: '#2e2e48', fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{label}</div>
      <div style={{ color: color ?? (accent ? '#ef4444' : '#f0f0f8'), fontWeight: 800, fontSize: '1.5rem', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: '#44445a', fontSize: '0.68rem', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}
