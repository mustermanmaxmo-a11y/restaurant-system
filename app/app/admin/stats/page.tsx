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

// Use a fixed purple for recharts (can't use CSS vars in SVG fill)
const CHART_ACCENT = '#7c3aed'
const COLORS = [CHART_ACCENT, '#10b981', '#f59e0b', '#ef4444', '#3b82f6']

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
  const [prepPlan, setPrepPlan] = useState<{ shifts: { name: string; time: string; items: { name: string; qty: number; confidence: string }[] }[]; insight: string } | null>(null)
  const [prepLoading, setPrepLoading] = useState(false)
  const [prepGenerated, setPrepGenerated] = useState(false)
  const [benchmark, setBenchmark] = useState<{ own: { avgRevenue: number | null; avgOrders: number | null; avgOrderValue: number | null }; peer: { avgRevenue: number | null; avgOrders: number | null; avgOrderValue: number | null; poolSize: number } | null; insufficient_pool: boolean; opted_out?: boolean } | null>(null)

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
    async function loadExtras() {
      const today = new Date().toISOString().split('T')[0]
      const [{ data: prepData }, { data: { session } }] = await Promise.all([
        supabase.from('daily_prep_plans').select('plan_data').eq('restaurant_id', restaurant!.id).eq('plan_date', today).single(),
        supabase.auth.getSession(),
      ])
      if (prepData?.plan_data) setPrepPlan(prepData.plan_data as typeof prepPlan)
      if (session) {
        const res = await fetch(`/api/benchmark?restaurantId=${restaurant!.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) setBenchmark(await res.json())
      }
    }
    loadExtras()
  }, [restaurant])

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
        supabase.from('orders').select('*').eq('restaurant_id', restaurant!.id).neq('status', 'cancelled').gte('created_at', from.toISOString()).order('created_at', { ascending: true }),
        supabase.from('reservations').select('id').eq('restaurant_id', restaurant!.id).neq('status', 'cancelled').gte('date', fromDateStr).lte('date', todayStr),
        supabase.from('tables').select('id, label, table_num').eq('restaurant_id', restaurant!.id),
        supabase.from('order_ratings').select('stars, feedback, created_at').eq('restaurant_id', restaurant!.id).gte('created_at', from.toISOString()).order('created_at', { ascending: false }),
      ])
      setOrders((data as Order[]) || [])
      setReservationCount(((resData as Reservation[]) || []).length)
      setTables((tableData as Table[]) || [])
      setRatings((ratingsData as { stars: number; feedback: string | null; created_at: string }[]) || [])

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

  async function generatePrepPlan() {
    if (!restaurant) return
    setPrepLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/ai/prep-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ restaurantId: restaurant.id }),
      })
      const json = await res.json()
      if (json.plan) {
        setPrepPlan(json.plan)
        setPrepGenerated(true)
        setTimeout(() => setPrepGenerated(false), 3000)
      }
    } finally {
      setPrepLoading(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
    </div>
  )

  const limits = getPlanLimits((restaurant?.plan ?? 'starter') as RestaurantPlan)

  const dineIn   = orders.filter(o => o.order_type === 'dine_in').length
  const delivery = orders.filter(o => o.order_type === 'delivery').length
  const pickup   = orders.filter(o => o.order_type === 'pickup').length
  const totalDishes = orders.reduce((s, o) => s + (o.items as { qty: number }[]).reduce((a, i) => a + i.qty, 0), 0)

  const itemMap: Record<string, Bestseller> = {}
  orders.forEach(o => {
    const items = o.items as { name: string; qty: number; price: number }[]
    items.forEach(i => {
      if (!itemMap[i.name]) itemMap[i.name] = { name: i.name, qty: 0 }
      itemMap[i.name].qty += i.qty
    })
  })
  const bestsellers = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 6)

  const pieData = [
    { name: 'Abholung', value: pickup },
    { name: 'Lieferung', value: delivery },
    { name: 'Dine-In', value: dineIn },
  ].filter(d => d.value > 0)

  const hourlyDistribution = Array.from({ length: 24 }, (_, h) => ({
    label: `${h}h`,
    count: orders.filter(o => new Date(o.created_at).getHours() === h).length,
  })).filter(h => h.count > 0)

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

  const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
  const byDay = Array(7).fill(0)
  orders.forEach(o => { byDay[new Date(o.created_at).getDay()]++ })
  const maxDay = Math.max(...byDay, 1)

  const hasData = orders.length > 0

  const avgStars = ratings.length > 0
    ? ratings.reduce((s, r) => s + r.stars, 0) / ratings.length
    : null
  const negativeFeedback = ratings.filter(r => r.stars <= 3 && r.feedback)

  const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.8rem' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sticky Header */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '14px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10,
        flexWrap: 'wrap', gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fbbf2418', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart2 size={18} color="#fbbf24" />
          </div>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1 }}>Bestellanalyse</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1px' }}>Statistiken & Trends</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {(['today', 'week'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: '6px 13px', borderRadius: '20px', border: '1.5px solid',
                borderColor: range === r ? 'var(--accent)' : 'var(--border)',
                background: range === r ? 'var(--accent-subtle)' : 'transparent',
                color: range === r ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
              }}
            >
              {r === 'today' ? 'Heute' : '7 Tage'}
            </button>
          ))}
          {limits.analyticsRangeDays > 7 && (
            <button
              onClick={() => setRange('month')}
              style={{
                padding: '6px 13px', borderRadius: '20px', border: '1.5px solid',
                borderColor: range === 'month' ? 'var(--accent)' : 'var(--border)',
                background: range === 'month' ? 'var(--accent-subtle)' : 'transparent',
                color: range === 'month' ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
              }}
            >
              30 Tage
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 20px 40px', maxWidth: '960px', margin: '0 auto' }}>
        {!hasData ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}><BarChart2 size={48} color="var(--text-muted)" /></div>
            <p style={{ color: 'var(--text-muted)' }}>Noch keine Daten im gewählten Zeitraum.</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))', gap: '12px', marginBottom: '20px' }}>
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
              {bestsellers.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px' }}>
                  <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '16px' }}>Bestseller</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={bestsellers} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" width={72} tick={{ fill: 'var(--text)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [`${v}×`, 'Verkauft']} />
                      <Bar dataKey="qty" fill={CHART_ACCENT} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {pieData.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px' }}>
                  <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '16px' }}>Bestelltypen</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                        {pieData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [`${v} Bestellungen`]} />
                      <Legend iconType="circle" iconSize={8} formatter={(value) => <span style={{ color: 'var(--text)', fontSize: '0.8rem' }}>{value}</span>} />
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
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text)', fontWeight: 600 }} formatter={(v: unknown) => [`${v} Bestellungen`]} />
                    <Bar dataKey="count" fill={CHART_ACCENT} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Nach Wochentag */}
            {orders.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
                <h3 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '4px' }}>Nach Wochentag</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px' }}>Ø Bestellungen pro Tag</p>
                {DAYS.map((day, i) => {
                  const isPeak = byDay[i] === Math.max(...byDay)
                  return (
                    <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <div style={{ width: '24px', fontSize: '12px', color: 'var(--text-muted)' }}>{day}</div>
                      <div style={{ flex: 1, background: 'var(--border)', borderRadius: '3px', height: '14px' }}>
                        <div style={{
                          background: isPeak ? 'var(--accent)' : 'var(--border-accent)',
                          borderRadius: '3px', height: '100%',
                          width: `${(byDay[i] / maxDay) * 100}%`,
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                      <div style={{ width: '28px', fontSize: '11px', color: isPeak ? 'var(--accent)' : 'var(--text-muted)', textAlign: 'right' }}>
                        {byDay[i]}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Tisch-Aktivität */}
            {tableChartData.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
                <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '16px' }}>Tisch-Aktivität</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '260px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tisch</th>
                        <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Best.</th>
                        <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Umsatz</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableChartData.map((t) => (
                        <tr key={t.name} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '11px 0', color: 'var(--text)', fontSize: '0.88rem' }}>{t.name}</td>
                          <td style={{ textAlign: 'right', padding: '11px 0', color: 'var(--text)', fontSize: '0.88rem', fontWeight: 600 }}>{t.count}</td>
                          <td style={{ textAlign: 'right', padding: '11px 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>{t.revenue.toFixed(0)} €</td>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <p style={{ color: 'var(--text)', fontWeight: 700 }}>Bewertungen ({ratings.length})</p>
              {avgStars != null && (
                <span style={{
                  background: avgStars >= 4 ? '#10b98118' : '#ef444418',
                  color: avgStars >= 4 ? '#10b981' : '#f87171',
                  borderRadius: '6px', padding: '3px 10px', fontSize: '0.8rem', fontWeight: 700,
                }}>
                  {avgStars.toFixed(1)} ⭐ Ø
                </span>
              )}
            </div>
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

        {/* Benchmark */}
        {benchmark && !benchmark.opted_out && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <p style={{ color: 'var(--text)', fontWeight: 700 }}>📊 Branchenvergleich (letzte 7 Tage)</p>
              {benchmark.peer && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{benchmark.peer.poolSize} Restaurants im Pool</span>
              )}
            </div>
            {benchmark.insufficient_pool ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Noch zu wenig Daten im Pool — mindestens 5 Restaurants nötig.</p>
            ) : benchmark.peer ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 180px), 1fr))', gap: '12px' }}>
                {[
                  { label: 'Ø Tagesumsatz', own: benchmark.own.avgRevenue, peer: benchmark.peer.avgRevenue, unit: '€' },
                  { label: 'Bestellungen / Tag', own: benchmark.own.avgOrders, peer: benchmark.peer.avgOrders, unit: '' },
                  { label: 'Ø Bestellwert', own: benchmark.own.avgOrderValue, peer: benchmark.peer.avgOrderValue, unit: '€' },
                ].map(metric => {
                  const diff = metric.own != null && metric.peer != null && metric.peer > 0
                    ? ((metric.own - metric.peer) / metric.peer) * 100 : null
                  return (
                    <div key={metric.label} style={{ background: 'var(--bg)', borderRadius: '12px', padding: '12px 14px', border: '1px solid var(--border)' }}>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>{metric.label}</p>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.3rem' }}>
                          {metric.own != null ? `${metric.own.toFixed(0)}${metric.unit}` : '—'}
                        </span>
                        {diff != null && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: diff >= 0 ? '#22c55e' : '#ef4444', marginBottom: '3px' }}>
                            {diff >= 0 ? `+${diff.toFixed(0)}%` : `${diff.toFixed(0)}%`}
                          </span>
                        )}
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        Branche: {metric.peer != null ? `${metric.peer.toFixed(0)}${metric.unit}` : '—'}
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Noch keine Snapshot-Daten — werden täglich um 00:00 erfasst.</p>
            )}
          </div>
        )}

        {/* Vorbereitungsplan */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <p style={{ color: 'var(--text)', fontWeight: 700 }}>🍳 Vorbereitungsplan — Heute</p>
              {!prepPlan && <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>Noch kein Plan für heute generiert.</p>}
            </div>
            <button
              onClick={generatePrepPlan}
              disabled={prepLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: prepGenerated ? '#10b98118' : 'var(--bg)', color: prepGenerated ? '#10b981' : 'var(--text)', fontWeight: 600, fontSize: '0.8rem', cursor: prepLoading ? 'wait' : 'pointer' }}
            >
              {prepLoading ? '⏳ Generiere…' : prepGenerated ? '✓ Aktualisiert' : prepPlan ? '↻ Neu generieren' : '✨ Plan erstellen'}
            </button>
          </div>
          {prepPlan && (
            <>
              {prepPlan.insight && (
                <div style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border-accent)', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '0.85rem', color: 'var(--text)' }}>
                  💡 {prepPlan.insight}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '12px' }}>
                {prepPlan.shifts.map((shift, si) => (
                  <div key={si} style={{ background: 'var(--bg)', borderRadius: '12px', padding: '12px 14px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.9rem' }}>{shift.name}</p>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{shift.time}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {shift.items.map((item, ii) => (
                        <div key={ii} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ color: 'var(--text)', fontSize: '0.85rem', flex: 1 }}>{item.name}</span>
                          <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{item.qty}×</span>
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, background: item.confidence === 'Sicher' ? '#10b98118' : '#f59e0b18', color: item.confidence === 'Sicher' ? '#10b981' : '#f59e0b', whiteSpace: 'nowrap' }}>
                            {item.confidence}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

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
    <div style={{ background: 'var(--surface)', border: `1px solid ${warn ? '#ef444428' : 'var(--border)'}`, borderRadius: '14px', padding: '14px 16px' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>{label}</p>
      <p style={{ color: warn ? '#f87171' : accent ? 'var(--accent)' : 'var(--text)', fontWeight: 700, fontSize: '1.35rem', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ color: warn ? '#f87171' : 'var(--text-muted)', fontSize: '0.65rem', marginTop: '4px' }}>{sub}</p>}
    </div>
  )
}
