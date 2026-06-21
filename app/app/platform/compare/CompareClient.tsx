'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { X, Plus, Search } from 'lucide-react'

type RestMetrics = {
  id: string; name: string; slug: string; plan: string; active: boolean; created_at: string
  gmv7: number; gmv30: number; gmv90: number
  orders7: number; orders30: number; orders90: number
  avgOrder: number; cancelledCount: number; cancelRate: number
  peakHour: number; weeklyTrend: number[]
  servedCount: number
}

const PLAN_COLOR: Record<string, string> = {
  trial: '#60a5fa', starter: '#34d399', pro: '#fbbf24', enterprise: '#a78bfa', expired: '#f87171',
}

const METRICS: { key: keyof RestMetrics; label: string; fmt: (v: number) => string; higher: boolean }[] = [
  { key: 'gmv90',       label: 'GMV (90d)',         fmt: v => `€${v >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(0)}`, higher: true },
  { key: 'gmv30',       label: 'GMV (30d)',          fmt: v => `€${v.toFixed(0)}`,    higher: true },
  { key: 'gmv7',        label: 'GMV (7d)',           fmt: v => `€${v.toFixed(0)}`,    higher: true },
  { key: 'orders90',    label: 'Orders (90d)',        fmt: v => String(Math.round(v)), higher: true },
  { key: 'orders30',    label: 'Orders (30d)',        fmt: v => String(Math.round(v)), higher: true },
  { key: 'orders7',     label: 'Orders (7d)',         fmt: v => String(Math.round(v)), higher: true },
  { key: 'avgOrder',    label: 'Ø Bestellwert',      fmt: v => `€${v.toFixed(2)}`,    higher: true },
  { key: 'cancelRate',  label: 'Storno-Rate',         fmt: v => `${v.toFixed(1)}%`,   higher: false },
  { key: 'servedCount', label: 'Servierte Orders',    fmt: v => String(Math.round(v)), higher: true },
  { key: 'peakHour',    label: 'Peak-Stunde',         fmt: v => `${String(Math.round(v)).padStart(2,'0')}:00`, higher: false },
]

