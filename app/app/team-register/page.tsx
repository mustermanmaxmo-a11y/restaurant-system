'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, Eye, EyeOff, CheckCircle } from 'lucide-react'

export default function TeamRegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein.')
      setLoading(false)
      return
    }

    const { error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0a14',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}>
        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '380px', textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'rgba(16,185,129,0.15)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
          }}>
            <CheckCircle size={28} color="#10b981" />
          </div>
          <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 800, marginBottom: '10px' }}>
            Account erstellt
          </h1>
          <p style={{ color: '#888', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '24px' }}>
            Dein Account wurde angelegt. Der Platform-Owner muss dich jetzt noch in{' '}
            <strong style={{ color: '#ccc' }}>/platform/team</strong> freischalten — danach kannst du dich über{' '}
            <a href="/team-login" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>/team-login</a> anmelden.
          </p>
          <a
            href="/team-login"
            style={{
              display: 'inline-block', padding: '12px 28px', borderRadius: '10px',
              background: '#6366f1', color: '#fff', fontWeight: 700,
              fontSize: '0.9rem', textDecoration: 'none',
            }}
          >
            Zum Login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a14',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: '#6366f1', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 32px rgba(99,102,241,0.3)',
          }}>
            <Users size={24} color="#fff" />
          </div>
          <h1 style={{ color: '#fff', fontSize: '1.75rem', fontWeight: 800, marginBottom: '6px', letterSpacing: '-0.03em' }}>
            Team-Registrierung
          </h1>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>
            Nur für das RestaurantOS-Team
          </p>
        </div>

        <div style={{
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: '10px', padding: '12px 14px', marginBottom: '20px',
          color: '#a5b4fc', fontSize: '0.8rem', lineHeight: 1.5,
        }}>
          Nach der Registrierung muss dich der Owner erst freischalten, bevor du dich einloggen kannst.
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
              placeholder="name@email.de"
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
                placeholder="Mindestens 8 Zeichen"
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
              background: loading ? '#2a2a3e' : '#6366f1',
              color: loading ? '#666' : '#fff',
              fontSize: '1rem', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '8px',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.3)',
              transition: 'all 0.15s ease',
            }}
          >
            {loading ? 'Erstelle Account…' : 'Account erstellen'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '32px', color: '#444', fontSize: '0.8rem' }}>
          Bereits registriert?{' '}
          <a href="/team-login" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>
            Zum Login
          </a>
        </p>
      </div>
    </div>
  )
}
