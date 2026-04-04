'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Order, Restaurant } from '@/types/database'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface Reservation { id: string }
interface Bestseller { name: string; qty: number; umsatz: number }
interface ExternalTransaction {
  id: string
  source: 'stripe_terminal' | 'sumup' | 'zettle' | 'square' | 'cash'
  amount: number
  paid_at: string
  note?: string
}

const ACCENT = '#6c63ff'
const COLORS = [ACCENT, '#10b981', '#f59e0b', '#ef4444', '#3b82f6']

const SOURCE_LABELS: Record<string, string> = {
  stripe_terminal: 'Stripe Terminal',
  sumup: 'SumUp',
  zettle: 'Zettle',
  square: 'Square',
  cash: 'Barzahlung',
}

export default function StatsPage() {
  const router = useRouter()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [externalTx, setExternalTx] = useState<ExternalTransaction[]>([])
  const [reservationCount, setReservationCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<'today' | 'week' | 'month'>('week')
  const [cashModal, setCashModal] = useState(false)
  const [cashAmount, setCashAmount] = useState('')
  const [cashNote, setCashNote] = useState('')
  const [cashDate, setCashDate] = useState(new Date().toISOString().split('T')[0])
  const [cashSaving, setCashSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }
      const { data: resto } = await supabase.from('restaurants').select('*').eq('owner_id', session.user.id).limit(1).single()
      if (!resto) { router.push('/admin/setup'); return }
      setRestaurant(resto)
      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    if (!restaurant) return
    async function loadData() {
      const now = new Date()
      let from: Date
      if (range === 'today') {
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      } else if (range === 'week') {
        from = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
      } else {
        from = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)
      }
      const fromDateStr = from.toISOString().split('T')[0]
      const todayStr = now.toISOString().split('T')[0]

      const [{ data }, { data: resData }, { data: extData }] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .eq('restaurant_id', restaurant!.id)
          .neq('status', 'cancelled')
          .gte('created_at', from.toISOString())
          .order('created_at', { ascending: true }),
        supabase
          .from('reservations')
          .select('id')
          .eq('restaurant_id', restaurant!.id)
          .neq('status', 'cancelled')
          .gte('date', fromDateStr)
          .lte('date', todayStr),
        supabase
          .from('external_transactions')
          .select('id, source, amount, paid_at, note')
          .eq('restaurant_id', restaurant!.id)
          .gte('paid_at', from.toISOString())
          .order('paid_at', { ascending: true }),
      ])
      setOrders((data as Order[]) || [])
      setReservationCount(((resData as Reservation[]) || []).length)
      setExternalTx((extData as ExternalTransaction[]) || [])
    }
    loadData()
  }, [restaurant, range])

  async function saveCashEntry() {
    if (!restaurant || !cashAmount || isNaN(parseFloat(cashAmount))) return
    setCashSaving(true)
    const paid_at = new Date(cashDate + 'T12:00:00').toISOString()
    await supabase.from('external_transactions').insert({
      restaurant_id: restaurant.id,
      source: 'cash',
      amount: parseFloat(parseFloat(cashAmount).toFixed(2)),
      note: cashNote || null,
      paid_at,
    })
    setCashSaving(false)
    setCashModal(false)
    setCashAmount('')
    setCashNote('')
    setCashDate(new Date().toISOString().split('T')[0])
    // Daten neu laden
    setRestaurant(r => r ? { ...r } : r)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Lädt...</p>
    </div>
  )

  // --- Berechnungen ---
  const qrRevenue = orders.reduce((s, o) => s + o.total, 0)
  const extRevenue = externalTx.reduce((s, t) => s + t.amount, 0)
  const totalRevenue = qrRevenue + extRevenue
  const avgOrder = orders.length > 0 ? qrRevenue / orders.length : 0
  const dineIn = orders.filter(o => o.order_type === 'dine_in').length
  const delivery = orders.filter(o => o.order_type === 'delivery').length
  const pickup = orders.filter(o => o.order_type === 'pickup').length
  const totalDishes = orders.reduce((s, o) => s + (o.items as { qty: number }[]).reduce((a, i) => a + i.qty, 0), 0)

  // Umsatz nach Quelle
  const sourceMap: Record<string, number> = { 'QR-Digital': qrRevenue }
  externalTx.forEach(t => {
    const label = SOURCE_LABELS[t.source] || t.source
    sourceMap[label] = (sourceMap[label] || 0) + t.amount
  })
  const sourceBreakdown = Object.entries(sourceMap)
    .filter(([, v]) => v > 0)
    .map(([name, umsatz]) => ({ name, umsatz: Math.round(umsatz * 100) / 100 }))

  // Umsatzverlauf (QR + externe kombiniert)
  const revenueChartData = buildRevenueData(orders, externalTx, range)

  // Bestseller
  const itemMap: Record<string, Bestseller> = {}
  orders.forEach(o => {
    const items = o.items as { name: string; qty: number; price: number }[]
    items.forEach(i => {
      if (!itemMap[i.name]) itemMap[i.name] = { name: i.name, qty: 0, umsatz: 0 }
      itemMap[i.name].qty += i.qty
      itemMap[i.name].umsatz += i.qty * i.price
    })
  })
  const bestsellers = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 6)

  // Bestelltypen für PieChart
  const pieData = [
    { name: 'Abholung', value: pickup },
    { name: 'Lieferung', value: delivery },
    { name: 'Dine-In', value: dineIn },
  ].filter(d => d.value > 0)

  const hasData = orders.length > 0 || externalTx.length > 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '1.2rem' }}>←</button>
          <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>Statistik</h1>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setCashModal(true)}
            style={{
              padding: '6px 14px', borderRadius: '8px', border: '1.5px solid var(--accent)',
              background: 'var(--accent)', color: '#fff',
              fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
            }}
          >
            + Bareinnahmen
          </button>
          {(['today', 'week', 'month'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: '6px 14px', borderRadius: '8px', border: '1.5px solid',
                borderColor: range === r ? 'var(--accent)' : 'var(--border)',
                background: range === r ? 'var(--accent-subtle)' : 'transparent',
                color: range === r ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
              }}
            >
              {r === 'today' ? 'Heute' : r === 'week' ? '7 Tage' : '30 Tage'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
        {!hasData ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📊</div>
            <p style={{ color: 'var(--text-muted)' }}>Noch keine Daten im gewählten Zeitraum.</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <StatCard label="Gesamtumsatz" value={`${totalRevenue.toFixed(2)} €`} accent />
              <StatCard label="QR-Digital" value={`${qrRevenue.toFixed(2)} €`} />
              <StatCard label="Bestellungen" value={String(orders.length)} />
              <StatCard label="Ø Bestellwert" value={`${avgOrder.toFixed(2)} €`} />
              <StatCard label="Gerichte" value={String(totalDishes)} />
              <StatCard label="Reservierungen" value={String(reservationCount)} />
            </div>

            {/* Umsatz nach Quelle */}
            {sourceBreakdown.length > 1 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
                <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '20px' }}>Umsatz nach Quelle</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {sourceBreakdown.map((s, i) => (
                    <div key={s.name} style={{
                      flex: '1 1 140px', background: 'var(--bg)', borderRadius: '12px', padding: '16px',
                      borderLeft: `3px solid ${COLORS[i % COLORS.length]}`,
                    }}>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{s.name}</p>
                      <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.3rem' }}>{s.umsatz.toFixed(2)} €</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Umsatzverlauf */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
              <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '20px' }}>
                Umsatzverlauf {range === 'today' ? '(nach Stunde)' : range === 'week' ? '(letzte 7 Tage)' : '(letzte 30 Tage)'}
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenueChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="umsatzGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={ACCENT} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} width={55} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.8rem' }}
                    labelStyle={{ color: 'var(--text)', fontWeight: 600 }}
                    formatter={(v: number) => [`${v.toFixed(2)} €`, 'Umsatz']}
                  />
                  <Area type="monotone" dataKey="umsatz" stroke={ACCENT} strokeWidth={2.5} fill="url(#umsatzGrad)" dot={false} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: bestsellers.length > 0 && pieData.length > 0 ? '1fr 1fr' : '1fr', gap: '20px', marginBottom: '20px' }}>
              {/* Bestseller */}
              {bestsellers.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '20px' }}>Bestseller</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={bestsellers} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" width={90} tick={{ fill: 'var(--text)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.8rem' }}
                        formatter={(v: number, name: string) => [name === 'qty' ? `${v}×` : `${v.toFixed(2)} €`, name === 'qty' ? 'Verkauft' : 'Umsatz']}
                      />
                      <Bar dataKey="qty" fill={ACCENT} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Bestelltypen Pie */}
              {pieData.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '20px' }}>Bestelltypen</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.8rem' }}
                        formatter={(v: number) => [`${v} Bestellungen`]}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(value) => <span style={{ color: 'var(--text)', fontSize: '0.8rem' }}>{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bareinnahmen Modal */}
      {cashModal && (
        <div
          onClick={() => setCashModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '16px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: '20px',
              padding: '28px', width: '100%', maxWidth: '380px',
              border: '1px solid var(--border)',
            }}
          >
            <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '20px' }}>
              Bareinnahmen eintragen
            </h2>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Betrag (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={cashAmount}
                onChange={e => setCashAmount(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  border: '1.5px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)', fontSize: '1rem', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Datum
              </label>
              <input
                type="date"
                value={cashDate}
                onChange={e => setCashDate(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  border: '1.5px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)', fontSize: '0.9rem', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Notiz (optional)
              </label>
              <input
                type="text"
                placeholder="z.B. Mittagsschicht"
                value={cashNote}
                onChange={e => setCashNote(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  border: '1.5px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)', fontSize: '0.9rem', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setCashModal(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  border: '1.5px solid var(--border)', background: 'transparent',
                  color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={saveCashEntry}
                disabled={cashSaving || !cashAmount || parseFloat(cashAmount) <= 0}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  border: 'none', background: 'var(--accent)',
                  color: '#fff', fontWeight: 700, cursor: 'pointer',
                  opacity: cashSaving || !cashAmount ? 0.6 : 1,
                }}
              >
                {cashSaving ? 'Speichern...' : 'Eintragen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px 24px' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{label}</p>
      <p style={{ color: accent ? 'var(--accent)' : 'var(--text)', fontWeight: 700, fontSize: '1.6rem', lineHeight: 1 }}>{value}</p>
    </div>
  )
}

function buildRevenueData(orders: Order[], externalTx: ExternalTransaction[], range: 'today' | 'week' | 'month') {
  if (range === 'today') {
    const hourly: Record<number, number> = {}
    for (let h = 0; h < 24; h++) hourly[h] = 0
    orders.forEach(o => {
      const h = new Date(o.created_at).getHours()
      hourly[h] += o.total
    })
    externalTx.forEach(t => {
      const h = new Date(t.paid_at).getHours()
      hourly[h] = (hourly[h] || 0) + t.amount
    })
    return Array.from({ length: 24 }, (_, h) => ({
      label: `${h}h`,
      umsatz: Math.round(hourly[h] * 100) / 100,
    }))
  }

  const days = range === 'week' ? 7 : 30
  const now = new Date()
  const dailyMap: Record<string, number> = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().split('T')[0]
    dailyMap[key] = 0
  }
  orders.forEach(o => {
    const key = new Date(o.created_at).toISOString().split('T')[0]
    if (key in dailyMap) dailyMap[key] += o.total
  })
  externalTx.forEach(t => {
    const key = new Date(t.paid_at).toISOString().split('T')[0]
    if (key in dailyMap) dailyMap[key] = (dailyMap[key] || 0) + t.amount
  })

  return Object.entries(dailyMap).map(([date, umsatz]) => {
    const d = new Date(date + 'T00:00:00')
    const label = range === 'week'
      ? d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' })
      : d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
    return { label, umsatz: Math.round(umsatz * 100) / 100 }
  })
}
