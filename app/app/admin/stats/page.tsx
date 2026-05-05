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
import RevenueForecast from './_components/RevenueForecast'

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
  const [ratings, setRatings] = useState<{ stars: number; feedback: string | null; created_at: string }[]>([])
  const [wasteThisWeek, setWasteThisWeek] = useState<number | null>(null)
  const [wasteLastWeek, setWasteLastWeek] = useState<number | null>(null)

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

      const [{ data }, { data: resData }, { data: tableData }, { data: ratingsData }] = await Promise.all([
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
        supabase
          .from('order_ratings')
          .select('stars, feedback, created_at')
          .eq('restaurant_id', restaurant!.id)
          .gte('created_at', from.toISOString())
          .order('created_at', { ascending: false }),
      ])
      setOrders((data as Order[]) || [])
      setReservationCount(((resData as Reservation[]) || []).length)
      setTables((tableData as Table[]) || [])
      setRatings((ratingsData as { stars: number; feedback: string | null; created_at: string }[]) || [])

      // Waste this week vs last week
      const thisWeekStart = new Date(now.getTime() - 6 * 24 * 3600 * 1000).toISOString()
      const lastWeekStart = new Date(now.getTime() - 13 * 24 * 3600 * 1000).toISOString()
      const [{ data: wasteNow }, { data: wastePrev }] = await Promise.all([
        supabase.from('waste_log').select('quantity, ingredients(purchase_price)').eq('restaurant_id', restaurant!.id).gte('logged_at', thisWeekStart),
        supabase.from('waste_log').select('quantity, ingredients(purchase_price)').eq('restaurant_id', restaurant!.id).gte('logged_at', lastWeekStart).lt('logged_at', thisWeekStart),
      ])
      if (wasteNow) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cost = (wasteNow as any[]).reduce((s: number, l: any) => s + l.quantity * (Array.isArray(l.ingredients) ? (l.ingredients[0]?.purchase_price ?? 0) : (l.ingredients?.purchase_price ?? 0)), 0)
        setWasteThisWeek(cost)
      }
      if (wastePrev) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cost = (wastePrev as any[]).reduce((s: number, l: any) => s + l.quantity * (Array.isArray(l.ingredients) ? (l.ingredients[0]?.purchase_price ?? 0) : (l.ingredients?.purchase_price ?? 0)), 0)
        setWasteLastWeek(cost)
      }
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

  // Ratings
  const avgStars = ratings.length > 0
    ? ratings.reduce((s, r) => s + r.stars, 0) / ratings.length
    : null
  const negativeFeedback = ratings.filter(r => r.stars <= 3 && r.feedback)

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

      <div style={{ padding: '16px', maxWidth: '960px', margin: '0 auto' }}>
        {!hasData ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}><BarChart2 size={48} color="var(--text-muted)" /></div>
            <p style={{ color: 'var(--text-muted)' }}>Noch keine Daten im gewählten Zeitraum.</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <StatCard label="Bestellungen" value={String(orders.length)} accent />
              <StatCard label="Gerichte" value={String(totalDishes)} />
              <StatCard label="Reservierungen" value={String(reservationCount)} />
              <StatCard
                label="Ø Bewertung"
                value={avgStars != null ? `${avgStars.toFixed(1)} ⭐` : '—'}
                accent={avgStars != null && avgStars >= 4}
                warn={avgStars != null && avgStars < 3}
              />
              <StatCard
                label="Verluste (Woche)"
                value={wasteThisWeek != null ? `${wasteThisWeek.toFixed(2)} €` : '—'}
                warn={wasteThisWeek != null && wasteLastWeek != null && wasteThisWeek > wasteLastWeek}
                sub={wasteThisWeek != null && wasteLastWeek != null && wasteLastWeek > 0
                  ? (wasteThisWeek <= wasteLastWeek ? `↓ ${((1 - wasteThisWeek / wasteLastWeek) * 100).toFixed(0)}% zur Vorwoche` : `↑ ${((wasteThisWeek / wasteLastWeek - 1) * 100).toFixed(0)}% zur Vorwoche`)
                  : undefined}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '16px', marginBottom: '16px' }}>
              {/* Bestseller */}
              {bestsellers.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px' }}>
                  <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '16px' }}>Bestseller</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={bestsellers} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" width={72} tick={{ fill: 'var(--text)', fontSize: 10 }} axisLine={false} tickLine={false} />
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
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px' }}>
                  <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '16px' }}>Bestelltypen</p>
                  <ResponsiveContainer width="100%" height={200}>
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
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
                <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '16px' }}>Stoßzeiten</p>
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
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
                <h3 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '4px' }}>Nach Wochentag</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px' }}>Ø Bestellungen pro Tag</p>
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
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
                <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '16px' }}>Tisch-Aktivität</p>
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

        {/* Bewertungen */}
        {ratings.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <p style={{ color: 'var(--text)', fontWeight: 700 }}>Bewertungen ({ratings.length})</p>
              {avgStars != null && (
                <span style={{
                  background: avgStars >= 4 ? '#1a3a1a' : '#3a1a1a',
                  color: avgStars >= 4 ? '#4ade80' : '#f87171',
                  borderRadius: '6px', padding: '3px 10px', fontSize: '0.8rem', fontWeight: 700,
                }}>
                  {avgStars.toFixed(1)} ⭐ Ø
                </span>
              )}
            </div>
            {/* Sternen-Verteilung */}
            <div style={{ marginBottom: negativeFeedback.length > 0 ? '16px' : '0' }}>
              {[5, 4, 3, 2, 1].map(star => {
                const count = ratings.filter(r => r.stars === star).length
                const pct = ratings.length > 0 ? (count / ratings.length) * 100 : 0
                return (
                  <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', width: '32px' }}>{star} ⭐</span>
                    <div style={{ flex: 1, background: 'var(--border)', borderRadius: '3px', height: '8px' }}>
                      <div style={{
                        background: star >= 4 ? '#22c55e' : star === 3 ? '#f59e0b' : '#ef4444',
                        width: `${pct}%`, height: '100%', borderRadius: '3px', transition: 'width 0.3s',
                      }} />
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', width: '20px', textAlign: 'right' }}>{count}</span>
                  </div>
                )
              })}
            </div>
            {/* Negatives Feedback */}
            {negativeFeedback.length > 0 && (
              <>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
                  Internes Feedback (1–3 ⭐)
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {negativeFeedback.slice(0, 5).map((r, i) => (
                    <div key={i} style={{ background: 'var(--bg)', borderRadius: '8px', padding: '10px 12px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ color: '#f87171', fontWeight: 700, fontSize: '0.8rem' }}>{'⭐'.repeat(r.stars)}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                          {new Date(r.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ color: 'var(--text)', fontSize: '0.85rem', margin: 0 }}>{r.feedback}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* KI-Wochenbericht — Pro/Enterprise only, always visible */}
        {(restaurant?.plan === 'pro' || restaurant?.plan === 'enterprise') && (
          <WeeklyReport restaurantId={restaurant.id} />
        )}
        {(restaurant?.plan === 'pro' || restaurant?.plan === 'enterprise' || restaurant?.plan === 'trial') && (
          <RevenueForecast restaurantId={restaurant.id} />
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, accent, warn, sub }: { label: string; value: string; accent?: boolean; warn?: boolean; sub?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px 16px' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>{label}</p>
      <p style={{ color: warn ? '#f87171' : accent ? 'var(--accent)' : 'var(--text)', fontWeight: 700, fontSize: '1.4rem', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ color: warn ? '#f87171' : 'var(--text-muted)', fontSize: '0.65rem', marginTop: '4px' }}>{sub}</p>}
    </div>
  )
}
