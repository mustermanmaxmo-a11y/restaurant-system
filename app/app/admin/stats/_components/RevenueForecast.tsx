'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TrendingUp, RefreshCw, AlertCircle } from 'lucide-react'
import type { ForecastDay } from '@/app/api/ai/revenue-forecast/route'

interface Props { restaurantId: string }

const CONFIDENCE_COLORS = {
  high: '#10b981',
  medium: '#f59e0b',
  low: '#6b7280',
}

const CONFIDENCE_LABELS = {
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
}

export default function RevenueForecast({ restaurantId }: Props) {
  const [loading, setLoading] = useState(false)
  const [forecast, setForecast] = useState<ForecastDay[] | null>(null)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/ai/revenue-forecast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ restaurantId }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Fehler'); return }
      setForecast(json.forecast)
    } catch {
      setError('Prognose momentan nicht verfügbar')
    } finally {
      setLoading(false)
    }
  }

  const maxRevenue = forecast ? Math.max(...forecast.map(d => d.predictedRevenue), 1) : 1

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '16px', padding: '24px', marginTop: '24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TrendingUp size={18} color="var(--accent)" />
          </div>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem', margin: 0 }}>
            Umsatzprognose — Nächste 7 Tage
          </h2>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '10px', border: '1.5px solid var(--accent)',
            background: 'var(--accent-subtle)', color: 'var(--accent)',
            fontWeight: 600, fontSize: '0.85rem', cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Berechne...' : forecast ? 'Aktualisieren' : 'Prognose erstellen'}
        </button>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '0.85rem', marginBottom: '12px' }}>
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {!forecast && !loading && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '24px 0' }}>
          Klicke auf &quot;Prognose erstellen&quot; für eine KI-Prognose der nächsten 7 Tage.
        </p>
      )}

      {forecast && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {forecast.map(day => (
            <div key={day.date} style={{
              display: 'grid', gridTemplateColumns: '100px 1fr auto',
              alignItems: 'center', gap: '12px',
            }}>
              <div>
                <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.85rem', margin: 0 }}>{day.dayName}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', margin: 0 }}>{day.date}</p>
              </div>
              <div style={{ position: 'relative', height: '28px', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  height: '8px', borderRadius: '4px',
                  width: `${Math.round((day.predictedRevenue / maxRevenue) * 100)}%`,
                  background: CONFIDENCE_COLORS[day.confidence],
                  minWidth: '4px',
                  transition: 'width 0.4s ease',
                }} />
                {Math.round((day.predictedRevenue / maxRevenue) * 100) < 80 && (
                  <p style={{
                    position: 'absolute', left: `calc(${Math.round((day.predictedRevenue / maxRevenue) * 100)}% + 8px)`,
                    top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    maxWidth: `calc(${100 - Math.round((day.predictedRevenue / maxRevenue) * 100)}% - 12px)`,
                  }}>
                    {day.note}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>
                  €{day.predictedRevenue.toFixed(0)}
                </p>
                <p style={{ color: CONFIDENCE_COLORS[day.confidence], fontSize: '0.7rem', margin: 0, fontWeight: 600 }}>
                  {CONFIDENCE_LABELS[day.confidence]}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
