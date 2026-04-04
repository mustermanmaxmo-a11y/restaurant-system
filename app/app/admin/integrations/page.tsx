'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Restaurant } from '@/types/database'
import { Suspense } from 'react'

interface PosConnection {
  provider: string
  connected_at: string
}

const PROVIDERS = [
  {
    id: 'stripe_terminal',
    name: 'Stripe Terminal',
    desc: 'Physisches Kartenlesegerät direkt über Stripe — empfohlen für maximale Integration.',
    color: '#6c63ff',
    manual: true,
    docsUrl: 'https://stripe.com/docs/terminal',
  },
  {
    id: 'sumup',
    name: 'SumUp',
    desc: 'Verbinde deinen SumUp-Account und alle Kartenzahlungen fließen automatisch in die Statistik.',
    color: '#00d4aa',
    manual: false,
  },
  {
    id: 'zettle',
    name: 'Zettle by PayPal',
    desc: 'Verbinde deinen Zettle-Account für automatischen Umsatz-Sync.',
    color: '#009cde',
    manual: false,
  },
  {
    id: 'square',
    name: 'Square',
    desc: 'Verbinde deinen Square-Account und verwalte alle Einnahmen zentral.',
    color: '#3e4348',
    manual: false,
  },
]

function IntegrationsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [connections, setConnections] = useState<PosConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }
      const { data: resto } = await supabase.from('restaurants').select('*').eq('owner_id', session.user.id).limit(1).single()
      if (!resto) { router.push('/admin/setup'); return }
      setRestaurant(resto)

      const { data: conn } = await supabase
        .from('pos_connections')
        .select('provider, connected_at')
        .eq('restaurant_id', resto.id)
      setConnections((conn as PosConnection[]) || [])
      setLoading(false)
    }
    load()

    // Feedback nach OAuth-Callback
    const status = searchParams.get('status')
    const provider = searchParams.get('provider')
    if (status === 'connected' && provider) {
      setStatusMsg(`${PROVIDERS.find(p => p.id === provider)?.name || provider} erfolgreich verbunden.`)
      setTimeout(() => setStatusMsg(null), 4000)
    } else if (status === 'error') {
      setStatusMsg('Verbindung fehlgeschlagen. Bitte erneut versuchen.')
      setTimeout(() => setStatusMsg(null), 5000)
    }
  }, [router, searchParams])

  async function disconnect(provider: string) {
    if (!restaurant) return
    setDisconnecting(provider)
    await supabase.from('pos_connections').delete()
      .eq('restaurant_id', restaurant.id)
      .eq('provider', provider)
    setConnections(prev => prev.filter(c => c.provider !== provider))
    setDisconnecting(null)
  }

  function connectProvider(provider: string) {
    window.location.href = `/api/pos/connect/${provider}`
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Lädt...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '1.2rem' }}>←</button>
        <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>Zahlungs-Integrationen</h1>
      </div>

      <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto' }}>
        {/* Status-Meldung */}
        {statusMsg && (
          <div style={{
            background: statusMsg.includes('fehlgeschlagen') ? '#ef444415' : '#10b98115',
            border: `1px solid ${statusMsg.includes('fehlgeschlagen') ? '#ef444433' : '#10b98133'}`,
            borderRadius: '12px', padding: '14px 18px', marginBottom: '20px',
            color: statusMsg.includes('fehlgeschlagen') ? '#ef4444' : '#10b981',
            fontWeight: 600, fontSize: '0.9rem',
          }}>
            {statusMsg}
          </div>
        )}

        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: 1.6 }}>
          Verbinde deine bestehenden Zahlungssysteme damit alle Einnahmen automatisch in der Statistik erscheinen — egal ob QR-Bestellung, Kartenterminal oder Barzahlung.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {PROVIDERS.map(provider => {
            const conn = connections.find(c => c.provider === provider.id)
            const isConnecting = disconnecting === provider.id

            return (
              <div key={provider.id} style={{
                background: 'var(--surface)',
                border: `1px solid ${conn ? provider.color + '44' : 'var(--border)'}`,
                borderRadius: '16px', padding: '24px',
                transition: 'border-color 0.2s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: provider.color, flexShrink: 0 }} />
                      <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem' }}>{provider.name}</h3>
                      {conn && (
                        <span style={{
                          background: '#10b98120', color: '#10b981',
                          borderRadius: '6px', padding: '2px 8px',
                          fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                        }}>
                          Verbunden
                        </span>
                      )}
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>{provider.desc}</p>
                    {conn && (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '6px' }}>
                        Verbunden seit {new Date(conn.connected_at).toLocaleDateString('de-DE')}
                      </p>
                    )}
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    {provider.manual ? (
                      // Stripe Terminal: Link zu Docs
                      <a
                        href={provider.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block', padding: '9px 18px', borderRadius: '10px',
                          border: `1.5px solid ${provider.color}`,
                          background: 'transparent', color: provider.color,
                          fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                          textDecoration: 'none',
                        }}
                      >
                        Einrichten →
                      </a>
                    ) : conn ? (
                      <button
                        onClick={() => disconnect(provider.id)}
                        disabled={isConnecting}
                        style={{
                          padding: '9px 18px', borderRadius: '10px',
                          border: '1.5px solid #ef444444',
                          background: 'transparent', color: '#ef4444',
                          fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                          opacity: isConnecting ? 0.6 : 1,
                        }}
                      >
                        {isConnecting ? 'Trennen...' : 'Trennen'}
                      </button>
                    ) : (
                      <button
                        onClick={() => connectProvider(provider.id)}
                        style={{
                          padding: '9px 18px', borderRadius: '10px',
                          border: 'none',
                          background: provider.color, color: '#fff',
                          fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                        }}
                      >
                        Verbinden
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Hinweis Bareinnahmen */}
        <div style={{
          marginTop: '24px', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: '16px', padding: '20px 24px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>
                Bareinnahmen
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Trage Barzahlungen manuell in der Statistik ein.
              </p>
            </div>
            <button
              onClick={() => router.push('/admin/stats')}
              style={{
                padding: '9px 18px', borderRadius: '10px',
                border: '1.5px solid var(--border)',
                background: 'transparent', color: 'var(--text)',
                fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
              }}
            >
              Zur Statistik →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
      <IntegrationsContent />
    </Suspense>
  )
}
