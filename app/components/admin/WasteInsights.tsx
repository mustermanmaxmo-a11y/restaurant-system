'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Sparkles, TrendingDown, Lightbulb, RefreshCw } from 'lucide-react'

interface Insight {
  title: string
  description: string
  action: string
  savings: number
  ingredient: string
}

interface WasteAnalysis {
  total_waste_cost: number
  potential_savings: number
  insights: Insight[]
  summary?: string
}

interface Props {
  restaurantId: string
}

export default function WasteInsights({ restaurantId }: Props) {
  const [analysis, setAnalysis] = useState<WasteAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadAnalysis() {
    setLoading(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Nicht angemeldet.'); setLoading(false); return }

    const res = await fetch('/api/ai/waste-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ restaurantId }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Fehler bei der Analyse.')
    } else {
      setAnalysis(data)
    }
    setLoading(false)
  }

  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="var(--accent)" />
          <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.95rem' }}>KI-Verlustanalyse</h3>
        </div>
        <button
          onClick={loadAnalysis}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '10px', border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontWeight: 600, fontSize: '0.8rem', cursor: loading ? 'wait' : 'pointer' }}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Analysiere…' : analysis ? 'Neu analysieren' : 'Analysieren'}
        </button>
      </div>

      {error && (
        <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '12px' }}>{error}</p>
      )}

      {analysis?.summary && !analysis.insights?.length && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{analysis.summary}</p>
      )}

      {analysis && analysis.insights?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Summary row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '4px' }}>
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <TrendingDown size={14} color="#ef4444" />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>GESAMTVERLUSTE</span>
              </div>
              <p style={{ color: '#ef4444', fontWeight: 800, fontSize: '1.2rem' }}>{analysis.total_waste_cost.toFixed(2)} €</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>letzte 90 Tage</p>
            </div>
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Lightbulb size={14} color="#22c55e" />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>EINSPARPOTENZIAL</span>
              </div>
              <p style={{ color: '#22c55e', fontWeight: 800, fontSize: '1.2rem' }}>{analysis.potential_savings.toFixed(2)} €</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>wenn alle Empfehlungen umgesetzt</p>
            </div>
          </div>

          {/* Insight cards */}
          {analysis.insights.map((insight, i) => (
            <div key={i} style={{ background: 'var(--surface-2, rgba(255,255,255,0.03))', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div>
                  <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>{insight.title}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{insight.ingredient}</p>
                </div>
                {insight.savings > 0 && (
                  <span style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                    ~{insight.savings.toFixed(0)} € sparen
                  </span>
                )}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '8px', lineHeight: 1.5 }}>{insight.description}</p>
              <div style={{ background: 'rgba(234,88,12,0.06)', border: '1px solid rgba(234,88,12,0.15)', borderRadius: '8px', padding: '8px 12px' }}>
                <p style={{ color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600 }}>💡 {insight.action}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!analysis && !loading && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
          Klicke &quot;Analysieren&quot; um KI-Empfehlungen zu deinen Verlusten zu erhalten.
        </p>
      )}
    </div>
  )
}
