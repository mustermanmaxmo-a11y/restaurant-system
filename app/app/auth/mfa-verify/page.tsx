'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BackgroundPaths } from '@/components/ui/background-paths'
import { Smartphone, ShieldCheck } from 'lucide-react'

export default function MfaVerifyPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function init() {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totp = factors?.totp?.find((f: { status: string }) => f.status === 'verified')
      if (!totp) {
        router.push('/admin')
        return
      }
      setFactorId(totp.id)
      setLoading(false)
    }
    init()
  }, [router])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId || code.length !== 6) return
    setVerifying(true)
    setError('')

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError || !challengeData) {
      setError('Fehler beim Verifizieren. Bitte versuche es erneut.')
      setVerifying(false)
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    })

    if (verifyError) {
      setError('Ungültiger Code. Bitte prüfe deine Authenticator-App.')
      setVerifying(false)
      return
    }

    router.push('/admin')
  }

  if (loading) return null

  return (
    <BackgroundPaths>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10 fade-up">
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <ShieldCheck size={24} color="#fff" />
            </div>
            <h1 style={{ color: 'var(--text)', fontSize: '1.75rem', fontWeight: 800, marginBottom: '8px', fontFamily: 'var(--font-heading), system-ui, sans-serif', letterSpacing: '-0.03em' }}>
              Zwei-Faktor-Authentifizierung
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Gib den 6-stelligen Code aus deiner Authenticator-App ein.
            </p>
          </div>

          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                htmlFor="code"
                style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                Authentifizierungs-Code
              </label>
              <div style={{ position: 'relative' }}>
                <Smartphone size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError('') }}
                  required
                  placeholder="000000"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 44px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '1.5rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    letterSpacing: '0.3em',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                  }}
                />
              </div>
            </div>

            {error && (
              <p style={{ color: '#ef4444', fontSize: '0.875rem', background: '#ef444415', padding: '10px 14px', borderRadius: '8px' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={verifying || code.length !== 6}
              className={verifying || code.length !== 6 ? '' : 'btn-primary'}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                border: 'none',
                background: verifying || code.length !== 6 ? 'var(--border)' : 'var(--accent)',
                color: 'var(--accent-text)',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: verifying || code.length !== 6 ? 'not-allowed' : 'pointer',
                marginTop: '8px',
              }}
            >
              {verifying ? 'Wird geprüft...' : 'Bestätigen'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.5 }}>
            Kein Zugriff auf deine App?{' '}
            <button
              onClick={async () => { await supabase.auth.signOut(); router.push('/owner-login') }}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem', padding: 0 }}
            >
              Abmelden
            </button>
          </p>
        </div>
      </div>
    </BackgroundPaths>
  )
}
