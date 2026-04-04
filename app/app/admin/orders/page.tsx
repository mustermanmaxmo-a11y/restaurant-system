'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Order, OrderStatus, ServiceCall, Table } from '@/types/database'
import { ChefHat, Bell, Receipt, Clock, Users, Truck, ShoppingBag, Check, X } from 'lucide-react'

type OrderWithTable = Order & { table_label?: string }

const STATUS_COLS: { status: OrderStatus; label: string; color: string; bg: string; next?: OrderStatus; deliveryOnly?: boolean }[] = [
  { status: 'new',              label: 'Neu',        color: '#FF3B30', bg: '#FF3B3012', next: 'cooking'           },
  { status: 'cooking',          label: 'In Arbeit',  color: '#FF9500', bg: '#FF950012'                            },
  { status: 'out_for_delivery', label: 'Unterwegs',  color: '#f59e0b', bg: '#f59e0b12', next: 'served', deliveryOnly: true },
  { status: 'served',           label: 'Serviert',   color: '#34C759', bg: '#34C75912'                            },
]

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  return `${Math.floor(diff / 3600)}h`
}

function OrderTypeIcon({ type }: { type: string }) {
  if (type === 'delivery') return <Truck size={11} />
  if (type === 'pickup')   return <ShoppingBag size={11} />
  return <Users size={11} />
}

