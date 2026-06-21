'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { setOrderStatus } from '@/lib/orders/setOrderStatus'
import type { Order, Table } from '@/types/database'
import { ChefHat, Clock, Volume2, VolumeX, Maximize2, AlertTriangle, ArrowLeft } from 'lucide-react'

export default function KDSPage() {
  const router = useRouter()
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [tableMap, setTableMap] = useState<Record<string, number>>({})
  const [updating, setUpdating] = useState<string | null>(null)
  const [sound, setSound] = useState(true)
  const [tick, setTick] = useState(0)
  const knownIds = useRef<Set<string>>(new Set())

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  function playBeep() {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = 830
      gain.gain.setValueAtTime(0.35, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.start()
      osc.stop(ctx.currentTime + 0.5)
    } catch {}
  }

  const loadOrders = useCallback(async (rid: string, withSound = false) => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', rid)
      .in('status', ['new', 'cooking'])
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: true })

    if (!data) return
    if (withSound) {
      const hasNew = data.some(o => o.status === 'new' && !knownIds.current.has(o.id))
      if (hasNew && sound) playBeep()
    }
    knownIds.current = new Set(data.map(o => o.id))
    setOrders(data as Order[])
  }, [sound])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/owner-login'); return }
      const { data: resto } = await supabase
        .from('restaurants').select('id').eq('owner_id', session.user.id).limit(1).maybeSingle()
      if (!resto) return
      setRestaurantId(resto.id)

      // Load tables map
      const { data: tables } = await supabase
        .from('tables').select('id, table_num').eq('restaurant_id', resto.id)
      if (tables) {
        const m: Record<string, number> = {}
        ;(tables as Table[]).forEach(t => { m[t.id] = t.table_num })
        setTableMap(m)
      }

      await loadOrders(resto.id, false)
    })
  }, [router, loadOrders])

  useEffect(() => {
    if (!restaurantId) return
    const ch = supabase.channel(`kds-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => loadOrders(restaurantId, true))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [restaurantId, loadOrders])

  async function advance(order: Order) {
    setUpdating(order.id)
    const next = order.status === 'new' ? 'cooking' : 'served'
    await setOrderStatus(order.id, next)
    setUpdating(null)
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
    else document.exitFullscreen().catch(() => {})
  }

  const newOrders     = orders.filter(o => o.status === 'new')
  const cookingOrders = orders.filter(o => o.status === 'cooking')
  const now = new Date()

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: '#111', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => router.push('/admin/orders')}
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex' }}
          >
            <ArrowLeft size={15} />
          </button>
          <div style={{ background: '#ff6b35', borderRadius: '10px', padding: '8px', display: 'flex' }}>
            <ChefHat size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>Küchen-Display</div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: '1px' }}>
              {newOrders.length} neu · {cookingOrders.length} in Zubereitung
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em' }}>
            {now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <button
            onClick={() => setSound(s => !s)}
            title={sound ? 'Ton deaktivieren' : 'Ton aktivieren'}
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: sound ? '#fff' : 'rgba(255,255,255,0.3)', display: 'flex' }}
          >
            {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            onClick={toggleFullscreen}
            title="Vollbild"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#fff', display: 'flex' }}
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {/* Two-column board */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, gap: '1px', background: 'rgba(255,255,255,0.05)' }}>

        {/* NEW */}
        <div style={{ background: '#0a0a0a', padding: '18px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 12px #f59e0b88', flexShrink: 0 }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Neu — {newOrders.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {newOrders.length === 0
              ? <EmptyState text="Keine neuen Bestellungen" />
              : newOrders.map(o => (
                <KDSCard key={o.id} order={o} tableMap={tableMap} now={now}
                  actionLabel="In Küche →" actionColor="#f59e0b"
                  onAction={() => advance(o)} isUpdating={updating === o.id} />
              ))}
          </div>
        </div>

        {/* COOKING */}
        <div style={{ background: '#0b0906', padding: '18px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ff6b35', boxShadow: '0 0 12px #ff6b3588', flexShrink: 0 }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ff6b35', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              In Zubereitung — {cookingOrders.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {cookingOrders.length === 0
              ? <EmptyState text="Nichts in Zubereitung" />
              : cookingOrders.map(o => (
                <KDSCard key={o.id} order={o} tableMap={tableMap} now={now}
                  actionLabel="Serviert ✓" actionColor="#10b981"
                  onAction={() => advance(o)} isUpdating={updating === o.id} />
              ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 600px) {
          .kds-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.18)', padding: '50px 16px', fontSize: '0.85rem' }}>
      {text}
    </div>
  )
}

function KDSCard({ order, tableMap, now, actionLabel, actionColor, onAction, isUpdating }: {
  order: Order
  tableMap: Record<string, number>
  now: Date
  actionLabel: string
  actionColor: string
  onAction: () => void
  isUpdating: boolean
}) {
  const items = Array.isArray(order.items) ? order.items : []
  const mins = Math.floor((now.getTime() - new Date(order.created_at).getTime()) / 60000)
  const isUrgent = mins > 20
  const tableNum = order.table_id ? tableMap[order.table_id] : null

  const locationLabel =
    order.order_type === 'dine_in'  ? (tableNum ? `Tisch ${tableNum}` : 'Tisch ?') :
    order.order_type === 'delivery' ? 'Lieferung' : 'Abholung'

  return (
    <div style={{
      background: '#161616',
      borderRadius: '14px',
      border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.08)'}`,
      padding: '16px',
      boxShadow: isUrgent ? '0 0 0 1px rgba(239,68,68,0.2)' : 'none',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: actionColor + '22', border: `1px solid ${actionColor}44`, borderRadius: '7px', padding: '4px 10px', fontSize: '0.88rem', fontWeight: 800, color: actionColor }}>
            {locationLabel}
          </div>
          {order.customer_name && (
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{order.customer_name}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isUrgent ? '#ef4444' : 'rgba(255,255,255,0.35)', fontSize: '0.78rem', fontWeight: isUrgent ? 700 : 400 }}>
          {isUrgent && <AlertTriangle size={12} />}
          <Clock size={12} />
          {mins === 0 ? 'Gerade' : `${mins} Min`}
        </div>
      </div>

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '12px' }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '9px' }}>
            <span style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '5px', padding: '1px 7px', fontSize: '1rem', fontWeight: 700, color: '#fff', minWidth: '28px', textAlign: 'center', flexShrink: 0 }}>
              {item.qty}×
            </span>
            <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>{item.name}</span>
          </div>
        ))}
        {items.length === 0 && <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>Keine Artikel</div>}
      </div>

      {/* Note */}
      {order.note && (
        <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '8px', padding: '6px 10px', fontSize: '0.78rem', color: '#fbbf24', marginBottom: '12px' }}>
          ⚠ {order.note}
        </div>
      )}

      {/* Action */}
      <button
        onClick={onAction}
        disabled={isUpdating}
        style={{ width: '100%', padding: '11px', background: actionColor, border: 'none', borderRadius: '10px', color: '#000', fontWeight: 800, fontSize: '0.92rem', cursor: isUpdating ? 'wait' : 'pointer', opacity: isUpdating ? 0.7 : 1, transition: 'opacity 0.15s, transform 0.1s' }}
        onMouseEnter={e => { if (!isUpdating) e.currentTarget.style.transform = 'scale(1.01)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        {isUpdating ? '...' : actionLabel}
      </button>
    </div>
  )
}
