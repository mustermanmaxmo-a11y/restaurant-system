'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Restaurant } from '@/types/database'
import { useLanguage } from '@/components/providers/language-provider'
import { Check, Clock } from 'lucide-react'

type DayHours = { open: string; close: string; closed: boolean }
type Hours = Record<string, DayHours>

const DEFAULT_HOURS: Hours = Object.fromEntries(
  ['0','1','2','3','4','5','6'].map(k => [k, { open: '11:00', close: '22:00', closed: false }])
)

export default function OpeningHoursPage() {
  const router = useRouter()
  const { t } = useLanguage()

  const DAYS = [
    { key: '0', label: t('days.mon') },
    { key: '1', label: t('days.tue') },
    { key: '2', label: t('days.wed') },
    { key: '3', label: t('days.thu') },
    { key: '4', label: t('days.fri') },
    { key: '5', label: t('days.sat') },
    { key: '6', label: t('days.sun') },
  ]

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [hours, setHours] = useState<Hours>(DEFAULT_HOURS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }
      const { data: resto } = await supabase.from('restaurants').select('*').eq('owner_id', session.user.id).limit(1).single()
      if (!resto) { router.push('/admin/setup'); return }
      setRestaurant(resto)
      if (resto.opening_hours) {
        setHours({ ...DEFAULT_HOURS, ...resto.opening_hours })
      }
      setLoading(false)
    }
    load()
  }, [router])

  function update(day: string, field: keyof DayHours, value: string | boolean) {
    setHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
    setSaved(false)
  }

  function copyToAll(sourceKey: string) {
    const source = hours[sourceKey]
    setHours(Object.fromEntries(DAYS.map(d => [d.key, { ...source }])))
    setSaved(false)
  }

  async function save() {
    if (!restaurant) return
    setSaving(true)
    await supabase.from('restaurants').update({ opening_hours: hours }).eq('id', restaurant.id)
    setSaving(false)
    setSaved(true)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
    </div>
  )

  const openDays = DAYS.filter(d => !hours[d.key]?.closed).length

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
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#a78bfa18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Clock size={18} color="#a78bfa" />
          </div>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1 }}>Öffnungszeiten</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1px' }}>{openDays} von 7 Tagen geöffnet</p>
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: saved ? '#10b981' : 'var(--accent)',
            border: 'none', borderRadius: '9px', padding: '8px 16px',
            color: '#fff', fontWeight: 700, fontSize: '0.82rem',
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            transition: 'background 0.2s',
          }}
        >
          {saved ? <><Check size={14} /> Gespeichert</> : saving ? 'Speichert…' : t('common.save')}
        </button>
      </div>

      <div style={{ padding: '16px 20px 40px', maxWidth: '640px', margin: '0 auto' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', marginBottom: '20px' }}>
          Gäste können außerhalb dieser Zeiten nicht bestellen oder reservieren.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {DAYS.map(day => {
            const dh = hours[day.key]
            return (
              <div key={day.key} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '12px', padding: '14px 16px',
                opacity: dh.closed ? 0.6 : 1,
                transition: 'opacity 0.2s',
              }}>
                {/* Top row: day name + toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: dh.closed ? 0 : '10px' }}>
                  <p style={{
                    color: 'var(--text)', fontWeight: 700, fontSize: '0.9rem',
                    textDecoration: dh.closed ? 'line-through' : 'none',
                  }}>
                    {day.label}
                  </p>
                  <button
                    onClick={() => update(day.key, 'closed', !dh.closed)}
                    style={{
                      padding: '4px 12px', borderRadius: '20px', border: 'none',
                      cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
                      background: dh.closed ? '#ef444418' : '#10b98118',
                      color: dh.closed ? '#ef4444' : '#10b981',
                    }}
                  >
                    {dh.closed ? 'Geschlossen' : 'Geöffnet'}
                  </button>
                </div>

                {/* Time inputs — wrap on mobile */}
                {!dh.closed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="time" value={dh.open}
                      onChange={e => update(day.key, 'open', e.target.value)}
                      style={{
                        padding: '8px 10px', borderRadius: '8px',
                        border: '1px solid var(--border)', background: 'var(--bg)',
                        color: 'var(--text)', fontSize: '0.9rem', outline: 'none',
                        minHeight: '40px', flex: 1, minWidth: '100px',
                      }}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', flexShrink: 0 }}>bis</span>
                    <input
                      type="time" value={dh.close}
                      onChange={e => update(day.key, 'close', e.target.value)}
                      style={{
                        padding: '8px 10px', borderRadius: '8px',
                        border: '1px solid var(--border)', background: 'var(--bg)',
                        color: 'var(--text)', fontSize: '0.9rem', outline: 'none',
                        minHeight: '40px', flex: 1, minWidth: '100px',
                      }}
                    />
                    <button
                      onClick={() => copyToAll(day.key)}
                      title="Diese Zeiten auf alle Tage übertragen"
                      style={{
                        background: 'none', border: '1px solid var(--border)',
                        borderRadius: '7px', padding: '6px 10px',
                        color: 'var(--text-muted)', fontSize: '0.72rem',
                        cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                      }}
                    >
                      Für alle
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