function Sparkline({ vals, color }: { vals: number[]; color: string }) {
  const max = Math.max(...vals, 1)
  const h = 36, w = vals.length * 10
  if (vals.every(v => v === 0)) return <div style={{ color: 'rgba(255,255,255,0.1)', fontSize: '0.65rem', padding: '8px 0' }}>Keine Daten</div>
  const pts = vals.map((v, i) => `${i * 10 + 5},${h - Math.round((v / max) * (h - 4)) - 2}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', width: '100%', height: `${h}px` }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

export function CompareClient({ restaurants }: { restaurants: RestMetrics[] }) {
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)

  const filtered = useMemo(() => {
    if (!search.trim()) return restaurants
    const q = search.toLowerCase()
    return restaurants.filter(r => r.name.toLowerCase().includes(q) || r.slug.includes(q))
  }, [restaurants, search])

  const selectedRests = useMemo(() => selected.map(id => restaurants.find(r => r.id === id)).filter(Boolean) as RestMetrics[], [selected, restaurants])

  const colors = ['#c4b5fd', '#60a5fa', '#34d399', '#fbbf24']

  function addRest(id: string) {
    if (selected.length >= 4 || selected.includes(id)) return
    setSelected(prev => [...prev, id])
    setShowPicker(false)
    setSearch('')
  }
  function removeRest(id: string) { setSelected(prev => prev.filter(x => x !== id)) }

  // For each metric, find max value across selected restaurants
  function getBest(key: keyof RestMetrics, higher: boolean) {
    const vals = selectedRests.map(r => r[key] as number)
    return higher ? Math.max(...vals) : Math.min(...vals.filter(v => v > 0))
  }

  return (
    <div>
      {/* Restaurant selector */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '28px', alignItems: 'center' }}>
        {selectedRests.map((r, i) => (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
            background: `${colors[i]}12`, border: `1px solid ${colors[i]}35`,
            borderRadius: '10px',
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors[i], flexShrink: 0 }} />
            <div>
              <div style={{ color: colors[i], fontWeight: 700, fontSize: '0.82rem' }}>{r.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem' }}>{r.plan}</div>
            </div>
            <button onClick={() => removeRest(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', padding: '0' }}>
              <X size={13} />
            </button>
          </div>
        ))}

        {selected.length < 4 && (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowPicker(p => !p)} style={{
              display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem',
              cursor: 'pointer', fontWeight: 600,
            }}>
              <Plus size={14} />
              Restaurant hinzufügen
            </button>

            {showPicker && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
                background: '#0c0c1e', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '12px', padding: '12px', width: '300px',
                boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
              }}>
                <div style={{ position: 'relative', marginBottom: '10px' }}>
                  <Search size={13} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', top: '50%', left: '10px', transform: 'translateY(-50%)' }} />
                  <input
                    autoFocus
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Name suchen..."
                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 28px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem', outline: 'none' }}
                  />
                </div>
                <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  {filtered.slice(0, 20).map(r => {
                    const isSelected = selected.includes(r.id)
                    return (
                      <button key={r.id} onClick={() => addRest(r.id)} disabled={isSelected || selected.length >= 4}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '7px 10px', borderRadius: '7px', border: 'none',
                          background: isSelected ? 'rgba(255,255,255,0.04)' : 'transparent',
                          cursor: isSelected ? 'default' : 'pointer', textAlign: 'left',
                        }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: PLAN_COLOR[r.plan] ?? '#888', flexShrink: 0 }} />
                        <span style={{ flex: 1, color: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>{r.name}</span>
                        <span style={{ color: PLAN_COLOR[r.plan] ?? '#888', fontSize: '0.65rem' }}>{r.plan}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {selected.length > 0 && (
          <button onClick={() => setSelected([])} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem', cursor: 'pointer' }}>
            Alle entfernen
          </button>
        )}
      </div>

      {selected.length === 0 && (
        <div style={{ padding: '80px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '1rem', marginBottom: '12px' }}>Restaurants auswählen zum Vergleichen</div>
          <div style={{ color: 'rgba(255,255,255,0.08)', fontSize: '0.8rem' }}>Bis zu 4 Restaurants gleichzeitig · klicke auf „+ Restaurant hinzufügen"</div>
        </div>
      )}

      {selected.length >= 2 && (
        <>
          {/* Sparklines */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${selected.length}, 1fr)`, gap: '12px', marginBottom: '20px' }}>
            {selectedRests.map((r, i) => (
              <div key={r.id} style={{ background: `${colors[i]}08`, border: `1px solid ${colors[i]}22`, borderRadius: '14px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <Link href={`/platform/restaurants/${r.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{ color: colors[i], fontWeight: 800, fontSize: '0.9rem' }}>{r.name}</div>
                    </Link>
                    <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.68rem' }}>/{r.slug} · {r.plan}</div>
                  </div>
                  <span style={{ padding: '3px 8px', borderRadius: '20px', background: r.active ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.1)', color: r.active ? '#34d399' : '#f87171', fontSize: '0.65rem', fontWeight: 700 }}>
                    {r.active ? 'aktiv' : 'inaktiv'}
                  </span>
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.6rem', marginBottom: '4px' }}>GMV Wochentrend (12W)</div>
                  <Sparkline vals={r.weeklyTrend} color={colors[i]} />
                </div>
              </div>
            ))}
          </div>

          {/* Metrics comparison table */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th style={{ padding: '12px 18px', color: 'rgba(255,255,255,0.25)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', textAlign: 'left', letterSpacing: '0.06em' }}>Metrik</th>
                  {selectedRests.map((r, i) => (
                    <th key={r.id} style={{ padding: '12px 18px', textAlign: 'right' }}>
                      <div style={{ color: colors[i], fontWeight: 700, fontSize: '0.78rem' }}>{r.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map(m => {
                  const best = getBest(m.key, m.higher)
                  return (
                    <tr key={m.key} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '11px 18px', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{m.label}</td>
                      {selectedRests.map((r, i) => {
                        const val = r[m.key] as number
                        const isBest = val === best && selectedRests.length > 1
                        return (
                          <td key={r.id} style={{ padding: '11px 18px', textAlign: 'right' }}>
                            <span style={{
                              fontWeight: isBest ? 800 : 400,
                              color: isBest ? colors[i] : 'rgba(255,255,255,0.45)',
                              fontSize: isBest ? '0.88rem' : '0.82rem',
                            }}>
                              {m.fmt(val)}
                              {isBest && <span style={{ marginLeft: '5px', fontSize: '0.65rem' }}>★</span>}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selected.length === 1 && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          Füge mindestens ein weiteres Restaurant hinzu um zu vergleichen.
        </div>
      )}
    </div>
  )
}
