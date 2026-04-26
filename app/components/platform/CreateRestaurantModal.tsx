'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PlatformRole } from '@/lib/platform-auth'

interface Props {
  role: PlatformRole
}

type Plan = 'trial' | 'starter' | 'pro' | 'enterprise'

interface CreatedResult {
  name: string
  slug: string
  ownerEmail: string
  tempPassword: string
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function CreateRestaurantModal({ role }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<CreatedResult | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [plan, setPlan] = useState<Plan>('trial')
  const [trialDays, setTrialDays] = useState(14)

  if (role !== 'owner') return null

  function handleNameChange(val: string) {
    setName(val)
    setSlug(generateSlug(val))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/platform/restaurants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug, ownerEmail, plan, trialDays }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      if (data.error === 'slug_taken') setError('Dieser URL-Name ist bereits vergeben.')
      else if (data.error === 'email_taken') setError('Diese E-Mail existiert bereits.')
      else setError(data.error ?? 'Unbekannter Fehler')
      return
    }

    setCreated({ name: data.restaurant.name, slug: data.restaurant.slug, ownerEmail, tempPassword: data.tempPassword })
  }

  function handleClose() {
    setOpen(false)
    setCreated(null)
    setName('')
    setSlug('')
    setOwnerEmail('')
    setPlan('trial')
    setTrialDays(14)
    setError('')
    if (created) router.refresh()
  }

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '8px 16px',
          background: '#6366f1',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 700,
          fontSize: '0.82rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span style={{ fontSize: '1rem', lineHeight: 1 }}>+</span>
        Restaurant anlegen
      </button>

      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px',
          }}
        >
          <div style={{
            background: '#1a1a2e', border: '1px solid #2a2a3e',
            borderRadius: '16px', width: '100%', maxWidth: '480px',
            padding: '32px', position: 'relative',
          }}>
            <button
              onClick={handleClose}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#666', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1 }}
            >✕</button>

            {!created ? (
              <>
                <h2 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 800, marginBottom: '24px' }}>
                  Neues Restaurant anlegen
                </h2>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <Field label="Restaurant Name">
                    <input
                      value={name}
                      onChange={e => handleNameChange(e.target.value)}
                      placeholder="z.B. Bella Italia"
                      required
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="URL-Slug">
                    <input
                      value={slug}
                      onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="bella-italia"
                      required
                      style={inputStyle}
                    />
                    <span style={{ fontSize: '0.7rem', color: '#555', marginTop: '4px', display: 'block' }}>
                      restaurantos.de/{slug || '…'}
                    </span>
                  </Field>

                  <Field label="Owner E-Mail">
                    <input
                      type="email"
                      value={ownerEmail}
                      onChange={e => setOwnerEmail(e.target.value)}
                      placeholder="inhaber@restaurant.de"
                      required
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Plan">
                    <select value={plan} onChange={e => setPlan(e.target.value as Plan)} style={inputStyle}>
                      <option value="trial">Trial</option>
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </Field>

                  {plan === 'trial' && (
                    <Field label="Trial-Dauer (Tage)">
                      <input
                        type="number"
                        value={trialDays}
                        onChange={e => setTrialDays(Math.max(1, Number(e.target.value)))}
                        min={1}
                        max={365}
                        style={inputStyle}
                      />
                    </Field>
                  )}

                  {error && (
                    <div style={{ padding: '10px 14px', background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '8px', color: '#fca5a5', fontSize: '0.8rem' }}>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      marginTop: '8px', padding: '12px', background: loading ? '#3730a3' : '#6366f1',
                      color: '#fff', border: 'none', borderRadius: '8px',
                      fontWeight: 700, fontSize: '0.9rem', cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loading ? 'Wird angelegt…' : 'Restaurant anlegen'}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>✅</div>
                  <h2 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 800 }}>Restaurant angelegt!</h2>
                  <p style={{ color: '#6ee7b7', fontSize: '0.82rem', marginTop: '4px' }}>{created.name}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                  <CredentialRow
                    label="URL-Slug"
                    value={`/${created.slug}`}
                    onCopy={() => copy(created.slug, 'slug')}
                    copied={copied === 'slug'}
                  />
                  <CredentialRow
                    label="E-Mail"
                    value={created.ownerEmail}
                    onCopy={() => copy(created.ownerEmail, 'email')}
                    copied={copied === 'email'}
                  />
                  <CredentialRow
                    label="Temp-Passwort"
                    value={created.tempPassword}
                    onCopy={() => copy(created.tempPassword, 'pw')}
                    copied={copied === 'pw'}
                    highlight
                  />
                </div>

                <div style={{ padding: '10px 14px', background: '#1c1c2e', border: '1px solid #2a2a3e', borderRadius: '8px', color: '#888', fontSize: '0.75rem', marginBottom: '20px' }}>
                  ⚠️ Passwort nur einmal sichtbar – bitte jetzt kopieren und weitergeben.
                </div>

                <button
                  onClick={handleClose}
                  style={{
                    width: '100%', padding: '12px', background: '#242438',
                    color: '#ccc', border: '1px solid #2a2a3e', borderRadius: '8px',
                    fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                  }}
                >
                  Schließen
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function CredentialRow({ label, value, onCopy, copied, highlight }: {
  label: string; value: string; onCopy: () => void; copied: boolean; highlight?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px',
      background: highlight ? '#1e1b4b' : '#1f1f30',
      border: `1px solid ${highlight ? '#4338ca' : '#2a2a3e'}`,
      borderRadius: '8px', gap: '12px',
    }}>
      <div>
        <div style={{ color: '#666', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{label}</div>
        <div style={{ color: highlight ? '#a5b4fc' : '#ccc', fontFamily: 'ui-monospace, monospace', fontSize: '0.82rem', wordBreak: 'break-all' }}>{value}</div>
      </div>
      <button
        onClick={onCopy}
        style={{
          flexShrink: 0, padding: '5px 10px',
          background: copied ? '#065f46' : '#2a2a3e',
          color: copied ? '#6ee7b7' : '#ccc',
          border: 'none', borderRadius: '6px',
          fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        {copied ? 'Kopiert!' : 'Kopieren'}
      </button>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: '#0f0f1a',
  border: '1px solid #2a2a3e',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '0.85rem',
  outline: 'none',
  boxSizing: 'border-box',
}
