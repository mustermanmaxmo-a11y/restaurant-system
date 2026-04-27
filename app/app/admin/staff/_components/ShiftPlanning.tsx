'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, Printer, Save, AlertCircle, Sparkles } from 'lucide-react'
import type { ShiftDay, ShiftPlan } from '@/types/database'

interface Props {
  restaurantId: string
}

export default function ShiftPlanning({ restaurantId }: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [days, setDays] = useState<ShiftDay[] | null>(null)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [error, setError] = useState('')

  const loadLatest = useCallback(async () => {
    const { data } = await supabase
      .from('shift_plans')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      setDays((data as ShiftPlan).plan)
      setLastSaved((data as ShiftPlan).created_at)
    }
  }, [restaurantId])

  useEffect(() => { loadLatest() }, [loadLatest])

  async function generate() {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/ai/staff-planning', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ restaurantId }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Fehler'); return }
      setDays(json.days)
      setLastSaved(null)
    } catch {
      setError('Plan konnte nicht generiert werden.')
    } finally {
      setLoading(false)
    }
  }

  async function savePlan() {
    if (!days) return
    setSaving(true)
    const weekStart = days[0]?.date ?? new Date().toISOString().split('T')[0]
    const { error: err } = await supabase
      .from('shift_plans')
      .insert({ restaurant_id: restaurantId, week_start: weekStart, plan: days })
    if (err) {
      alert('Speichern fehlgeschlagen.')
    } else {
      setLastSaved(new Date().toISOString())
    }
    setSaving(false)
  }

  function updateCount(dayIdx: number, shiftIdx: number, field: 'kitchen' | 'waiter', delta: number) {
    if (!days) return
    setDays(prev => prev!.map((day, di) =>
      di !== dayIdx ? day : {
        ...day,
        shifts: day.shifts.map((shift, si) =>
          si !== shiftIdx ? shift : {
            ...shift,
            [field]: Math.max(1, shift[field] + delta),
          }
        ),
      }
    ))
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '20px', flexWrap: 'wrap', gap: '10px',
      }}>
        <div>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.05rem', margin: 0 }}>
            KI-Schichtplanung
          </h2>
          {lastSaved && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '2px 0 0' }}>
              Gespeichert: {new Date(lastSaved).toLocaleDateString('de-DE')}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {days && (
            <>
              <button
                onClick={() => window.print()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '10px',
                  border: '1.5px solid var(--border)', background: 'transparent',
                  color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                }}
              >
                <Printer size={14} />
                Drucken
              </button>
              <button
                onClick={savePlan}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '10px',
                  border: '1.5px solid var(--accent)', background: 'var(--accent-subtle)',
                  color: 'var(--accent)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <Save size={14} />
                {saving ? 'Speichert...' : 'Plan speichern'}
              </button>
            </>
          )}
          <button
            onClick={generate}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '10px', border: 'none',
              background: 'var(--accent)', color: 'var(--accent-text)',
              fontWeight: 600, fontSize: '0.82rem', cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            <Sparkles size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Analysiere...' : days ? 'Neu generieren' : 'Plan generieren'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '0.85rem', marginBottom: '16px' }}>
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {!days && !loading && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '48px 24px', textAlign: 'center',
        }}>
          <Users size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px', display: 'block' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0, maxWidth: '400px', marginInline: 'auto' }}>
            Klicke auf &quot;Plan generieren&quot; — die KI analysiert die Auslastung der letzten 4 Wochen und erstellt einen optimalen Schichtplan für die nächsten 7 Tage.
          </p>
        </div>
      )}

      {days && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} id="shift-plan-print">
          {days.map((day, di) => (
            <div key={day.date} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '14px', overflow: 'hidden',
            }}>
              <div style={{
                padding: '10px 16px',
                background: 'var(--accent-subtle)',
                borderBottom: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <p style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>
                  {day.day}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>{day.date}</p>
              </div>

              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {day.shifts.map((shift, si) => (
                  <div key={si} style={{
                    display: 'grid', gridTemplateColumns: '100px 1fr',
                    gap: '12px', alignItems: 'start',
                    paddingBottom: si < day.shifts.length - 1 ? '12px' : 0,
                    borderBottom: si < day.shifts.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.82rem', margin: 0 }}>
                      {shift.start}–{shift.end}
                    </p>
                    <div>
                      <div style={{ display: 'flex', gap: '20px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <Counter
                          label="Köche"
                          value={shift.kitchen}
                          onIncrement={() => updateCount(di, si, 'kitchen', 1)}
                          onDecrement={() => updateCount(di, si, 'kitchen', -1)}
                        />
                        <Counter
                          label="Service"
                          value={shift.waiter}
                          onIncrement={() => updateCount(di, si, 'waiter', 1)}
                          onDecrement={() => updateCount(di, si, 'waiter', -1)}
                        />
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>{shift.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media print {
          body > * { visibility: hidden; }
          #shift-plan-print, #shift-plan-print * { visibility: visible; }
          #shift-plan-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  )
}

function Counter({
  label,
  value,
  onIncrement,
  onDecrement,
}: {
  label: string
  value: number
  onIncrement: () => void
  onDecrement: () => void
}) {
  const btnStyle: React.CSSProperties = {
    width: '22px', height: '22px', borderRadius: '5px',
    border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--text)', fontSize: '1rem', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, lineHeight: 1,
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', minWidth: '46px' }}>{label}:</span>
      <button onClick={onDecrement} style={btnStyle}>−</button>
      <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.85rem', minWidth: '18px', textAlign: 'center' }}>
        {value}
      </span>
      <button onClick={onIncrement} style={btnStyle}>+</button>
    </div>
  )
}
