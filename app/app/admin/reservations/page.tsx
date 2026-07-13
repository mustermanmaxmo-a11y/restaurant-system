'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Reservation, Restaurant, Table, RestaurantPlan } from '@/types/database'
import { useLanguage } from '@/components/providers/language-provider'
import { getPlanLimits } from '@/lib/plan-limits'
import { UpgradeHint } from '@/components/UpgradeHint'
import { CalendarDays, Users, Phone, Armchair, Check, X, Mail } from 'lucide-react'

type Filter = 'today' | 'tomorrow' | 'week'

const STATUS_META: Record<string, { bg: string; color: string; border: string; label: string }> = {
  pending:   { bg: '#f59e0b18', color: '#f59e0b', border: '#f59e0b33', label: 'Ausstehend' },
  confirmed: { bg: '#10b98118', color: '#10b981', border: '#10b98133', label: 'Bestätigt' },
  cancelled: { bg: '#ef444418', color: '#ef4444', border: '#ef444433', label: 'Abgesagt' },
}

export default function ReservationsPage() {
  const router = useRouter()
  const { t } = useLanguage()
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

    let query = supabase.from('reservations').select('*')
      .eq('restaurant_id', restaurant.id)
      .order('date', { ascending: true })
      .order('time_from', { ascending: true })

    if (filter === 'today') query = query.eq('date', todayStr)
    else if (filter === 'tomorrow') query = query.eq('date', tomorrowStr)
    else query = query.gte('date', todayStr).lte('date', weekStr)

    const { data } = await query
    setReservations((data as Reservation[]) || [])
  }

  async function updateStatus(id: string, status: 'confirmed' | 'cancelled') {
    setUpdating(id)
    await supabase.from('reservations').update({ status }).eq('id', id)
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    setUpdating(null)
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

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'today', label: 'Heute' },
    { key: 'tomorrow', label: 'Morgen' },
    { key: 'week', label: '7 Tage' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Page header */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '14px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10,
        flexWrap: 'wrap', gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#60a5fa18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CalendarDays size={18} color="#60a5fa" />
          </div>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1 }}>Reservierungen</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1px' }}>{reservations.length} im gewählten Zeitraum</p>
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '6px 14px', borderRadius: '20px', border: '1.5px solid',
                borderColor: filter === f.key ? '#60a5fa' : 'var(--border)',
                background: filter === f.key ? '#60a5fa18' : 'transparent',
                color: filter === f.key ? '#60a5fa' : 'var(--text-muted)',
                fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 20px 40px', maxWidth: '720px', margin: '0 auto' }}>
        {reservations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#60a5fa18', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CalendarDays size={28} color="#60a5fa" />
            </div>
            <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '6px' }}>Keine Reservierungen</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>im gewählten Zeitraum</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date} style={{ marginBottom: '28px' }}>
              <p style={{
                color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px',
              }}>
                {new Date(date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {items.map(res => {
                  const st = STATUS_META[res.status] ?? STATUS_META.pending
                  const assignedTable = tables.find(t => t.id === res.table_id)
                  return (
                    <div key={res.id} style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: '12px', padding: '14px 16px',
                    }}>
                      {/* Top row: time + name + status */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <div style={{
                          minWidth: '52px', textAlign: 'center',
                          background: 'var(--bg)', borderRadius: '8px', padding: '6px 8px', flexShrink: 0,
                        }}>
                          <p style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1rem', lineHeight: 1 }}>{res.time_from.slice(0, 5)}</p>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.62rem', marginTop: '2px' }}>Uhr</p>
                        </div>

                        <div style={{ flex: 1, minWidth: '140px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                            <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.95rem' }}>{res.customer_name}</p>
                            <span style={{
                              background: st.bg, color: st.color,
                              border: `1px solid ${st.border}`,
                              fontSize: '0.68rem', fontWeight: 700,
                              padding: '2px 8px', borderRadius: '20px',
                            }}>{st.label}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Users size={11} /> {res.guests} Personen</span>
                            {res.customer_phone && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Phone size={11} /> {res.customer_phone}</span>}
                            {res.customer_email && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Mail size={11} /> {res.customer_email}</span>}
                            {assignedTable && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Armchair size={11} /> {assignedTable.label}</span>}
                          </div>
                          {res.note && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.76rem', marginTop: '5px', fontStyle: 'italic' }}>„{res.note}&quot;</p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      {res.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                          <button
                            onClick={() => updateStatus(res.id, 'confirmed')}
                            disabled={updating === res.id}
                            style={{
                              flex: 1, minWidth: '100px', padding: '8px 14px', borderRadius: '8px',
                              border: 'none', background: '#10b981', color: '#fff',
                              fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                              opacity: updating === res.id ? 0.6 : 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                            }}
                          >
                            <Check size={13} /> Bestätigen
                          </button>
                          <button
                            onClick={() => updateStatus(res.id, 'cancelled')}
                            disabled={updating === res.id}
                            style={{
                              flex: 1, minWidth: '80px', padding: '8px 14px', borderRadius: '8px',
                              border: '1px solid var(--border)', background: 'transparent', color: '#ef4444',
                              fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                              opacity: updating === res.id ? 0.6 : 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                            }}
                          >
                            <X size={13} /> Absagen
                          </button>
                        </div>
                      )}
                      {res.status === 'confirmed' && (
                        <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                          <button
                            onClick={() => updateStatus(res.id, 'cancelled')}
                            disabled={updating === res.id}
                            style={{
                              padding: '6px 12px', borderRadius: '8px',
                              border: '1px solid var(--border)', background: 'transparent',
                              color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer',
                            }}
                          >
                            Absagen
                          </button>
                        </div>
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
