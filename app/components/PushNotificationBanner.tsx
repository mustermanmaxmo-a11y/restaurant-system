'use client'

import { useState, useEffect } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

type Props = {
  appContext: 'dashboard' | 'admin' | 'platform'
  restaurantId?: string
  userId?: string
  staffRole?: string
}

export function PushNotificationBanner({ appContext, restaurantId, userId, staffRole }: Props) {
  const { permission, subscribed, loading, subscribe } = usePushNotifications({
    appContext, restaurantId, userId, staffRole,
  })
  const [dismissed, setDismissed] = useState(false)
  const [isPwa, setIsPwa] = useState(false)

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    setIsPwa(isStandalone)
    const wasDismissed = localStorage.getItem(`push-dismissed-${appContext}`)
    if (wasDismissed) setDismissed(true)
  }, [appContext])

  if (!isPwa || dismissed || subscribed || permission !== 'default') return null

  function handleDismiss() {
    localStorage.setItem(`push-dismissed-${appContext}`, '1')
    setDismissed(true)
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: '#1a1a2e',
        border: '1px solid #00C9A7',
        borderRadius: 12,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        maxWidth: 360,
        width: 'calc(100% - 32px)',
      }}
    >
      <span style={{ fontSize: 22 }}>🔔</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, color: '#e5e7eb', fontSize: 14, fontWeight: 600 }}>
          Push-Benachrichtigungen aktivieren
        </p>
        <p style={{ margin: '2px 0 0', color: '#9ca3af', fontSize: 12 }}>
          Erhalte Alerts für neue Bestellungen & Events
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleDismiss}
          disabled={loading}
          style={{
            background: 'transparent',
            border: '1px solid #374151',
            borderRadius: 8,
            color: '#9ca3af',
            padding: '6px 10px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 12,
          }}
        >
          Später
        </button>
        <button
          onClick={subscribe}
          disabled={loading}
          style={{
            background: loading ? '#374151' : '#00C9A7',
            border: 'none',
            borderRadius: 8,
            color: loading ? '#9ca3af' : '#0a0a0f',
            padding: '6px 12px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {loading ? '...' : 'Aktivieren'}
        </button>
      </div>
    </div>
  )
}
