'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { BackgroundPaths } from '@/components/ui/background-paths'
import { Utensils, Eye, EyeOff } from 'lucide-react'
import { useLanguage } from '@/components/providers/language-provider'
import { LanguageSelector } from '@/components/ui/language-selector'

export default function OwnerLoginPage() {
  const router = useRouter()
  const { t } = useLanguage()
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
      setError(t('auth.loginError'))
      setLoading(false)
      return
    }

    router.push('/admin')
  }

  return (
    <BackgroundPaths>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
          <LanguageSelector />
        </div>
        <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10 fade-up">
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Utensils size={24} color="#fff" />
            </div>
            <h1 style={{ color: 'var(--text)', fontSize: '1.75rem', fontWeight: 800, marginBottom: '8px', fontFamily: 'var(--font-heading), system-ui, sans-serif', letterSpacing: '-0.03em' }}>
              {t('auth.ownerLogin')}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Melde dich mit deinem Restaurant-Account an
            </p>
          </div>

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
                  placeholder="Dein Passwort"
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
              {loading ? '...' : t('auth.login')}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {t('auth.noAccount')}{' '}
            <Link href="/register" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              {t('auth.registerHere')}
            </Link>
          </p>
        </div>
        </div>
      </div>
    </BackgroundPaths>
  )
}
