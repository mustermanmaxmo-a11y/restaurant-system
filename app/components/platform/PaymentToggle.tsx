'use client'

import { useState } from 'react'

export function PaymentToggle({ restaurantId, initialEnabled, hasStripe }: {
  restaurantId: string
  initialEnabled: boolean
  hasStripe: boolean
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (!hasStripe || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/platform/payment-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, enabled: !enabled }),
      })
      if (res.ok) setEnabled(prev => !prev)
    } finally {
      setLoading(false)
    }
  }

  if (!hasStripe) {
    return (
      <span style={{ color: '#555', fontSize: '0.72rem' }} title="Erst Stripe verbinden">
        — kein Stripe
      </span>
    )
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={enabled ? 'Online-Zahlung deaktivieren' : 'Online-Zahlung aktivieren'}
      style={{
        width: '40px', height: '22px', borderRadius: '11px', border: 'none',
        background: enabled ? '#10b981' : '#374151',
        cursor: loading ? 'wait' : 'pointer',
        position: 'relative', transition: 'background 0.2s',
        opacity: loading ? 0.6 : 1,
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: '3px',
        left: enabled ? '21px' : '3px',
        width: '16px', height: '16px', borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
      }} />
    </button>
  )
}
