'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Shield, Eye, EyeOff } from 'lucide-react'

export default function PlatformLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError('E-Mail oder Passwort falsch.')
      setLoading(false)
      return
    }

    // Prüfen ob der Account Platform-Zugang hat
    const { data: isOwner } = await supabase.rpc('is_platform_owner')

    if (isOwner !== true) {
      await supabase.auth.signOut()
      setError('Kein Zugang — dein Account ist nicht für den Platform-Bereich freigeschalten.')
      setLoading(false)
      return
    }

    router.push('/platform')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Subtle background gradient */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(239,68,68,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: '#ef4444', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 32px rgba(239,68,68,0.3)',
          }}>
            <Shield size={24} color="#fff" />
          </div>
          <h1 style={{ color: '#fff', fontSize: '1.75rem', fontWeight: 800, marginBottom: '6px', letterSpacing: '-0.03em' }}>
            Platform-Login
          </h1>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>
            Nur für das RestaurantOS-Team
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{
              display: 'block', color: '#888', fontSize: '0.7rem',
              fontWeight: 700, marginBottom: '6px',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="team@restaurantos.de"
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '10px',
                border: '1px solid #2a2a3e', background: '#1a1a2e',
                color: '#fff', fontSize: '1rem', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block', color: '#888', fontSize: '0.7rem',
              fontWeight: 700, marginBottom: '6px',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>Passwort</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '12px 44px 12px 16px', borderRadius: '10px',
                  border: '1px solid #2a2a3e', background: '#1a1a2e',
                  color: '#fff', fontSize: '1rem', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#666', padding: '4px', display: 'flex', alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p style={{
              color: '#ef4444', fontSize: '0.875rem',
              background: 'rgba(239,68,68,0.1)', padding: '10px 14px', borderRadius: '8px',
              border: '1px solid rgba(239,68,68,0.2)',
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
              background: loading ? '#2a2a3e' : '#ef4444',
              color: loading ? '#666' : '#fff',
              fontSize: '1rem', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '8px',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(239,68,68,0.3)',
              transition: 'all 0.15s ease',
            }}
          >
            {loading ? 'Prüfe…' : 'Anmelden'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', color: '#999', fontSize: '0.8rem' }}>
          <a href="/forgot-password" style={{ color: '#ef4444', fontWeight: 600, textDecoration: 'none' }}>
            Passwort vergessen?
          </a>
        </p>
        <p style={{ textAlign: 'center', marginTop: '16px', color: '#999', fontSize: '0.8rem' }}>
          Restaurant-Owner?{' '}
          <a href="/owner-login" style={{ color: '#bbb', fontWeight: 600, textDecoration: 'none' }}>
            Zum Restaurant-Login
          </a>
        </p>
      </div>
    </div>
  )
}
