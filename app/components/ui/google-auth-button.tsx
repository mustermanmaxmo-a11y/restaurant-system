'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

interface GoogleAuthButtonProps {
  /** Relative callback path, e.g. '/auth/callback?next=/admin' */
  callbackPath: string
  label?: string
  disabled?: boolean
}

export function GoogleAuthButton({
  callbackPath,
  label = 'Mit Google anmelden',
  disabled = false,
}: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  async function handleGoogleLogin() {
    setLoading(true)
    setError(null)

    // Only allow relative paths to prevent open redirect
    const safePath = callbackPath.startsWith('/') ? callbackPath : '/admin/setup'

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${safePath}`,
      },
    })

    if (oauthError) {
      setError(oauthError.message)
      setLoading(false)
    }
    // On success the browser navigates — no state reset needed
  }

  const highlighted = isHovered || isFocused

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading || disabled}
        aria-busy={loading}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: '10px',
          border: `1px solid ${highlighted ? 'var(--accent)' : 'var(--border)'}`,
          outline: isFocused ? '2px solid var(--accent)' : 'none',
          outlineOffset: '2px',
          background: highlighted ? 'var(--surface-hover, var(--surface))' : 'var(--surface)',
          color: 'var(--text)',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: (loading || disabled) ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          transition: 'border-color 0.15s ease, background 0.15s ease, outline 0.1s ease',
          opacity: (loading || disabled) ? 0.7 : 1,
        }}
      >
        <GoogleIcon />
        {loading ? '…' : label}
      </button>
      {error && (
        <p role="alert" style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  )
}
