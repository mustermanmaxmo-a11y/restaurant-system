'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Order, Restaurant, Table } from '@/types/database'
import { useLanguage } from '@/components/providers/language-provider'
import { getPlanLimits } from '@/lib/plan-limits'
import type { RestaurantPlan } from '@/types/database'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { BarChart2 } from 'lucide-react'
import WeeklyReport from './_components/WeeklyReport'

interface Reservation { id: string }
interface Bestseller { name: string; qty: number }

const ACCENT = '#6c63ff'
const COLORS = [ACCENT, '#10b981', '#f59e0b', '#ef4444', '#3b82f6']

export default function StatsPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [reservationCount, setReservationCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<'today' | 'week' | 'month'>('week')

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

      const [{ data }, { data: resData }, { data: tableData }] = await Promise.all([
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
          .from('tables')
          .select('id, label, table_num')
          .eq('restaurant_id', restaurant!.id),
      ])
      setOrders((data as Order[]) || [])
      setReservationCount(((resData as Reservation[]) || []).length)
      setTables((tableData as Table[]) || [])
    }
    loadData()
  }, [restaurant, range])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
    </div>
  )

  const limits = getPlanLimits((restaurant?.plan ?? 'starter') as RestaurantPlan)

  // --- Berechnungen ---
  const dineIn = orders.filter(o => o.order_type === 'dine_in').length
  const delivery = orders.filter(o => o.order_type === 'delivery').length
  const pickup = orders.filter(o => o.order_type === 'pickup').length
  const totalDishes = orders.reduce((s, o) => s + (o.items as { qty: number }[]).reduce((a, i) => a + i.qty, 0), 0)

  // Bestseller
  const itemMap: Record<string, Bestseller> = {}
  orders.forEach(o => {
    const items = o.items as { name: string; qty: number; price: number }[]
    items.forEach(i => {
      if (!itemMap[i.name]) itemMap[i.name] = { name: i.name, qty: 0 }
      itemMap[i.name].qty += i.qty
    })
  })
  const bestsellers = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 6)

  // Bestelltypen für PieChart
  const pieData = [
    { name: 'Abholung', value: pickup },
    { name: 'Lieferung', value: delivery },
    { name: 'Dine-In', value: dineIn },
  ].filter(d => d.value > 0)

  // Stoßzeiten (stündliche Verteilung)
  const hourlyDistribution = Array.from({ length: 24 }, (_, h) => ({
    label: `${h}h`,
    count: orders.filter(o => new Date(o.created_at).getHours() === h).length,
  })).filter(h => h.count > 0)

  // Tisch-Aktivität
  const tableActivity: Record<string, { count: number; revenue: number }> = {}
  orders.filter(o => o.table_id).forEach(o => {
    if (!tableActivity[o.table_id!]) tableActivity[o.table_id!] = { count: 0, revenue: 0 }
    tableActivity[o.table_id!].count++
    tableActivity[o.table_id!].revenue += o.total || 0
  })
  const tableMap = Object.fromEntries(tables.map(t => [t.id, t.label || `Tisch ${t.table_num}`]))
  const tableChartData = Object.entries(tableActivity)
    .map(([id, data]) => ({ name: tableMap[id] || 'Tisch', count: data.count, revenue: data.revenue }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Nach Wochentag
  const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
  const byDay = Array(7).fill(0)
  orders.forEach(o => {
    const d = new Date(o.created_at).getDay()
    byDay[d]++
  })
  const maxDay = Math.max(...byDay, 1)

  const hasData = orders.length > 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '1.2rem' }}>←</button>
          <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>Bestellanalyse</h1>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {(['today', 'week'] as const).map(r => (
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
              {r === 'today' ? 'Heute' : '7 Tage'}
            </button>
          ))}
          {limits.analyticsRangeDays > 7 && (
            <button
              onClick={() => setRange('month')}
              style={{
                padding: '6px 14px', borderRadius: '8px', border: '1.5px solid',
                borderColor: range === 'month' ? 'var(--accent)' : 'var(--border)',
                background: range === 'month' ? 'var(--accent-subtle)' : 'transparent',
                color: range === 'month' ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
              }}
            >
              30 Tage
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
        {!hasData ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}><BarChart2 size={48} color="var(--text-muted)" /></div>
            <p style={{ color: 'var(--text-muted)' }}>Noch keine Daten im gewählten Zeitraum.</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <StatCard label="Bestellungen" value={String(orders.length)} accent />
              <StatCard label="Gerichte" value={String(totalDishes)} />
              <StatCard label="Reservierungen" value={String(reservationCount)} />
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
                        formatter={(v: unknown) => [`${v}×`, 'Verkauft']}
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
                        formatter={(v: unknown) => [`${v} Bestellungen`]}
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

            {/* Stoßzeiten */}
            {hourlyDistribution.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
                <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '20px' }}>Stoßzeiten</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={hourlyDistribution} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.8rem' }}
                      labelStyle={{ color: 'var(--text)', fontWeight: 600 }}
                      formatter={(v: unknown) => [`${v} Bestellungen`]}
                    />
                    <Bar dataKey="count" fill={ACCENT} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Nach Wochentag */}
            {orders.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
                <h3 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '4px' }}>Nach Wochentag</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '20px' }}>Ø Bestellungen pro Tag</p>
                {DAYS.map((day, i) => (
                  <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div style={{ width: '24px', fontSize: '12px', color: '#888' }}>{day}</div>
                    <div style={{ flex: 1, background: '#2a2a2a', borderRadius: '3px', height: '14px' }}>
                      <div style={{
                        background: byDay[i] === Math.max(...byDay) ? '#e5b44b' : '#e5b44b66',
                        borderRadius: '3px',
                        height: '100%',
                        width: `${(byDay[i] / maxDay) * 100}%`,
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <div style={{ width: '28px', fontSize: '11px', color: byDay[i] === Math.max(...byDay) ? '#e5b44b' : '#888', textAlign: 'right' }}>
                      {byDay[i]}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tisch-Aktivität */}
            {tableChartData.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
                <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '20px' }}>Tisch-Aktivität</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Tisch</th>
                        <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Bestellungen</th>
                        <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Umsatz</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableChartData.map((t) => (
                        <tr key={t.name} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 0', color: 'var(--text)', fontSize: '0.9rem' }}>{t.name}</td>
                          <td style={{ textAlign: 'right', padding: '12px 0', color: 'var(--text)', fontSize: '0.9rem' }}>{t.count}</td>
                          <td style={{ textAlign: 'right', padding: '12px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t.revenue.toFixed(0)} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* KI-Wochenbericht — Pro/Enterprise only, always visible */}
        {(restaurant?.plan === 'pro' || restaurant?.plan === 'enterprise') && (
          <div style={{ padding: '0 24px 24px' }}>
            <WeeklyReport restaurantId={restaurant.id} />
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px 24px' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{label}</p>
      <p style={{ color: warn ? '#f87171' : accent ? 'var(--accent)' : 'var(--text)', fontWeight: 700, fontSize: '1.6rem', lineHeight: 1 }}>{value}</p>
    </div>
  )
}
