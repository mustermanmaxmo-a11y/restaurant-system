'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Order, Table } from '@/types/database'
import { History, Search, Download, Euro, ShoppingBag, TrendingUp, ChevronLeft } from 'lucide-react'

type Range = 'today' | 'yesterday' | 'week' | 'month'

const RANGE_LABELS: Record<Range, string> = {
  today: 'Heute',
  yesterday: 'Gestern',
  week: 'Diese Woche',
  month: 'Diesen Monat',
}

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  served:    { label: 'Serviert',   bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  cancelled: { label: 'Storniert',  bg: 'rgba(239,68,68,0.12)',   color: '#ef4444' },
  new:       { label: 'Neu',        bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  cooking:   { label: 'Zubereitung', bg: 'rgba(255,107,53,0.12)', color: '#ff6b35' },
}

function getRangeStart(range: Range): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  if (range === 'yesterday') { d.setDate(d.getDate() - 1) }
  else if (range === 'week')  { d.setDate(d.getDate() - 6) }
  else if (range === 'month') { d.setDate(d.getDate() - 29) }
  return d
}

function getRangeEnd(range: Range): Date {
  const d = new Date()
  if (range === 'yesterday') { d.setDate(d.getDate() - 1); d.setHours(23, 59, 59, 999) }
  return d
}

export default function OrderHistoryPage() {
  const router = useRouter()
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [tableMap, setTableMap] = useState<Record<string, number>>({})
  const [range, setRange] = useState<Range>('today')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/owner-login'); return }
      const { data: resto } = await supabase
        .from('restaurants').select('id').eq('owner_id', session.user.id).limit(1).maybeSingle()
      if (!resto) return
      setRestaurantId(resto.id)

      const { data: tables } = await supabase
        .from('tables').select('id, table_num').eq('restaurant_id', resto.id)
      if (tables) {
        const m: Record<string, number> = {}
        ;(tables as Table[]).forEach(t => { m[t.id] = t.table_num })
        setTableMap(m)
      }
    })
  }, [router])

  const load = useCallback(async () => {
    if (!restaurantId) return
    setLoading(true)
    const start = getRangeStart(range)
    const end   = getRangeEnd(range)
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false })
    setOrders((data as Order[]) || [])
    setLoading(false)
  }, [restaurantId, range])

  useEffect(() => { load() }, [load])

  const filtered = orders.filter(o => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const tableNum = o.table_id ? String(tableMap[o.table_id] ?? '') : ''
    return (
      o.id.toLowerCase().includes(q) ||
      (o.customer_name ?? '').toLowerCase().includes(q) ||
      tableNum.includes(q)
    )
  })

  const totalRevenue = filtered.filter(o => o.status === 'served').reduce((s, o) => s + (o.total || 0), 0)
  const servedCount  = filtered.filter(o => o.status === 'served').length
  const avgOrder     = servedCount > 0 ? totalRevenue / servedCount : 0

  function exportCSV() {
    const rows = [
      ['ID', 'Datum', 'Typ', 'Tisch', 'Kunde', 'Status', 'Betrag (€)'],
      ...filtered.map(o => [
        o.id.slice(-8).toUpperCase(),
        new Date(o.created_at).toLocaleString('de-DE'),
        o.order_type === 'dine_in' ? 'Tisch' : o.order_type === 'delivery' ? 'Lieferung' : 'Abholung',
        o.table_id && tableMap[o.table_id] ? `Tisch ${tableMap[o.table_id]}` : '-',
        o.customer_name || '-',
        STATUS_CFG[o.status]?.label ?? o.status,
        (o.total || 0).toFixed(2),
      ]),
    ]
    const csv = rows.map(r => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `bestellungen-${range}.csv`
    a.click()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '20px 24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/admin/orders')}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
          >
            <ChevronLeft size={16} />
          </button>
          <div style={{ background: 'rgba(245,158,11,0.12)', borderRadius: '10px', padding: '9px', display: 'flex' }}>
            <History size={20} color="#f59e0b" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Bestellhistorie</h1>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {filtered.length} Bestellungen · {RANGE_LABELS[range]}
            </p>
          </div>
          <button
            onClick={exportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '9px', padding: '8px 14px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}
          >
            <Download size={14} />
            CSV Export
          </button>
        </div>

        {/* Range + Search */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '3px' }}>
            {(Object.entries(RANGE_LABELS) as [Range, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                style={{
                  padding: '5px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: range === key ? 700 : 400,
                  background: range === key ? 'var(--accent)' : 'transparent',
                  color: range === key ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Suche nach ID, Kunde, Tisch…"
              style={{
                width: '100%', paddingLeft: '32px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px',
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '9px',
                color: 'var(--text)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 180px), 1fr))', gap: '12px', marginBottom: '24px' }}>
          <StatCard icon={<Euro size={18} color="#10b981" />} label="Umsatz" value={`€ ${totalRevenue.toFixed(2)}`} color="rgba(16,185,129,0.1)" />
          <StatCard icon={<ShoppingBag size={18} color="#f59e0b" />} label="Bestellungen" value={String(servedCount)} color="rgba(245,158,11,0.1)" />
          <StatCard icon={<TrendingUp size={18} color="#6c63ff" />} label="Ø Bestellung" value={avgOrder > 0 ? `€ ${avgOrder.toFixed(2)}` : '—'} color="rgba(108,99,255,0.1)" />
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Lädt…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <History size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
            <div style={{ fontSize: '0.9rem' }}>Keine Bestellungen gefunden</div>
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {/* Desktop header */}
            <div className="history-header" style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 1fr 110px 80px', gap: '12px', padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <span>ID</span>
              <span>Zeit</span>
              <span>Typ</span>
              <span>Kunde / Tisch</span>
              <span>Status</span>
              <span style={{ textAlign: 'right' }}>Betrag</span>
            </div>

            {filtered.map((o, idx) => {
              const tableNum = o.table_id ? tableMap[o.table_id] : null
              const s = STATUS_CFG[o.status] ?? { label: o.status, bg: 'rgba(255,255,255,0.08)', color: '#fff' }
              return (
                <div key={o.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  {/* Desktop row */}
                  <div className="history-row" style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 1fr 110px 80px', gap: '12px', padding: '12px 16px', alignItems: 'center', fontSize: '0.83rem', transition: 'background 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                      #{o.id.slice(-6).toUpperCase()}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      {new Date(o.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ fontSize: '0.78rem' }}>
                      {o.order_type === 'dine_in' ? 'Tisch' : o.order_type === 'delivery' ? 'Lieferung' : 'Abholung'}
                    </span>
                    <span style={{ fontWeight: 600 }}>
                      {o.customer_name || (tableNum ? `Tisch ${tableNum}` : '—')}
                    </span>
                    <span>
                      <span style={{ display: 'inline-block', background: s.bg, color: s.color, borderRadius: '6px', padding: '2px 9px', fontSize: '0.72rem', fontWeight: 700 }}>
                        {s.label}
                      </span>
                    </span>
                    <span style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      € {(o.total || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .history-header { display: none !important; }
          .history-row {
            display: flex !important;
            flex-wrap: wrap;
            gap: 6px 16px !important;
            padding: 14px 16px !important;
          }
        }
      `}</style>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{ background: color, borderRadius: '12px', border: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '2px' }}>{value}</div>
      </div>
    </div>
  )
}
