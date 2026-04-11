'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Reservation, Restaurant, Table, RestaurantPlan } from '@/types/database'
import { useLanguage } from '@/components/providers/language-provider'
import { getPlanLimits } from '@/lib/plan-limits'
import { UpgradeHint } from '@/components/UpgradeHint'
import { CalendarDays, Users, Phone, Armchair, Check, X } from 'lucide-react'

type Filter = 'today' | 'tomorrow' | 'week'

export default function ReservationsPage() {
  const router = useRouter()
  const { t } = useLanguage()

  const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
    pending:   { bg: '#fffbeb', color: '#f59e0b', label: 'Ausstehend' },
    confirmed: { bg: '#ecfdf5', color: '#10b981', label: 'Bestätigt' },
    cancelled: { bg: '#fef2f2', color: '#ef4444', label: t('order.status.cancelled') },
  }
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('today')
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }
      const { data: resto } = await supabase.from('restaurants').select('*').eq('owner_id', session.user.id).limit(1).single()
      if (!resto) { router.push('/admin/setup'); return }
      setRestaurant(resto)
      const { data: tablesData } = await supabase.from('tables').select('id, label').eq('restaurant_id', resto.id)
      setTables((tablesData as Table[]) || [])
      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    if (!restaurant) return
    loadReservations()
  }, [restaurant, filter])

  async function loadReservations() {
    if (!restaurant) return
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().split('T')[0]
    const weekStr = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0]

    let query = supabase
      .from('reservations')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('date', { ascending: true })
      .order('time_from', { ascending: true })

    if (filter === 'today') {
      query = query.eq('date', todayStr)
    } else if (filter === 'tomorrow') {
      query = query.eq('date', tomorrowStr)
    } else {
      query = query.gte('date', todayStr).lte('date', weekStr)
    }

    const { data } = await query
    setReservations((data as Reservation[]) || [])
  }

  async function updateStatus(id: string, status: 'confirmed' | 'cancelled') {
    setUpdating(id)
    await supabase.from('reservations').update({ status }).eq('id', id)
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    setUpdating(null)

    // Email is sent server-side via Supabase Edge Function (Database Webhook)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
    </div>
  )

  const limits = getPlanLimits((restaurant?.plan ?? 'starter') as RestaurantPlan)

  if (!limits.hasReservations) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px' }}>
        <div style={{ maxWidth: '600px', margin: '80px auto' }}>
          <UpgradeHint feature="Reservierungen" />
        </div>
      </div>
    )
  }

  const grouped: Record<string, Reservation[]> = {}
  reservations.forEach(r => {
    if (!grouped[r.date]) grouped[r.date] = []
    grouped[r.date].push(r)
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '1.2rem' }}>←</button>
          <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>Reservierungen</h1>
        </div>
        {/* Filter */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['today', 'tomorrow', 'week'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px', borderRadius: '8px', border: '1.5px solid',
                borderColor: filter === f ? 'var(--accent)' : 'var(--border)',
                background: filter === f ? 'var(--accent-subtle)' : 'transparent',
                color: filter === f ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
              }}
            >
              {f === 'today' ? 'Heute' : f === 'tomorrow' ? 'Morgen' : '7 Tage'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '700px', margin: '0 auto' }}>
        {reservations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}><CalendarDays size={48} color="var(--text-muted)" /></div>
            <p style={{ color: 'var(--text-muted)' }}>Keine Reservierungen im gewählten Zeitraum.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date} style={{ marginBottom: '32px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                {new Date(date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {items.map(res => {
                  const st = STATUS_COLORS[res.status] ?? STATUS_COLORS.pending
                  return (
                    <div
                      key={res.id}
                      style={{
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: '12px', padding: '16px 20px',
                        display: 'flex', alignItems: 'center', gap: '16px',
                        flexWrap: 'wrap',
                      }}
                    >
                      {/* Time */}
                      <div style={{ minWidth: '52px', textAlign: 'center' }}>
                        <p style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1rem' }}>{res.time_from.slice(0, 5)}</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Uhr</p>
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: '180px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                          <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.95rem' }}>{res.customer_name}</p>
                          <span style={{ background: st.bg, color: st.color, fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px' }}>{st.label}</span>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                          <Users size={12} /> {res.guests} Personen · <Phone size={12} /> {res.customer_phone}
                          {res.customer_email && ` · ${res.customer_email}`}
                          {res.table_id && <><Armchair size={12} /> {tables.find(t => t.id === res.table_id)?.label ?? 'Tisch'}</>}
                        </p>
                        {res.note && (
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '4px', fontStyle: 'italic' }}>
                            „{res.note}"
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      {res.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                          <button
                            onClick={() => updateStatus(res.id, 'confirmed')}
                            disabled={updating === res.id}
                            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', opacity: updating === res.id ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '5px' }}
                          >
                            <Check size={13} /> Bestätigen
                          </button>
                          <button
                            onClick={() => updateStatus(res.id, 'cancelled')}
                            disabled={updating === res.id}
                            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: '#ef4444', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', opacity: updating === res.id ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '5px' }}
                          >
                            <X size={13} /> Absagen
                          </button>
                        </div>
                      )}
                      {res.status === 'confirmed' && (
                        <button
                          onClick={() => updateStatus(res.id, 'cancelled')}
                          disabled={updating === res.id}
                          style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          Absagen
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
