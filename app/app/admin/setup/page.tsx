'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Step = 'info' | 'plan'

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('info')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/owner-login'); return }
      setUserId(session.user.id)
    })
  }, [router])

  function handleNameChange(val: string) {
    setName(val)
    const autoSlug = val
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    setSlug(autoSlug)
  }

  async function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!userId) return

    // Slug auf Eindeutigkeit prüfen
    const { data: existing } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .limit(1)

    if (existing && existing.length > 0) {
      setError('Dieser URL-Name ist bereits vergeben. Bitte wähle einen anderen.')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase
      .from('restaurants')
      .insert({
        owner_id: userId,
        name,
        slug,
        plan: 'basic',
        active: false,
      })

    if (insertError) {
      if (insertError.code === '23505') {
        await supabase
          .from('restaurants')
          .update({ name, slug })
          .eq('owner_id', userId)
      } else {
        setError('Fehler beim Speichern. Bitte versuche es erneut.')
        setLoading(false)
        return
      }
    }

    setStep('plan')
    setLoading(false)
  }

  async function handlePlanSelect(plan: 'basic' | 'pro') {
    setLoading(true)
    setError('')

    const response = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })

    const data = await response.json()

    if (!response.ok || !data.url) {
      setError('Stripe-Checkout konnte nicht gestartet werden. Bitte versuche es erneut.')
      setLoading(false)
      return
    }

    window.location.href = data.url
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontWeight: 600,
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '1rem',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-md">
        {/* Progress Bar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
          {(['info', 'plan'] as Step[]).map((s) => (
            <div
              key={s}
              style={{
                height: '4px',
                flex: 1,
                borderRadius: '2px',
                background: s === 'info' || step === 'plan'
                  ? 'var(--accent)'
                  : 'var(--border)',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        {step === 'info' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🏪</div>
              <h1 style={{ color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
                Dein Restaurant einrichten
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Diese Infos erscheinen später für deine Gäste.
              </p>
            </div>

            <form onSubmit={handleInfoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label htmlFor="name" style={labelStyle}>Restaurant-Name</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={e => handleNameChange(e.target.value)}
                  required
                  placeholder="z.B. Trattoria Roma"
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="slug" style={labelStyle}>URL-Name</label>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--surface)', overflow: 'hidden' }}>
                  <span style={{ padding: '12px 12px 12px 16px', color: 'var(--text-muted)', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                    /bestellen/
                  </span>
                  <input
                    id="slug"
                    type="text"
                    value={slug}
                    onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    required
                    placeholder="trattoria-roma"
                    style={{ ...inputStyle, border: 'none', borderRadius: 0, paddingLeft: 0 }}
                  />
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '6px' }}>
                  Dein Bestelllink: restaurantos.de/bestellen/{slug || 'dein-name'}
                </p>
              </div>

              {error && (
                <p style={{ color: '#ef4444', fontSize: '0.875rem', background: '#ef444415', padding: '10px 14px', borderRadius: '8px' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !name || !slug}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: loading || !name || !slug ? 'var(--border)' : 'var(--accent)',
                  color: '#fff',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: loading || !name || !slug ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Wird gespeichert...' : 'Weiter → Plan wählen'}
              </button>
            </form>
          </>
        )}

        {step === 'plan' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>💳</div>
              <h1 style={{ color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
                Plan wählen
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Jederzeit kündbar. Keine versteckten Kosten.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Basic Plan */}
              <button
                onClick={() => handlePlanSelect('basic')}
                disabled={loading}
                style={{
                  background: 'var(--surface)',
                  border: '2px solid var(--border)',
                  borderRadius: '14px',
                  padding: '24px',
                  textAlign: 'left',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => !loading && (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>Basic</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>Perfekt zum Start</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.5rem' }}>29€</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>/Monat</span>
                  </div>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {['QR-Bestellung (Dine-In, Delivery, Pickup)', 'Realtime Staff-Dashboard', 'Menü-Verwaltung', 'Bis 10 Tische', 'QR-Codes generieren'].map(f => (
                    <li key={f} style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ color: 'var(--accent)' }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
              </button>

              {/* Pro Plan */}
              <button
                onClick={() => handlePlanSelect('pro')}
                disabled={loading}
                style={{
                  background: 'var(--surface)',
                  border: '2px solid var(--accent)',
                  borderRadius: '14px',
                  padding: '24px',
                  textAlign: 'left',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  position: 'absolute', top: '12px', right: '12px',
                  background: 'var(--accent)', color: '#fff',
                  fontSize: '0.7rem', fontWeight: 700,
                  padding: '3px 10px', borderRadius: '20px',
                }}>
                  EMPFOHLEN
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>Pro</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>Unbegrenzt skalieren</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.5rem' }}>79€</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>/Monat</span>
                  </div>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {['Alles aus Basic', 'Unbegrenzte Tische', 'KI-Chatbot für Gäste', 'Analytics-KI für Owner', 'Reservierungssystem'].map(f => (
                    <li key={f} style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ color: 'var(--accent)' }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
              </button>
            </div>

            {error && (
              <p style={{ color: '#ef4444', fontSize: '0.875rem', background: '#ef444415', padding: '10px 14px', borderRadius: '8px', marginTop: '16px' }}>
                {error}
              </p>
            )}

            {loading && (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '16px', fontSize: '0.875rem' }}>
                Weiterleitung zu Stripe...
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
