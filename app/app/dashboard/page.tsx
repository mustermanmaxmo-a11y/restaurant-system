'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import type { Order, ServiceCall, Staff, Restaurant, Table, Reservation } from '@/types/database'
import type { LucideIcon } from 'lucide-react'
import {
  ClipboardList, ChefHat, CheckCircle2, Car, User, Phone, MapPin,
  AlertTriangle, Bell, BellRing, Receipt, CalendarDays, Users, Bike, X,
} from 'lucide-react'
import StaffOrderPanel from './StaffOrderPanel'

type Session = { staff: Staff; restaurant: Restaurant }
type Column = 'new' | 'cooking' | 'served'

const COLUMNS: { key: Column; label: string; icon: LucideIcon; color: string; next?: Column; nextLabel?: string }[] = [
  { key: 'new',     label: 'Neu',           icon: ClipboardList, color: '#f59e0b', next: 'cooking', nextLabel: 'In Küche →' },
  { key: 'cooking', label: 'In Zubereitung', icon: ChefHat,       color: '#ff6b35', next: 'served',  nextLabel: 'Serviert' },
  { key: 'served',  label: 'Serviert',       icon: CheckCircle2,  color: '#10b981' },
]

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h`
}

export default function DashboardPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [serviceCalls, setServiceCalls] = useState<ServiceCall[]>([])
  const [loginStep, setLoginStep] = useState<'slug' | 'pin'>('slug')
  const [slug, setSlug] = useState('')
  const [pin, setPin] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null)
  const [view, setView] = useState<'board' | 'calls' | 'tables' | 'reservations'>('board')
  const [mobileCol, setMobileCol] = useState<Column>('new')
  const [reservations, setReservations] = useState<Reservation[]>([])

  const [tableMap, setTableMap] = useState<Record<string, number>>({})
  const [tables, setTables] = useState<Table[]>([])
  const [orderingTable, setOrderingTable] = useState<Table | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  // Track mobile state
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Load orders
  const loadOrders = useCallback(async (restaurantId: string) => {
    const [{ data: ordersData }, { data: tablesData }] = await Promise.all([
      supabase.from('orders').select('*').eq('restaurant_id', restaurantId).in('status', ['new', 'cooking', 'out_for_delivery', 'served']).order('created_at', { ascending: true }), // pending_payment excluded intentionally
      supabase.from('tables').select('id, table_num').eq('restaurant_id', restaurantId),
    ])
    setOrders((ordersData as Order[]) || [])
    if (tablesData) {
      const map: Record<string, number> = {}
      tablesData.forEach(t => { map[t.id] = t.table_num })
      setTableMap(map)
      setTables(tablesData as Table[])
    }
  }, [])

  // Load reservations (today + tomorrow)
  const loadReservations = useCallback(async (restaurantId: string) => {
    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    const { data } = await supabase
      .from('reservations')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .in('date', [today, tomorrow])
      .neq('status', 'cancelled')
      .order('date', { ascending: true })
      .order('time_from', { ascending: true })
    setReservations((data as Reservation[]) || [])
  }, [])

  // Load service calls
  const loadCalls = useCallback(async (restaurantId: string) => {
    const { data } = await supabase
      .from('service_calls')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('resolved', false)
      .order('created_at', { ascending: true })
    setServiceCalls((data as ServiceCall[]) || [])
  }, [])

  // Realtime subscriptions
  useEffect(() => {
    if (!session) return
    const rId = session.restaurant.id

    loadOrders(rId)
    loadCalls(rId)
    loadReservations(rId)

    const ordersChannel = supabase
      .channel(`dashboard-orders-${rId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${rId}` },
        () => loadOrders(rId))
      .subscribe()

    const callsChannel = supabase
      .channel(`dashboard-calls-${rId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_calls', filter: `restaurant_id=eq.${rId}` },
        () => loadCalls(rId))
      .subscribe()

    const reservationsChannel = supabase
      .channel(`dashboard-reservations-${rId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: `restaurant_id=eq.${rId}` },
        () => loadReservations(rId))
      .subscribe()

    return () => {
      supabase.removeChannel(ordersChannel)
      supabase.removeChannel(callsChannel)
      supabase.removeChannel(reservationsChannel)
    }
  }, [session, loadOrders, loadCalls, loadReservations])

  async function handleSlugSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!slug.trim()) return
    setLoginStep('pin')
  }

  async function submitPin() {
    return handlePinSubmit({ preventDefault: () => {} } as React.SyntheticEvent)
  }

  async function handlePinSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')

    const { data: resto } = await supabase
      .from('restaurants')
      .select('*')
      .eq('slug', slug.trim().toLowerCase())
      .eq('active', true)
      .single()

    if (!resto) {
      setLoginError('Restaurant nicht gefunden.')
      setLoginLoading(false)
      setLoginStep('slug')
      return
    }

    const { data: staff } = await supabase
      .from('staff')
      .select('*')
      .eq('restaurant_id', resto.id)
      .eq('code', pin.trim())
      .eq('active', true)
      .single()

    if (!staff) {
      setLoginError('Falscher PIN-Code.')
      setPin('')
      setLoginLoading(false)
      return
    }

    setSession({ staff: staff as Staff, restaurant: resto as Restaurant })
    setLoginLoading(false)
  }

  async function updateOrderStatus(orderId: string, newStatus: Column | 'out_for_delivery') {
    setUpdatingOrder(orderId)
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
    setUpdatingOrder(null)
  }

  async function resolveCall(callId: string) {
    await supabase.from('service_calls').update({ resolved: true }).eq('id', callId)
  }

  // ── LOGIN ───────────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}><ChefHat size={40} color="#ff6b35" /></div>
            <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700 }}>Staff Login</h1>
            <p style={{ color: '#666', fontSize: '0.875rem', marginTop: '6px' }}>RestaurantOS Dashboard</p>
          </div>

          {loginStep === 'slug' ? (
            <form onSubmit={handleSlugSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Restaurant-ID</label>
                <input
                  value={slug}
                  onChange={e => setSlug(e.target.value)}
                  placeholder="z.B. pommesbude"
                  autoFocus
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #2a2a2a', background: '#1a1a1a', color: '#fff', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              {loginError && <p style={{ color: '#ef4444', fontSize: '0.875rem', textAlign: 'center' }}>{loginError}</p>}
              <button type="submit" disabled={!slug.trim()} style={{ padding: '14px', borderRadius: '10px', border: 'none', background: slug.trim() ? '#ff6b35' : '#2a2a2a', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: slug.trim() ? 'pointer' : 'not-allowed' }}>
                Weiter →
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <button type="button" onClick={() => { setLoginStep('slug'); setPin(''); setLoginError('') }} style={{ background: 'none', border: 'none', color: '#ff6b35', cursor: 'pointer', fontSize: '0.875rem', padding: 0, marginBottom: '16px' }}>
                  ← {slug}
                </button>
                <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PIN-Code eingeben</label>
                {/* PIN Display */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} style={{ width: '44px', height: '52px', borderRadius: '10px', border: '2px solid', borderColor: pin.length > i ? '#ff6b35' : '#2a2a2a', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#fff', fontSize: '1.5rem' }}>{pin.length > i ? '●' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>

              {loginError && <p style={{ color: '#ef4444', fontSize: '0.875rem', textAlign: 'center', marginTop: '-8px' }}>{loginError}</p>}

              {/* Numpad */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => { if (pin.length < 6) setPin(p => p + n); setLoginError('') }}
                    style={{ padding: '18px', borderRadius: '12px', border: '1px solid #2a2a2a', background: '#1a1a1a', color: '#fff', fontWeight: 700, fontSize: '1.3rem', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseDown={e => (e.currentTarget.style.background = '#2a2a2a')}
                    onMouseUp={e => (e.currentTarget.style.background = '#1a1a1a')}
                  >
                    {n}
                  </button>
                ))}
                {/* Bottom row: backspace, 0, enter */}
                <button
                  type="button"
                  onClick={() => setPin(p => p.slice(0, -1))}
                  style={{ padding: '18px', borderRadius: '12px', border: '1px solid #2a2a2a', background: '#1a1a1a', color: '#888', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}
                >
                  ⌫
                </button>
                <button
                  type="button"
                  onClick={() => { if (pin.length < 6) setPin(p => p + 0); setLoginError('') }}
                  style={{ padding: '18px', borderRadius: '12px', border: '1px solid #2a2a2a', background: '#1a1a1a', color: '#fff', fontWeight: 700, fontSize: '1.3rem', cursor: 'pointer' }}
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => { if (pin.trim()) submitPin() }}
                  disabled={loginLoading || !pin.trim()}
                  style={{ padding: '18px', borderRadius: '12px', border: 'none', background: pin.trim() ? '#ff6b35' : '#2a2a2a', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: pin.trim() ? 'pointer' : 'not-allowed' }}
                >
                  {loginLoading ? '...' : <CheckCircle2 size={20} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── LIEFERANTEN VIEW ────────────────────────────────────────────────────────
  if (session?.staff.role === 'delivery') {
    const DELIVERY_COLS: { key: 'new' | 'cooking' | 'out_for_delivery'; label: string; icon: LucideIcon; color: string; nextStatus: 'cooking' | 'out_for_delivery' | 'served'; nextLabel: string }[] = [
      { key: 'new',              label: 'Neu',             icon: ClipboardList, color: '#f59e0b', nextStatus: 'cooking',          nextLabel: 'In Zubereitung →' },
      { key: 'cooking',          label: 'Wird zubereitet', icon: ChefHat,       color: '#ff6b35', nextStatus: 'out_for_delivery', nextLabel: 'Abgeholt →' },
      { key: 'out_for_delivery', label: 'Unterwegs',       icon: Car,           color: '#8b5cf6', nextStatus: 'served',           nextLabel: 'Ausgeliefert' },
    ]
    const deliveryOrders = orders.filter(o => o.order_type === 'delivery')

    return (
      <div style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ background: '#1a1a1a', borderBottom: '1px solid #2a2a2a', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.restaurant.name}</span>
            <span style={{ color: '#444', fontSize: '0.8rem', flexShrink: 0 }}>·</span>
            <span style={{ color: '#aaa', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{session.staff.name}</span>
            <span style={{ background: '#f59e0b22', color: '#f59e0b', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Car size={11} /> Lieferant
            </span>
          </div>
          <button onClick={() => setSession(null)} style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#666', padding: '5px 8px', cursor: 'pointer', flexShrink: 0, marginLeft: '8px', display: 'flex', alignItems: 'center' }}>
            <X size={13} />
          </button>
        </div>

        {/* Delivery Kanban */}
        <div style={{ flex: 1, display: 'flex', gap: '1px', background: '#2a2a2a', overflow: 'hidden' }}>
          {DELIVERY_COLS.map(col => {
            const colOrders = deliveryOrders.filter(o => o.status === col.key)
            return (
              <div key={col.key} style={{ background: '#0f0f0f', display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                {/* Column Header */}
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <col.icon size={15} color={col.color} />
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.875rem' }}>{col.label}</span>
                  </div>
                  {colOrders.length > 0 && (
                    <span style={{ background: col.color + '22', color: col.color, borderRadius: '20px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700 }}>
                      {colOrders.length}
                    </span>
                  )}
                </div>

                {/* Orders */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {colOrders.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#333', fontSize: '0.875rem' }}>
                      Keine Lieferungen
                    </div>
                  )}
                  <AnimatePresence>
                  {colOrders.map((order, idx) => (
                    <motion.div
                      key={order.id}
                      initial={{ x: 40, opacity: 0 }}
                      animate={{ x: 0, opacity: updatingOrder === order.id ? 0.5 : 1 }}
                      exit={{ x: -40, opacity: 0, height: 0, marginBottom: 0, padding: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 26, delay: idx * 0.04 }}
                      layout
                      style={{ background: '#1a1a1a', borderRadius: '12px', padding: '14px', border: `1px solid ${col.color}33` }}
                    >
                      {/* Order ID + time */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, color: col.color, background: col.color + '22', padding: '2px 7px', borderRadius: '5px' }}>
                          #{order.id.slice(-4).toUpperCase()}
                        </span>
                        <span style={{ color: '#555', fontSize: '0.72rem' }}>{timeAgo(order.created_at)}</span>
                      </div>

                      {/* Customer */}
                      {order.customer_name && (
                        <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <User size={13} color="#888" /> {order.customer_name}
                        </p>
                      )}
                      {order.customer_phone && (
                        <a href={`tel:${order.customer_phone}`} style={{ color: '#f59e0b', fontSize: '0.8rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                          <Phone size={12} /> {order.customer_phone}
                        </a>
                      )}

                      {/* Delivery address */}
                      {order.delivery_address && (
                        <div style={{ background: '#8b5cf611', border: '1px solid #8b5cf633', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px' }}>
                          <p style={{ color: '#8b5cf6', fontSize: '0.75rem', fontWeight: 700, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={11} /> Lieferadresse</p>
                          <p style={{ color: '#ccc', fontSize: '0.82rem' }}>{order.delivery_address.street}</p>
                          <p style={{ color: '#aaa', fontSize: '0.78rem' }}>{order.delivery_address.zip} {order.delivery_address.city}</p>
                        </div>
                      )}

                      {/* Items */}
                      <div style={{ marginBottom: '8px' }}>
                        {order.items.map((item, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span style={{ color: '#ccc', fontSize: '0.8rem' }}>
                              <span style={{ color: col.color, fontWeight: 700 }}>{item.qty}×</span> {item.name}
                            </span>
                            <span style={{ color: '#555', fontSize: '0.78rem' }}>{(item.price * item.qty).toFixed(2)}€</span>
                          </div>
                        ))}
                      </div>

                      {/* Note */}
                      {order.note && (
                        <div style={{ background: '#f59e0b11', border: '1px solid #f59e0b33', borderRadius: '6px', padding: '6px 8px', marginBottom: '8px' }}>
                          <p style={{ color: '#f59e0b', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={11} /> {order.note}</p>
                        </div>
                      )}

                      {/* Total + Action */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2a2a2a', paddingTop: '10px' }}>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>{order.total.toFixed(2)} €</span>
                        <motion.button
                          onClick={() => updateOrderStatus(order.id, col.nextStatus)}
                          disabled={updatingOrder === order.id}
                          whileTap={{ scale: 0.9 }}
                          whileHover={{ scale: 1.05 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                          style={{ background: col.color, border: 'none', borderRadius: '6px', padding: '6px 12px', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          {col.nextLabel}
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                  </AnimatePresence>
                </div>
              </div>
            )
          })}
        </div>

        <style>{`
          @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.4} }
        `}</style>
      </div>
    )
  }

  // ── DASHBOARD ───────────────────────────────────────────────────────────────
  const unresolvedCalls = serviceCalls.filter(c => !c.resolved)
  const newOrders = orders.filter(o => o.status === 'new')

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: '#1a1a1a', borderBottom: '1px solid #2a2a2a', flexShrink: 0 }}>
        {/* Top row: name + logout */}
        <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.restaurant.name}</span>
            <span style={{ color: '#444', fontSize: '0.8rem', flexShrink: 0 }}>·</span>
            <span style={{ color: '#aaa', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{session.staff.name}</span>
            <span style={{ background: (session.staff.role as string) === 'kitchen' ? '#ff6b3522' : (session.staff.role as string) === 'delivery' ? '#f59e0b22' : '#6c63ff22', color: (session.staff.role as string) === 'kitchen' ? '#ff6b35' : (session.staff.role as string) === 'delivery' ? '#f59e0b' : '#6c63ff', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              {(session.staff.role as string) === 'kitchen' ? <><ChefHat size={11} /> Küche</> : (session.staff.role as string) === 'delivery' ? <><Car size={11} /> Lieferant</> : <><BellRing size={11} /> Service</>}
            </span>
          </div>
          <button onClick={() => setSession(null)} style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#666', padding: '5px 8px', cursor: 'pointer', flexShrink: 0, marginLeft: '8px', display: 'flex', alignItems: 'center' }}>
            <X size={13} />
          </button>
        </div>
        {/* Nav tabs row — scrollable */}
        <div style={{ overflowX: 'auto', display: 'flex', gap: '2px', padding: '0 12px 10px' }}>
          {[
            { key: 'board', label: 'Bestellungen', badge: newOrders.length },
            { key: 'calls', label: 'Service', badge: unresolvedCalls.length },
            { key: 'tables', label: 'Tische', badge: 0 },
            { key: 'reservations', label: 'Reservierungen', badge: reservations.filter(r => r.status === 'pending').length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key as typeof view)}
              style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: view === tab.key ? '#ff6b35' : 'transparent', color: view === tab.key ? '#fff' : '#666', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {tab.label}
              {tab.badge > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '0.7rem', marginLeft: '4px' }}>{tab.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Board View */}
      {view === 'board' && (<>
        {/* Mobile column switcher */}
        <div className="mobile-col-tabs" style={{ display: 'flex', background: '#1a1a1a', borderBottom: '1px solid #2a2a2a', overflowX: 'auto' }}>
          {COLUMNS.map(col => {
            const count = orders.filter(o => o.status === col.key).length
            return (
              <button
                key={col.key}
                onClick={() => setMobileCol(col.key as Column)}
                style={{
                  flex: 1, padding: '10px 8px', border: 'none', borderBottom: `2px solid ${mobileCol === col.key ? col.color : 'transparent'}`,
                  background: 'transparent', color: mobileCol === col.key ? '#fff' : '#555',
                  fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                <col.icon size={13} /> {col.label}
                {count > 0 && <span style={{ background: col.color, color: '#fff', borderRadius: '10px', padding: '0 6px', fontSize: '0.7rem' }}>{count}</span>}
              </button>
            )
          })}
        </div>
        <div style={{ flex: 1, display: 'flex', gap: '1px', background: '#2a2a2a', overflow: 'hidden' }}>
          {COLUMNS.map(col => {
            const colOrders = orders.filter(o => o.status === col.key)
            const isActive = col.key === mobileCol
            return (
              <div key={col.key} className={`board-col ${isActive ? 'board-col-active' : ''}`} style={{ background: '#0f0f0f', display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                {/* Column Header */}
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <col.icon size={15} color={col.color} />
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.875rem' }}>{col.label}</span>
                  </div>
                  {colOrders.length > 0 && (
                    <span style={{ background: col.color + '22', color: col.color, borderRadius: '20px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700 }}>
                      {colOrders.length}
                    </span>
                  )}
                </div>

                {/* Orders */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {colOrders.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#333', fontSize: '0.875rem' }}>
                      Keine Bestellungen
                    </div>
                  )}
                  <AnimatePresence>
                  {colOrders.map((order, idx) => (
                    <motion.div
                      key={order.id}
                      initial={{ x: 40, opacity: 0 }}
                      animate={{ x: 0, opacity: updatingOrder === order.id ? 0.5 : 1 }}
                      exit={{ x: -40, opacity: 0, height: 0, marginBottom: 0, padding: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 26, delay: idx * 0.04 }}
                      layout
                      style={{
                        background: '#1a1a1a',
                        borderRadius: '10px',
                        padding: '14px',
                        border: `1px solid ${col.color}33`,
                      }}
                    >
                      {/* Order Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {col.key === 'new' && (
                            <span className="pulse-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color, flexShrink: 0, color: col.color }} />
                          )}
                          <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.875rem' }}>
                            {order.order_type === 'dine_in' ? `Tisch ${order.table_id ? tableMap[order.table_id] ?? '?' : '?'}` : order.order_type === 'delivery' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Bike size={13} /> Lieferung</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><User size={13} /> Abholung</span>}
                          </span>
                          {order.customer_name && (
                            <span style={{ color: '#666', fontSize: '0.75rem' }}>{order.customer_name}</span>
                          )}
                        </div>
                        <span style={{ color: '#555', fontSize: '0.75rem' }}>{timeAgo(order.created_at)}</span>
                      </div>

                      {/* Items */}
                      <div style={{ marginBottom: '10px' }}>
                        {order.items.map((item, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <span style={{ color: '#ccc', fontSize: '0.8rem' }}>
                              <span style={{ color: col.color, fontWeight: 700 }}>{item.qty}×</span> {item.name}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Note */}
                      {order.note && (
                        <div style={{ background: '#f59e0b11', border: '1px solid #f59e0b33', borderRadius: '6px', padding: '6px 8px', marginBottom: '10px' }}>
                          <p style={{ color: '#f59e0b', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={11} /> {order.note}</p>
                        </div>
                      )}

                      {/* Total + Action */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#555', fontSize: '0.75rem' }}>{order.total.toFixed(2)}€</span>
                        {col.next && (
                          <motion.button
                            onClick={() => updateOrderStatus(order.id, col.next!)}
                            disabled={updatingOrder === order.id}
                            whileTap={{ scale: 0.9 }}
                            whileHover={{ scale: 1.05 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                            style={{
                              background: col.color, border: 'none', borderRadius: '6px',
                              padding: '6px 12px', color: '#fff', fontSize: '0.75rem',
                              fontWeight: 700, cursor: 'pointer',
                            }}
                          >
                            {col.nextLabel}
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  </AnimatePresence>
                </div>
              </div>
            )
          })}
        </div>
      </>)}

      {/* Service Calls View */}
      {view === 'calls' && (
        <div style={{ flex: 1, padding: '20px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          {unresolvedCalls.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}><CheckCircle2 size={48} color="#10b981" /></div>
              <p style={{ color: '#555' }}>Keine offenen Service-Anfragen</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {unresolvedCalls.map(call => (
                <div key={call.id} style={{ background: '#1a1a1a', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${call.type === 'bill' ? '#6c63ff33' : '#ff6b3533'}` }}>
                  <div>
                    <p style={{ color: '#fff', fontWeight: 700, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {call.type === 'waiter' ? <><Bell size={14} /> Kellner gerufen</> : <><Receipt size={14} /> Rechnung gewünscht</>}
                    </p>
                    <p style={{ color: '#555', fontSize: '0.8rem' }}>{timeAgo(call.created_at)} ago</p>
                  </div>
                  <button
                    onClick={() => resolveCall(call.id)}
                    style={{ background: '#2a2a2a', border: 'none', borderRadius: '8px', padding: '8px 16px', color: '#fff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    <span style={{ display:'flex',alignItems:'center',gap:'4px' }}><CheckCircle2 size={13} /> Erledigt</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tische / Auslastung */}
      {view === 'tables' && (() => {
        const activeOrders = orders.filter(o => o.status === 'new' || o.status === 'cooking')
        const occupiedTableIds = new Set(activeOrders.map(o => o.table_id).filter(Boolean))
        const dineInTables = tables.filter(t => t.active)
        const occupied = dineInTables.filter(t => occupiedTableIds.has(t.id))
        const free = dineInTables.filter(t => !occupiedTableIds.has(t.id))

        return (
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
            {/* Zusammenfassung */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <div style={{ flex: 1, background: '#ff6b3518', border: '1px solid #ff6b3533', borderRadius: '10px', padding: '14px 18px' }}>
                <p style={{ color: '#ff6b35', fontWeight: 700, fontSize: '1.4rem' }}>{occupied.length}</p>
                <p style={{ color: '#888', fontSize: '0.8rem' }}>Besetzt</p>
              </div>
              <div style={{ flex: 1, background: '#10b98118', border: '1px solid #10b98133', borderRadius: '10px', padding: '14px 18px' }}>
                <p style={{ color: '#10b981', fontWeight: 700, fontSize: '1.4rem' }}>{free.length}</p>
                <p style={{ color: '#888', fontSize: '0.8rem' }}>Frei</p>
              </div>
              <div style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '14px 18px' }}>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: '1.4rem' }}>{dineInTables.length}</p>
                <p style={{ color: '#888', fontSize: '0.8rem' }}>Gesamt</p>
              </div>
            </div>

            {/* Tisch-Grid */}
            {dineInTables.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <p style={{ color: '#555' }}>Keine Tische angelegt.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                {dineInTables.sort((a, b) => a.table_num - b.table_num).map(table => {
                  const tableOrders = activeOrders.filter(o => o.table_id === table.id)
                  const isOccupied = tableOrders.length > 0
                  const hasNew = tableOrders.some(o => o.status === 'new')
                  const borderColor = hasNew ? '#f59e0b' : isOccupied ? '#ff6b35' : '#2a2a2a'
                  const dotColor = hasNew ? '#f59e0b' : isOccupied ? '#ff6b35' : '#10b981'

                  return (
                    <div key={table.id} style={{
                      background: '#1a1a1a', borderRadius: '12px', padding: '16px',
                      border: `1.5px solid ${borderColor}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <p style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>Tisch {table.table_num}</p>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: dotColor, display: 'inline-block', marginTop: '3px', flexShrink: 0 }} />
                      </div>
                      {table.label !== `Tisch ${table.table_num}` && (
                        <p style={{ color: '#555', fontSize: '0.75rem', marginBottom: '8px' }}>{table.label}</p>
                      )}
                      {isOccupied ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {tableOrders.map(o => (
                            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.75rem', color: o.status === 'new' ? '#f59e0b' : '#ff6b35', fontWeight: 600 }}>
                                {o.status === 'new' ? '● Neu' : '● Küche'}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: '#555' }}>{timeAgo(o.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 600 }}>Frei</p>
                      )}
                      <button
                        onClick={() => setOrderingTable(table)}
                        style={{
                          marginTop: '10px',
                          width: '100%',
                          background: '#e5b44b',
                          color: '#000',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '5px 0',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        + Bestellen
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* Staff Order Panel — Desktop slide-over */}
      {orderingTable && !isMobile && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOrderingTable(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40 }}
          />
          {/* Panel */}
          <div style={{
            position: 'fixed', right: 0, top: 0, height: '100%', width: '380px',
            zIndex: 50, background: '#141414', borderLeft: '1px solid #2a2a2a', overflowY: 'auto',
          }}>
            <StaffOrderPanel
              table={orderingTable}
              restaurantId={session.restaurant.id}
              existingOrders={orders.filter(o => o.table_id === orderingTable.id && ['new', 'cooking'].includes(o.status))}
              onClose={() => setOrderingTable(null)}
              onOrderPlaced={() => { /* orders update via realtime subscription */ }}
            />
          </div>
        </>
      )}

      {/* Staff Order Panel — Mobile fullscreen */}
      {orderingTable && isMobile && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#0d0d0d', overflowY: 'auto' }}>
          <StaffOrderPanel
            table={orderingTable}
            restaurantId={session.restaurant.id}
            existingOrders={orders.filter(o => o.table_id === orderingTable.id && ['new', 'cooking'].includes(o.status))}
            onClose={() => setOrderingTable(null)}
            onOrderPlaced={() => { /* orders update via realtime subscription */ }}
          />
        </div>
      )}

      {/* Reservierungen View */}
      {view === 'reservations' && (() => {
        const today = new Date().toISOString().split('T')[0]
        const todayRes = reservations.filter(r => r.date === today)
        const tomorrowRes = reservations.filter(r => r.date !== today)
        return (
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', maxWidth: '700px', width: '100%', margin: '0 auto' }}>
            {reservations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}><CalendarDays size={40} color="#555" /></div>
                <p style={{ color: '#555' }}>Keine Reservierungen heute oder morgen.</p>
              </div>
            ) : (
              <>
                {todayRes.length > 0 && (
                  <div style={{ marginBottom: '28px' }}>
                    <p style={{ color: '#555', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Heute</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {todayRes.map(res => (
                        <ReservationCard key={res.id} res={res} />
                      ))}
                    </div>
                  </div>
                )}
                {tomorrowRes.length > 0 && (
                  <div>
                    <p style={{ color: '#555', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Morgen</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {tomorrowRes.map(res => (
                        <ReservationCard key={res.id} res={res} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )
      })()}
    </div>
  )
}

function ReservationCard({ res }: { res: Reservation }) {
  const statusColors: Record<string, { bg: string; color: string; label: string }> = {
    pending:   { bg: '#1f150033', color: '#f59e0b', label: 'Ausstehend' },
    confirmed: { bg: '#0a1f0a33', color: '#10b981', label: 'Bestätigt' },
    cancelled: { bg: '#1f000033', color: '#ef4444', label: 'Abgesagt' },
  }
  const st = statusColors[res.status] ?? statusColors.pending
  return (
    <div style={{
      background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '10px',
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
    }}>
      <div style={{ minWidth: '48px', textAlign: 'center' }}>
        <p style={{ color: '#ff6b35', fontWeight: 700, fontSize: '0.95rem' }}>{res.time_from.slice(0, 5)}</p>
        <p style={{ color: '#555', fontSize: '0.65rem' }}>Uhr</p>
      </div>
      <div style={{ flex: 1, minWidth: '150px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.875rem' }}>{res.customer_name}</p>
          <span style={{ background: st.bg, color: st.color, fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '20px', border: `1px solid ${st.color}44` }}>{st.label}</span>
        </div>
        <p style={{ color: '#555', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Users size={12} /> {res.guests} · <Phone size={12} /> {res.customer_phone}
        </p>
        {res.note && <p style={{ color: '#444', fontSize: '0.75rem', marginTop: '2px', fontStyle: 'italic' }}>„{res.note}"</p>}
      </div>
    </div>
  )
}
