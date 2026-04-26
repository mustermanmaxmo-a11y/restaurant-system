'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart2, RefreshCw, X, Sparkles } from 'lucide-react'
import type { MenuItem } from '@/types/database'
import type { ProfitabilityResponse, ProfitabilityResult } from '@/app/api/ai/menu-profitability/route'

interface Props {
  restaurantId: string
  items: MenuItem[]
  onClose: () => void
}

const STATUS_CONFIG = {
  green:  { color: '#10b981', bg: '#10b98115', label: 'Profitabel', emoji: '🟢' },
  yellow: { color: '#f59e0b', bg: '#f59e0b15', label: 'Optimierbar', emoji: '🟡' },
  red:    { color: '#ef4444', bg: '#ef444415', label: 'Streichkandidat', emoji: '🔴' },
}

export default function ProfitabilityPanel({ restaurantId, items, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ProfitabilityResponse | null>(null)
  const [error, setError] = useState('')

  async function analyze() {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/ai/menu-profitability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ restaurantId }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Fehler'); return }
      setResult(json)
    } catch {
      setError('Analyse momentan nicht verfügbar')
    } finally {
      setLoading(false)
    }
  }

  const itemMap = Object.fromEntries(items.map(i => [i.id, i.name]))

  const grouped = result ? {
    green:  result.items.filter(i => i.status === 'green'),
    yellow: result.items.filter(i => i.status === 'yellow'),
    red:    result.items.filter(i => i.status === 'red'),
  } : null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '16px',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: '20px',
        width: '100%', maxWidth: '640px', maxHeight: '85vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart2 size={20} color="var(--accent)" />
            <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.05rem', margin: 0 }}>
              Menü-Profitabilität
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <X size={20} color="var(--text-muted)" />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {!result && (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: 1.5 }}>
                Die KI analysiert Bestellhäufigkeit und Zutatenkosten deiner Gerichte und gibt eine Ampel-Bewertung.
              </p>
              {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>}
              <button
                onClick={analyze}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '12px 24px', borderRadius: '12px', border: 'none',
                  background: 'var(--accent)', color: 'var(--accent-text)',
                  fontWeight: 700, fontSize: '0.9rem', cursor: loading ? 'wait' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                {loading ? 'Analysiere...' : 'Jetzt analysieren'}
              </button>
            </>
          )}

          {result && grouped && (
            <>
              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                <div style={{ background: 'var(--accent-subtle)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                    <Sparkles size={14} color="var(--accent)" />
                    <p style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.85rem', margin: 0 }}>KI-Empfehlungen</p>
                  </div>
                  {result.recommendations.map((r, i) => (
                    <p key={i} style={{ color: 'var(--text)', fontSize: '0.85rem', margin: '0 0 6px' }}>
                      {i + 1}. {r}
                    </p>
                  ))}
                </div>
              )}

              {/* Groups */}
              {(['green', 'yellow', 'red'] as const).map(status => {
                const group = grouped[status]
                if (group.length === 0) return null
                const cfg = STATUS_CONFIG[status]
                return (
                  <div key={status} style={{ marginBottom: '20px' }}>
                    <p style={{ color: cfg.color, fontWeight: 700, fontSize: '0.85rem', marginBottom: '10px' }}>
                      {cfg.emoji} {cfg.label} ({group.length})
                    </p>
                    {group.map((item: ProfitabilityResult) => (
                      <div key={item.itemId} style={{
                        background: cfg.bg, border: `1px solid ${cfg.color}33`,
                        borderRadius: '10px', padding: '12px 16px', marginBottom: '8px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
                      }}>
                        <div>
                          <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem', margin: '0 0 2px' }}>
                            {itemMap[item.itemId] ?? item.itemId}
                          </p>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>{item.reason}</p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ color: cfg.color, fontWeight: 700, fontSize: '0.8rem', margin: 0 }}>
                            {item.ordersPerWeek}x/Woche
                          </p>
                          {item.estimatedMarginPct != null && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>
                              {item.estimatedMarginPct}% Marge
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}

              <button
                onClick={analyze}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '8px', border: '1.5px solid var(--border)',
                  background: 'transparent', color: 'var(--text-muted)',
                  fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                }}
              >
                <RefreshCw size={12} />
                Erneut analysieren
              </button>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
