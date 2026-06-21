'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Order } from '@/types/database'
import { FileText, Euro, ShoppingBag, TrendingUp, Clock, Printer, ChevronLeft, Users, UtensilsCrossed } from 'lucide-react'

type OrderItem = { name: string; qty: number; price: number }

export default function TagesabschlussPage() {
  const router = useRouter()
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [restaurantName, setRestaurantName] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const today = new Date()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/owner-login'); return }
      const { data: resto } = await supabase
        .from('restaurants').select('id, name').eq('owner_id', session.user.id).limit(1).maybeSingle()
      if (!resto) return
      setRestaurantId(resto.id)
      setRestaurantName(resto.name)

      const todayStr = today.toISOString().split('T')[0]
      const { data } = await supabase
        .from('orders').select('*')
        .eq('restaurant_id', resto.id)
        .gte('created_at', `${todayStr}T00:00:00`)
        .order('created_at', { ascending: true })
      setOrders((data as Order[]) || [])
      setLoading(false)
    })
  }, [router])

  const served    = orders.filter(o => o.status === 'served')
  const cancelled = orders.filter(o => o.status === 'cancelled')
  const active    = orders.filter(o => ['new', 'cooking', 'out_for_delivery'].includes(o.status))

  const totalRevenue  = served.reduce((s, o) => s + (o.total || 0), 0)
  const avgOrder      = served.length > 0 ? totalRevenue / served.length : 0

  // Best-selling items
  const itemCounts: Record<string, { qty: number; revenue: number }> = {}
  served.forEach(o => {
    ;(o.items as OrderItem[]).forEach(item => {
      if (!itemCounts[item.name]) itemCounts[item.name] = { qty: 0, revenue: 0 }
      itemCounts[item.name].qty += item.qty
      itemCounts[item.name].revenue += item.qty * (item.price || 0)
    })
  })
  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 10)

  // Revenue by hour
  const byHour: Record<number, number> = {}
  served.forEach(o => {
    const h = new Date(o.created_at).getHours()
    byHour[h] = (byHour[h] || 0) + (o.total || 0)
  })
  const peakHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0]

  // Type breakdown
  const byType = {
    dine_in:  served.filter(o => o.order_type === 'dine_in').length,
    delivery: served.filter(o => o.order_type === 'delivery').length,
    pickup:   served.filter(o => o.order_type === 'pickup').length,
  }

  const dateStr = today.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--text-muted)' }}>Lädt…</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '18px 24px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/admin')}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
          >
            <ChevronLeft size={16} />
          </button>
          <div style={{ background: 'rgba(99,102,241,0.12)', borderRadius: '10px', padding: '9px', display: 'flex' }}>
            <FileText size={20} color="#6366f1" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Tagesabschluss</h1>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{dateStr}</p>
          </div>
          <button
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#6366f1', border: 'none', borderRadius: '9px', padding: '9px 16px', cursor: 'pointer', color: '#fff', fontSize: '0.82rem', fontWeight: 700 }}
          >
            <Printer size={15} /> Drucken / PDF
          </button>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '860px', margin: '0 auto' }}>

        {/* Restaurant name + date */}
        <div style={{ textAlign: 'center', marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{restaurantName}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>{dateStr}</div>
        </div>

        {/* Main KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 170px), 1fr))', gap: '12px', marginBottom: '24px' }}>
          <KPICard icon={<Euro size={18} color="#10b981" />}  label="Gesamtumsatz" value={`€ ${totalRevenue.toFixed(2)}`} bg="rgba(16,185,129,0.1)" />
          <KPICard icon={<ShoppingBag size={18} color="#f59e0b" />} label="Bestellungen" value={String(served.length)} bg="rgba(245,158,11,0.1)" />
          <KPICard icon={<TrendingUp size={18} color="#6366f1" />}  label="Ø Bon" value={avgOrder > 0 ? `€ ${avgOrder.toFixed(2)}` : '—'} bg="rgba(99,102,241,0.1)" />
          <KPICard icon={<Clock size={18} color="#60a5fa" />}       label="Stoßzeit" value={peakHour ? `${peakHour[0]}:00 Uhr` : '—'} bg="rgba(96,165,250,0.1)" />
        </div>

        {/* Type breakdown */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px 20px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Users size={16} color="#6366f1" />
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Auftragstypen</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { label: 'Tisch', count: byType.dine_in, color: '#10b981' },
              { label: 'Lieferung', count: byType.delivery, color: '#60a5fa' },
              { label: 'Abholung', count: byType.pickup, color: '#f59e0b' },
              { label: 'Storniert', count: cancelled.length, color: '#ef4444' },
              { label: 'Noch aktiv', count: active.length, color: 'var(--text-muted)' },
            ].map(t => (
              <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg)', borderRadius: '9px', padding: '8px 14px', border: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: t.color }}>{t.count}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top items */}
        {topItems.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px 20px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <UtensilsCrossed size={16} color="#ff6b35" />
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Bestseller heute</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {topItems.map(([name, stats], idx) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: idx < topItems.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: '20px', textAlign: 'right' }}>#{idx + 1}</span>
                  <span style={{ flex: 1, fontSize: '0.88rem', fontWeight: 600 }}>{name}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{stats.qty}×</span>
                  {stats.revenue > 0 && (
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, minWidth: '64px', textAlign: 'right' }}>€ {stats.revenue.toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revenue by hour */}
        {Object.keys(byHour).length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px 20px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Clock size={16} color="#60a5fa" />
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Umsatz nach Stunde</span>
            </div>
            <HourBar byHour={byHour} />
          </div>
        )}

        {/* Signature area */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '14px', padding: '20px', marginTop: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {['Schichtleiter / Unterschrift', 'Kassenstand geprüft von'].map(label => (
              <div key={label}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '28px' }}>{label}</div>
                <div style={{ borderBottom: '1px solid var(--border)', width: '100%' }} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: '16px', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Erstellt am {today.toLocaleString('de-DE')} · RestaurantOS
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}

function KPICard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: '12px', border: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '2px' }}>{value}</div>
      </div>
    </div>
  )
}

function HourBar({ byHour }: { byHour: Record<number, number> }) {
  const max = Math.max(...Object.values(byHour), 1)
  const hours = Array.from({ length: 24 }, (_, i) => i).filter(h => byHour[h] !== undefined)
  if (hours.length === 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '70px' }}>
      {hours.map(h => {
        const val = byHour[h] || 0
        const pct = (val / max) * 100
        return (
          <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div
              title={`${h}:00 Uhr — € ${val.toFixed(2)}`}
              style={{ width: '100%', borderRadius: '3px 3px 0 0', height: `${Math.max(pct, 6)}%`, background: 'var(--accent)', minHeight: '4px', transition: 'height 0.4s' }}
            />
            <span style={{ fontSize: '0.52rem', color: 'var(--text-muted)' }}>{h}</span>
          </div>
        )
      })}
    </div>
  )
}
