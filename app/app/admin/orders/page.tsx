'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { setOrderStatus } from '@/lib/orders/setOrderStatus'
import { Order, OrderStatus, ServiceCall, Table } from '@/types/database'
import { ChefHat, Bell, Receipt, Clock, Users, Truck, ShoppingBag, Check, X, User, FileText } from 'lucide-react'
import { useLanguage } from '@/components/providers/language-provider'

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
      borderRadius: '12px',
      padding: '14px',
      position: 'relative',
      animation: isNew ? 'pulse-border 2s ease-in-out infinite' : 'none',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '0.72rem', flexShrink: 0 }}>
          <Clock size={10} />
          {timeAgo(order.created_at)}
        </div>
      </div>

      {/* Customer */}
      {order.customer_name && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <User size={11} /> {order.customer_name}
        </p>
      )}

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '12px' }}>
        {order.items.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
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
          color: '#FF9500', display: 'flex', alignItems: 'center', gap: '5px',
        }}>
          <FileText size={11} style={{ flexShrink: 0 }} /> {order.note}
        </div>
      )}

      {/* Total + Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
        <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.9rem' }}>
          {Number(order.total).toFixed(2)} €
        </span>

        <div style={{ display: 'flex', gap: '6px' }}>
          {col.status !== 'served' && (
            <button
              onClick={() => onCancel(order.id)}
              title="Stornieren"
              style={{
                background: '#FF3B3015', border: '1px solid #FF3B3030', color: '#FF3B30',
                borderRadius: '7px', padding: '6px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center',
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
                  borderRadius: '7px', padding: '6px 13px', cursor: 'pointer',
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
            borderRadius: '10px', padding: '8px 14px',
            animation: 'pulse-border 1.5s ease-in-out infinite',
          }}>
            {call.type === 'bill' ? <Receipt size={14} color="#FF9500" /> : <Bell size={14} color="#FF3B30" />}
            <span style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--text)' }}>
              {call.type === 'bill' ? 'Rechnung' : 'Kellner'} — Tisch {table?.label ?? '?'}
            </span>
            <button
              onClick={() => onResolve(call.id)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
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
  const { t } = useLanguage()
  const [orders, setOrders]       = useState<OrderWithTable[]>([])
  const [tables, setTables]       = useState<Table[]>([])
  const tablesRef                 = useRef<Table[]>([])
  const [calls, setCalls]         = useState<ServiceCall[]>([])
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [mobileCol, setMobileCol] = useState(0)

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
            .eq('restaurant_id', restaurant.id).eq('resolved', false),
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
    return raw.map(o => ({ ...o, table_label: tbl.find(t => t.id === o.table_id)?.label }))
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
    return () => { supabase.removeChannel(orderSub); supabase.removeChannel(callSub) }
  }, [restaurantId, loadOrders, loadCalls])

  const advanceStatus = useCallback(async (id: string, next: OrderStatus) => {
    await setOrderStatus(id, next)
  }, [])

  const cancelOrder = useCallback(async (id: string) => {
    if (!confirm(t('order.status.cancelled') + '?')) return
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', id)
  }, [])

  const resolveCall = useCallback(async (id: string) => {
    await supabase.from('service_calls').update({ resolved: true }).eq('id', id)
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
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
  const newCount = cols[0].orders.length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <style>{`
        @keyframes pulse-border {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .orders-desktop { display: grid !important; }
        .orders-mobile-tabs { display: none !important; }
        .orders-mobile-col { display: block !important; }
        @media (max-width: 768px) {
          .orders-desktop { display: none !important; }
          .orders-mobile-tabs { display: flex !important; }
        }
      `}</style>

      {/* Page Header */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FF3B3018', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChefHat size={18} color="#FF3B30" />
          </div>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1 }}>
              Bestellungen
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              {totalActive > 0 ? `${totalActive} aktiv` : 'Keine aktiven'}
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#34C759' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#34C759', display: 'inline-block' }} />
                Live
              </span>
            </p>
          </div>
        </div>
        {newCount > 0 && (
          <span style={{
            background: '#FF3B30', color: '#fff', borderRadius: '20px',
            padding: '3px 10px', fontSize: '0.72rem', fontWeight: 800,
          }}>
            {newCount} neu
          </span>
        )}
      </div>

      <div style={{ padding: '16px 20px 32px' }}>
        {/* Service Calls */}
        <ServiceCallBanner calls={calls} tables={tables} onResolve={resolveCall} />

        {/* Mobile: column tab bar */}
        <div className="orders-mobile-tabs" style={{
          display: 'none',
          gap: '6px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '2px',
        }}>
          {cols.map((col, idx) => (
            <button
              key={col.status}
              onClick={() => setMobileCol(idx)}
              style={{
                flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '20px', border: '1.5px solid',
                borderColor: mobileCol === idx ? col.color : 'var(--border)',
                background: mobileCol === idx ? col.bg : 'transparent',
                color: mobileCol === idx ? col.color : 'var(--text-muted)',
                fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: col.color, display: 'inline-block' }} />
              {col.label}
              {col.orders.length > 0 && (
                <span style={{
                  background: mobileCol === idx ? col.color : 'var(--border)',
                  color: mobileCol === idx ? '#fff' : 'var(--text-muted)',
                  borderRadius: '10px', padding: '0 6px', fontSize: '0.7rem', lineHeight: '18px',
                }}>
                  {col.orders.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Mobile: single column view */}
        <div className="orders-mobile-tabs" style={{ display: 'none' }}>
          {cols[mobileCol] && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {cols[mobileCol].orders.length === 0 ? (
                <div style={{
                  border: `1px dashed ${cols[mobileCol].color}22`, borderRadius: '12px',
                  padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem',
                }}>
                  Keine Bestellungen
                </div>
              ) : (
                cols[mobileCol].orders.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    col={cols[mobileCol]}
                    onAdvance={advanceStatus}
                    onCancel={cancelOrder}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Desktop: 4-column kanban */}
        <div
          className="orders-desktop"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(220px, 1fr))',
            gap: '16px',
            alignItems: 'start',
            overflowX: 'auto',
          }}
        >
          {cols.map(col => (
            <div key={col.status} style={{ minWidth: '200px' }}>
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
                    border: `1px dashed ${col.color}22`, borderRadius: '12px',
                    padding: '28px', textAlign: 'center',
                    color: 'var(--text-muted)', fontSize: '0.78rem',
                  }}>
                    Keine Bestellungen
                  </div>
                ) : (
                  col.orders.map(order => (
                    <OrderCard key={order.id} order={order} col={col} onAdvance={advanceStatus} onCancel={cancelOrder} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
