'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const FALLBACK = 'Diese Seite verwendet nur technisch notwendige Cookies für Login und Einstellungen. Keine Tracking- oder Marketing-Cookies.'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    const accepted = localStorage.getItem('cookie-notice-seen')
    if (!accepted) setVisible(true)
  }, [])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    fetch('/api/legal/cookie-banner', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data?.content) setHtml(data.content)
      })
      .catch(() => { /* fallback stays active */ })
    return () => { cancelled = true }
  }, [visible])

  function dismiss() {
    localStorage.setItem('cookie-notice-seen', '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      background: 'var(--surface, #1a1a2e)',
      border: '1px solid var(--border, #333)',
      borderRadius: '14px',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      flexWrap: 'wrap',
      maxWidth: '560px',
      width: 'calc(100% - 48px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
    }}>
      {html ? (
        <div
          style={{ color: 'var(--text-muted, #888)', fontSize: '0.8rem', lineHeight: 1.5, margin: 0, flex: 1 }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p style={{ color: 'var(--text-muted, #888)', fontSize: '0.8rem', lineHeight: 1.5, margin: 0, flex: 1 }}>
          {FALLBACK}{' '}
          <Link href="/datenschutz" style={{ color: 'var(--accent, #6c63ff)', fontWeight: 600 }}>Mehr erfahren</Link>
        </p>
      )}
      <button
        onClick={dismiss}
        style={{
          background: 'var(--accent, #6c63ff)',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '0.8rem',
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        OK
      </button>
    </div>
  )
}