function OrderCard({ order, col, onAdvance, onCancel }: {
  order: OrderWithTable
  col: typeof STATUS_COLS[0]
  onAdvance: (id: string, next: OrderStatus) => void
  onCancel:  (id: string) => void
}) {
  const isNew = col.status === 'new'

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${col.color}33`,
      borderLeft: `3px solid ${col.color}`,
      borderRadius: '10px',
      padding: '14px',
      position: 'relative',
      animation: isNew ? 'pulse-border 2s ease-in-out infinite' : 'none',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700,
            color: col.color, background: col.bg, padding: '2px 7px', borderRadius: '5px',
          }}>
            #{order.id.slice(-4).toUpperCase()}
          </span>
          {order.table_label && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Tisch {order.table_label}
            </span>
          )}
          {order.order_type !== 'dine_in' && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <OrderTypeIcon type={order.order_type} />
              {order.order_type === 'delivery' ? 'Lieferung' : 'Abholung'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
          <Clock size={10} />
          {timeAgo(order.created_at)}
        </div>
      </div>

      {/* Customer */}
      {order.customer_name && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
          👤 {order.customer_name}
        </p>
      )}

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '12px' }}>
        {order.items.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text)' }}>
              <span style={{ color: col.color, fontWeight: 700, marginRight: '5px' }}>{item.qty}×</span>
              {item.name}
            </span>
          </div>
        ))}
      </div>

      {/* Note */}
      {order.note && (
        <div style={{
          background: '#FF950015', border: '1px solid #FF950030',
          borderRadius: '6px', padding: '6px 10px', marginBottom: '10px', fontSize: '0.78rem',
          color: '#FF9500',
        }}>
          📝 {order.note}
        </div>
      )}

      {/* Total */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
        <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.9rem' }}>
          {order.total.toFixed(2)} €
        </span>

        <div style={{ display: 'flex', gap: '6px' }}>
          {col.status !== 'served' && (
            <button
              onClick={() => onCancel(order.id)}
              title="Stornieren"
              style={{
                background: '#FF3B3015', border: '1px solid #FF3B3030', color: '#FF3B30',
                borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}
            >
              <X size={13} />
            </button>
          )}
          {(() => {
            const next = col.status === 'cooking'
              ? (order.order_type === 'delivery' ? 'out_for_delivery' : 'served') as OrderStatus
              : col.next
            const label = col.status === 'new' ? 'Zubereiten'
              : col.status === 'cooking' && order.order_type === 'delivery' ? 'Übergeben'
              : col.status === 'out_for_delivery' ? 'Ausgeliefert'
              : 'Serviert'
            return next ? (
              <button
                onClick={() => onAdvance(order.id, next)}
                style={{
                  background: col.color, border: 'none', color: '#fff',
                  borderRadius: '6px', padding: '5px 12px', cursor: 'pointer',
                  fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px',
                }}
              >
                {col.status === 'new' ? <ChefHat size={12} /> : <Check size={12} />}
                {label}
              </button>
            ) : null
          })()}
        </div>
      </div>
    </div>
  )
}

function ServiceCallBanner({ calls, tables, onResolve }: {
  calls: ServiceCall[]
  tables: Table[]
  onResolve: (id: string) => void
}) {
  if (calls.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
      {calls.map(call => {
        const table = tables.find(t => t.id === call.table_id)
        return (
          <div key={call.id} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: call.type === 'bill' ? '#FF950018' : '#FF3B3018',
            border: `1px solid ${call.type === 'bill' ? '#FF950040' : '#FF3B3040'}`,
            borderRadius: '8px', padding: '8px 14px',
            animation: 'pulse-border 1.5s ease-in-out infinite',
          }}>
            {call.type === 'bill' ? <Receipt size={14} color="#FF9500" /> : <Bell size={14} color="#FF3B30" />}
            <span style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--text)' }}>
              {call.type === 'bill' ? 'Rechnung' : 'Kellner'} — Tisch {table?.label ?? '?'}
            </span>
            <button
              onClick={() => onResolve(call.id)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center',
              }}
            >
              <Check size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default function OrdersPage() {
  const [orders, setOrders]       = useState<OrderWithTable[]>([])
  const [tables, setTables]       = useState<Table[]>([])
  const tablesRef                 = useRef<Table[]>([])
  const [calls, setCalls]         = useState<ServiceCall[]>([])
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)

  // Load restaurant + initial data
  useEffect(() => {
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setLoading(false); return }

        const { data: restaurant } = await supabase
          .from('restaurants').select('id').eq('owner_id', session.user.id).limit(1).maybeSingle()
        if (!restaurant) { setLoading(false); return }

        setRestaurantId(restaurant.id)

        const [{ data: tableData }, { data: orderData }, { data: callData }] = await Promise.all([
          supabase.from('tables').select('*').eq('restaurant_id', restaurant.id),
          supabase.from('orders').select('*')
            .eq('restaurant_id', restaurant.id)
            .in('status', ['new', 'cooking', 'out_for_delivery', 'served'])
            .order('created_at', { ascending: true }),
          supabase.from('service_calls').select('*')
            .eq('restaurant_id', restaurant.id)
            .eq('resolved', false),
        ])

        const tbl = tableData ?? []
        tablesRef.current = tbl
        setTables(tbl)
        setOrders(enrichOrders(orderData ?? [], tbl))
        setCalls(callData ?? [])
        setLoading(false)
      } catch (e) {
        console.error('Orders init error:', e)
        setLoading(false)
      }
    }
    init()
  }, [])

  function enrichOrders(raw: Order[], tbl: Table[]): OrderWithTable[] {
    return raw.map(o => ({
      ...o,
      table_label: tbl.find(t => t.id === o.table_id)?.label,
    }))
  }

  const loadOrders = useCallback(async (rId: string) => {
    const { data } = await supabase.from('orders').select('*')
      .eq('restaurant_id', rId)
      .in('status', ['new', 'cooking', 'out_for_delivery', 'served'])
      .order('created_at', { ascending: true })
    setOrders(enrichOrders(data ?? [], tablesRef.current))
  }, [])

  const loadCalls = useCallback(async (rId: string) => {
    const { data } = await supabase.from('service_calls').select('*')
      .eq('restaurant_id', rId).eq('resolved', false)
    setCalls(data ?? [])
  }, [])

  // Realtime subscriptions
  useEffect(() => {
    if (!restaurantId) return

    const orderSub = supabase.channel(`admin-orders-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => loadOrders(restaurantId))
      .subscribe()

    const callSub = supabase.channel(`admin-calls-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_calls', filter: `restaurant_id=eq.${restaurantId}` },
        () => loadCalls(restaurantId))
      .subscribe()

    return () => {
      supabase.removeChannel(orderSub)
      supabase.removeChannel(callSub)
    }
  }, [restaurantId, loadOrders, loadCalls])

  const advanceStatus = useCallback(async (id: string, next: OrderStatus) => {
    await supabase.from('orders').update({ status: next }).eq('id', id)
  }, [])

  const cancelOrder = useCallback(async (id: string) => {
    if (!confirm('Bestellung wirklich stornieren?')) return
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', id)
  }, [])

  const resolveCall = useCallback(async (id: string) => {
    await supabase.from('service_calls').update({ resolved: true }).eq('id', id)
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <p style={{ color: 'var(--text-muted)' }}>Lädt...</p>
      </div>
    )
  }

  const cols = STATUS_COLS.map(col => ({
    ...col,
    orders: orders.filter(o =>
      o.status === col.status && (!col.deliveryOnly || o.order_type === 'delivery')
    ),
  }))

  const totalActive = orders.filter(o => o.status !== 'served').length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '28px 24px' }}>
      <style>{`
        @keyframes pulse-border {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#FF3B30', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChefHat size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Bestellungen
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '1px' }}>
              {totalActive > 0 ? `${totalActive} aktive Bestellung${totalActive !== 1 ? 'en' : ''}` : 'Keine aktiven Bestellungen'}
              {' · '}
              <span style={{ color: '#34C759' }}>● Live</span>
            </p>
          </div>
        </div>
      </div>

      {/* Service Calls */}
      <ServiceCallBanner calls={calls} tables={tables} onResolve={resolveCall} />

      {/* Kanban columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', alignItems: 'start' }}>
        {cols.map(col => (
          <div key={col.status}>
            {/* Column header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '12px', padding: '0 2px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color }} />
                <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.85rem' }}>{col.label}</span>
              </div>
              {col.orders.length > 0 && (
                <span style={{
                  background: col.bg, color: col.color, border: `1px solid ${col.color}33`,
                  borderRadius: '20px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700,
                }}>
                  {col.orders.length}
                </span>
              )}
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '100px' }}>
              {col.orders.length === 0 ? (
                <div style={{
                  border: `1px dashed ${col.color}22`, borderRadius: '10px',
                  padding: '28px', textAlign: 'center',
                  color: 'var(--text-muted)', fontSize: '0.78rem',
                }}>
                  Keine Bestellungen
                </div>
              ) : (
                col.orders.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    col={col}
                    onAdvance={advanceStatus}
                    onCancel={cancelOrder}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile note */}
      <style>{`
        @media (max-width: 768px) {
          .orders-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
