'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { BackgroundPaths } from '@/components/ui/background-paths'
import { KeyRound } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

    if (resetError) {
      setError('Es ist ein Fehler aufgetreten. Bitte versuche es erneut.')
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <BackgroundPaths>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10 fade-up">
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <KeyRound size={24} color="#fff" />
            </div>
            <h1 style={{ color: 'var(--text)', fontSize: '1.75rem', fontWeight: 800, marginBottom: '8px', fontFamily: 'var(--font-heading), system-ui, sans-serif', letterSpacing: '-0.03em' }}>
              Passwort vergessen
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Wir senden dir einen Reset-Link per E-Mail
            </p>
          </div>

          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                <p style={{ color: '#22c55e', fontWeight: 600, marginBottom: '6px' }}>E-Mail gesendet!</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Prüfe dein Postfach und klicke auf den Link, um dein Passwort zurückzusetzen.
                </p>
              </div>
              <Link href="/owner-login" style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.875rem' }}>
                Zurück zum Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label
                  htmlFor="email"
                  style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  E-Mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="deine@email.de"
                  className="input-styled"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '1rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  }}
                />
              </div>

              {error && (
                <p style={{ color: '#ef4444', fontSize: '0.875rem', background: '#ef444415', padding: '10px 14px', borderRadius: '8px' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className={loading ? '' : 'btn-primary'}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: loading ? 'var(--border)' : 'var(--accent)',
                  color: 'var(--accent-text)',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  marginTop: '8px',
                }}
              >
                {loading ? '...' : 'Reset-Link senden'}
              </button>

              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                <Link href="/owner-login" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  Zurück zum Login
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </BackgroundPaths>
  )
}
