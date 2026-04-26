'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart2, Sparkles, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'

interface ReportItem { name: string; count: number }

interface WeeklyReportData {
  totalRevenue: number
  prevRevenue: number
  revenueChangePct: string | null
  orderCount: number
  top5: ReportItem[]
  bottom5: ReportItem[]
  recommendations: string[]
  generatedAt: string
}

interface Props {
  restaurantId: string
}

export default function WeeklyReport({ restaurantId }: Props) {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<WeeklyReportData | null>(null)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/ai/weekly-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ restaurantId }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Fehler'); return }
      setReport(json)
    } catch {
      setError('Analyse momentan nicht verfügbar')
    } finally {
      setLoading(false)
    }
  }

  const changeNum = report?.revenueChangePct ? parseFloat(report.revenueChangePct) : null
  const changePositive = changeNum != null && changeNum >= 0

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      padding: '24px',
      marginTop: '24px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BarChart2 size={18} color="var(--accent)" />
          </div>
          <div>
            <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem', margin: 0 }}>KI-Wochenbericht</h2>
            {report && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>
                Generiert: {new Date(report.generatedAt).toLocaleString('de-DE')}
              </p>
            )}
          </div>
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
          {loading ? 'Analysiere...' : report ? 'Aktualisieren' : 'Bericht erstellen'}
        </button>
      </div>

      {error && (
        <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '12px' }}>{error}</p>
      )}

      {!report && !loading && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '24px 0' }}>
          Klicke auf &quot;Bericht erstellen&quot; für eine KI-Analyse der letzten 7 Tage.
        </p>
      )}

      {report && (
        <>
          {/* Revenue row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Umsatz diese Woche', value: `€${report.totalRevenue.toFixed(2)}` },
              { label: 'Vorwoche', value: `€${report.prevRevenue.toFixed(2)}` },
              {
                label: 'Veränderung',
                value: changeNum != null
                  ? `${changePositive ? '+' : ''}${report.revenueChangePct}%`
                  : '—',
                color: changeNum != null ? (changePositive ? '#10b981' : '#ef4444') : 'var(--text-muted)',
                icon: changeNum != null ? (changePositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />) : null,
              },
            ].map(card => (
              <div key={card.label} style={{
                background: 'var(--bg)', borderRadius: '10px', padding: '14px',
                border: '1px solid var(--border)',
              }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '0 0 4px' }}>{card.label}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {card.icon && <span style={{ color: card.color }}>{card.icon}</span>}
                  <p style={{ color: card.color ?? 'var(--text)', fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>
                    {card.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Top / Bottom */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            {[
              { title: 'Top-Gerichte', items: report.top5, color: '#10b981' },
              { title: 'Schwächste Gerichte', items: report.bottom5, color: '#f59e0b' },
            ].map(section => (
              <div key={section.title}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px' }}>
                  {section.title}
                </p>
                {section.items.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Keine Daten</p>
                ) : (
                  section.items.map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '6px 0', borderBottom: '1px solid var(--border)',
                    }}>
                      <span style={{ color: 'var(--text)', fontSize: '0.85rem' }}>{item.name}</span>
                      <span style={{ color: section.color, fontWeight: 600, fontSize: '0.85rem' }}>{item.count}x</span>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <div style={{ background: 'var(--accent-subtle)', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <Sparkles size={16} color="var(--accent)" />
                <p style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.85rem', margin: 0 }}>
                  KI-Empfehlungen
                </p>
              </div>
              {report.recommendations.map((rec, i) => (
                <div key={i} style={{
                  display: 'flex', gap: '8px', marginBottom: i < report.recommendations.length - 1 ? '8px' : 0,
                }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                    {i + 1}.
                  </span>
                  <p style={{ color: 'var(--text)', fontSize: '0.85rem', margin: 0 }}>{rec}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
