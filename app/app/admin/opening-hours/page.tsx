'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Restaurant } from '@/types/database'
import { useLanguage } from '@/components/providers/language-provider'

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
    setHours(prev => Object.fromEntries(DAYS.map(d => [d.key, { ...source }])))
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '1.2rem' }}>←</button>
          <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>Öffnungszeiten</h1>
        </div>
        <button
          onClick={save}
          disabled={saving}
          style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '8px 20px', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? '...' : saved ? '✓' : t('common.save')}
        </button>
      </div>

      <div style={{ padding: '24px', maxWidth: '640px', margin: '0 auto' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '24px' }}>
          Gäste können außerhalb der Öffnungszeiten nicht bestellen oder reservieren.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {DAYS.map(day => {
            const dh = hours[day.key]
            return (
              <div
                key={day.key}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
                  padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
                  opacity: dh.closed ? 0.6 : 1,
                }}
              >
                {/* Day label */}
                <div style={{ minWidth: '100px' }}>
                  <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.9rem' }}>{day.label}</p>
                </div>

                {/* Closed toggle */}
                <button
                  onClick={() => update(day.key, 'closed', !dh.closed)}
                  style={{
                    padding: '5px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                    background: dh.closed ? '#ef444422' : '#10b98122',
                    color: dh.closed ? '#ef4444' : '#10b981',
                  }}
                >
                  {dh.closed ? 'Geschlossen' : 'Geöffnet'}
                </button>

                {/* Time inputs */}
                {!dh.closed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <input
                      type="time"
                      value={dh.open}
                      onChange={e => update(day.key, 'open', e.target.value)}
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', minHeight: '44px' }}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>bis</span>
                    <input
                      type="time"
                      value={dh.close}
                      onChange={e => update(day.key, 'close', e.target.value)}
                      style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', minHeight: '44px' }}
                    />
                    <button
                      onClick={() => copyToAll(day.key)}
                      title="Diese Zeiten auf alle Tage übertragen"
                      style={{ marginLeft: '4px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', color: 'var(--text-muted)', fontSize: '0.7rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
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
