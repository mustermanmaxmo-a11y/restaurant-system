'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { BackgroundPaths } from '@/components/ui/background-paths'
import { Utensils, Eye, EyeOff } from 'lucide-react'
import { useLanguage } from '@/components/providers/language-provider'
import { LanguageSelector } from '@/components/ui/language-selector'
import { LegalFooter } from '@/components/LegalFooter'

export default function RegisterPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [consentAccepted, setConsentAccepted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein.')
      setLoading(false)
      return
    }

    if (!consentAccepted) {
      setError('Bitte akzeptiere die AGB und Datenschutzerklärung.')
      setLoading(false)
      return
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Email confirmation required — show success state instead of redirecting
    setConfirmed(true)
    setLoading(false)
  }

  if (confirmed) {
    return (
      <BackgroundPaths>
        <div className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm text-center">
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <Utensils size={24} color="#fff" />
            </div>
            <h1 style={{ color: 'var(--text)', fontSize: '1.5rem', fontWeight: 800, marginBottom: '12px', fontFamily: 'var(--font-heading), system-ui, sans-serif', letterSpacing: '-0.03em' }}>
              E-Mail bestätigen
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Wir haben eine Bestätigungsmail an <strong style={{ color: 'var(--text)' }}>{email}</strong> geschickt.<br />
              Klick auf den Link in der Mail um fortzufahren.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '24px' }}>
              Kein Mail erhalten? Schau auch im Spam-Ordner nach.
            </p>
          </div>
        </div>
      </BackgroundPaths>
    )
  }

  return (
    <BackgroundPaths>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
          <LanguageSelector />
        </div>
        <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="text-center mb-10">
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Utensils size={24} color="#fff" />
            </div>
            <h1 style={{ color: 'var(--text)', fontSize: '1.75rem', fontWeight: 800, marginBottom: '8px', fontFamily: 'var(--font-heading), system-ui, sans-serif', letterSpacing: '-0.03em' }}>
              RestaurantOS starten
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Kostenloses Konto erstellen — dann Plan wählen
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                htmlFor="email"
                style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                {t('auth.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="chef@meinrestaurant.de"
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

            <div>
              <label
                htmlFor="password"
                style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                {t('auth.password')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="Mindestens 8 Zeichen"
                  className="input-styled"
                  style={{
                    width: '100%',
                    padding: '12px 44px 12px 16px',
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
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={e => setConsentAccepted(e.target.checked)}
                style={{ marginTop: '3px', accentColor: 'var(--accent)', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer' }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                Ich habe die{' '}
                <a href="/agb" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>AGB</a>
                {' '}und die{' '}
                <a href="/datenschutz" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>Datenschutzerklärung</a>
                {' '}gelesen und akzeptiere diese.
              </span>
            </label>

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
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '8px',
              }}
            >
              {loading ? '...' : t('auth.register')}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {t('auth.hasAccount')}{' '}
            <Link href="/owner-login" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              {t('auth.loginHere')}
            </Link>
          </p>
        </div>
        </div>
      </div>
      <LegalFooter />
    </BackgroundPaths>
  )
}
