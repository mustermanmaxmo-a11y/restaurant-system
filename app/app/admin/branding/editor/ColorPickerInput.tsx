'use client'

import { useState, useEffect } from 'react'
import { darken } from '@/lib/color-utils'

export function ColorPickerInput({ value, onChange, onReset, resetLabel }: {
  value: string; onChange: (hex: string) => void; onReset?: () => void; resetLabel?: string
}) {
  const [hexInput, setHexInput] = useState(value)
  useEffect(() => { setHexInput(value) }, [value])
  function handleHexChange(raw: string) {
    setHexInput(raw)
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) onChange(raw)
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label style={{ position: 'relative', cursor: 'pointer' }}>
          <input type="color" value={value} onChange={e => { onChange(e.target.value); setHexInput(e.target.value) }}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
          <div style={{
            width: '40px', height: '40px', borderRadius: '8px', background: value,
            border: '2px solid var(--border)', boxShadow: `0 0 0 3px ${value}22`, cursor: 'pointer',
          }} />
        </label>
        <input type="text" value={hexInput} onChange={e => handleHexChange(e.target.value)} maxLength={7}
          style={{ flex: 1, padding: '8px 10px', borderRadius: '7px', border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '0.82rem', fontFamily: 'monospace', outline: 'none' }}
          placeholder="#FF6B2C" />
        <div style={{ height: '40px', width: '60px', borderRadius: '7px', background: `linear-gradient(135deg, ${value}, ${darken(value, 40)})`, border: '1px solid var(--border)', flexShrink: 0 }} />
      </div>
      {onReset && (
        <button onClick={onReset} style={{ marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          ↺ {resetLabel ?? 'Paket-Standard'}
        </button>
      )}
    </div>
  )
}
