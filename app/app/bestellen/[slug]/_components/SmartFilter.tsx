'use client'

import { useState, useRef, useCallback } from 'react'
import { Sparkles, X } from 'lucide-react'

interface MenuItem {
  id: string
  name: string
  description: string | null
  allergens: string[] | null
  tags: string[] | null
}

interface FilterResult {
  suitable: string[]
  unsuitable: { id: string; reason: string }[]
}

interface Props {
  restaurantId: string
  items: MenuItem[]
  accentColor?: string
  onFilterChange: (result: FilterResult | null) => void
}

export default function SmartFilter({ restaurantId, items, accentColor = '#6c63ff', onFilterChange }: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runFilter = useCallback(async (q: string) => {
    if (!q.trim()) { onFilterChange(null); return }
    setLoading(true)
    try {
      const res = await fetch('/api/ai/menu-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, query: q, items }),
      })
      if (!res.ok) { onFilterChange(null); return }
      const json: FilterResult = await res.json()
      onFilterChange(json)
    } catch {
      onFilterChange(null)
    } finally {
      setLoading(false)
    }
  }, [restaurantId, items, onFilterChange])

  function handleChange(val: string) {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) { onFilterChange(null); return }
    debounceRef.current = setTimeout(() => runFilter(val), 700)
  }

  function clear() {
    setQuery('')
    onFilterChange(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: 'var(--surface)', border: '1.5px solid var(--border)',
        borderRadius: '12px', padding: '10px 14px',
      }}>
        <Sparkles size={16} color={accentColor} style={{ flexShrink: 0 }} />
        <input
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          placeholder="Allergien oder Vorlieben? z.B. vegan, keine Nüsse"
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: '0.9rem',
          }}
        />
        {loading && (
          <div style={{
            width: '14px', height: '14px', border: `2px solid ${accentColor}`,
            borderTopColor: 'transparent', borderRadius: '50%',
            animation: 'smartfilter-spin 0.8s linear infinite', flexShrink: 0,
          }} />
        )}
        {query && !loading && (
          <button onClick={clear} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <X size={16} color="var(--text-muted)" />
          </button>
        )}
      </div>
      <style>{`@keyframes smartfilter-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
