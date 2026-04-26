'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Restaurant } from '@/types/database'
import { Suspense } from 'react'
import { Bot, Globe, BookOpen, ChevronUp, ChevronDown, Lightbulb, AlertTriangle } from 'lucide-react'

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
  // KI-Einstellungen
  const [aiKey, setAiKey] = useState('')
  const [aiKeyMasked, setAiKeyMasked] = useState<string | null>(null)
  const [aiKeyEditing, setAiKeyEditing] = useState(false)
  const [aiKeySaving, setAiKeySaving] = useState(false)
  const [aiGuideOpen, setAiGuideOpen] = useState(false)
  const [autoTranslate, setAutoTranslate] = useState(true)

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

      // KI-Key: nur prüfen ob gesetzt, nie den echten Key laden
      if (resto.anthropic_api_key) {
        setAiKeyMasked(resto.anthropic_api_key.slice(0, 10) + '••••••••••••••')
      }
      setAutoTranslate(resto.auto_translate_enabled !== false)
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

  async function saveAiKey() {
    if (!restaurant || !aiKey.trim()) return
    setAiKeySaving(true)
    await supabase.from('restaurants').update({ anthropic_api_key: aiKey.trim() }).eq('id', restaurant.id)
    setAiKeyMasked(aiKey.trim().slice(0, 10) + '••••••••••••••')
    setAiKey('')
    setAiKeyEditing(false)
    setAiKeySaving(false)
  }

  async function removeAiKey() {
    if (!restaurant || !confirm('API Key wirklich entfernen? Die KI-Features werden deaktiviert.')) return
    await supabase.from('restaurants').update({ anthropic_api_key: null }).eq('id', restaurant.id)
    setAiKeyMasked(null)
    setAiKeyEditing(false)
    setAiKey('')
  }

  async function toggleAutoTranslate() {
    if (!restaurant) return
    const next = !autoTranslate
    setAutoTranslate(next)
    await supabase.from('restaurants').update({ auto_translate_enabled: next }).eq('id', restaurant.id)
  }

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

        {/* KI-Assistent */}
        {restaurant && (restaurant.plan === 'pro' || restaurant.plan === 'enterprise' || restaurant.plan === 'trial') && (
          <div style={{
            marginTop: '24px', background: 'var(--surface)',
            border: `1px solid ${aiKeyMasked ? '#6c63ff44' : 'var(--border)'}`,
            borderRadius: '16px', padding: '24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6c63ff' }} />
              <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Bot size={16} /> KI-Assistent</h3>
              {restaurant.plan === 'enterprise' ? (
                <span style={{ background: '#6c63ff20', color: '#a78bfa', borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  Enterprise — aktiv
                </span>
              ) : aiKeyMasked ? (
                <span style={{ background: '#10b98120', color: '#10b981', borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  Aktiv
                </span>
              ) : (
                <span style={{ background: '#f59e0b20', color: '#f59e0b', borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  Key fehlt
                </span>
              )}
            </div>

            {restaurant.plan === 'enterprise' ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                Im Enterprise-Plan ist die KI automatisch aktiv — du musst nichts einrichten.
                Menü-Assistent für Gäste und Bestandsanalyse im Admin sind sofort verfügbar.
              </p>
            ) : restaurant.plan === 'trial' ? (
              <>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '16px' }}>
                  Im Trial kannst du alle KI-Features mit deinem eigenen Anthropic API Key testen.
                  Nach dem Upgrade auf Pro läuft alles genauso weiter.
                </p>
                {!aiKeyEditing && aiKeyMasked ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <code style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 14px', color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                      {aiKeyMasked}
                    </code>
                    <button onClick={() => setAiKeyEditing(true)} style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 14px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                      Ändern
                    </button>
                    <button onClick={removeAiKey} style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef444433', borderRadius: '8px', padding: '7px 14px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                      Entfernen
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <input
                      type="password"
                      value={aiKey}
                      onChange={e => setAiKey(e.target.value)}
                      placeholder="sk-ant-api03-..."
                      style={{ flex: 1, minWidth: '220px', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'monospace' }}
                    />
                    <button
                      onClick={saveAiKey}
                      disabled={aiKeySaving || !aiKey.trim()}
                      style={{ background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', opacity: aiKeySaving || !aiKey.trim() ? 0.5 : 1 }}
                    >
                      {aiKeySaving ? 'Speichert...' : 'Speichern'}
                    </button>
                    {aiKeyEditing && (
                      <button onClick={() => { setAiKeyEditing(false); setAiKey('') }} style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 14px', fontSize: '0.82rem', cursor: 'pointer' }}>
                        Abbrechen
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '16px' }}>
                  Im Pro-Plan benötigst du einen eigenen KI-API Key. Du zahlst direkt beim Anbieter —
                  ca. <strong style={{ color: 'var(--text)' }}>0,001€ pro Chat-Anfrage</strong> (5€ Guthaben ≈ 5.000 Gäste-Chats).
                </p>

                {/* Key-Eingabe */}
                {!aiKeyEditing && aiKeyMasked ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <code style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 14px', color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                      {aiKeyMasked}
                    </code>
                    <button onClick={() => setAiKeyEditing(true)} style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 14px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                      Ändern
                    </button>
                    <button onClick={removeAiKey} style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef444433', borderRadius: '8px', padding: '7px 14px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                      Entfernen
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <input
                      type="password"
                      value={aiKey}
                      onChange={e => setAiKey(e.target.value)}
                      placeholder="sk-ant-api03-..."
                      style={{ flex: 1, minWidth: '220px', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'monospace' }}
                    />
                    <button
                      onClick={saveAiKey}
                      disabled={aiKeySaving || !aiKey.trim()}
                      style={{ background: 'var(--accent)', color: 'var(--accent-text)', border: 'none', borderRadius: '8px', padding: '9px 18px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', opacity: aiKeySaving || !aiKey.trim() ? 0.5 : 1 }}
                    >
                      {aiKeySaving ? 'Speichert...' : 'Speichern'}
                    </button>
                    {aiKeyEditing && (
                      <button onClick={() => { setAiKeyEditing(false); setAiKey('') }} style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 14px', fontSize: '0.82rem', cursor: 'pointer' }}>
                        Abbrechen
                      </button>
                    )}
                  </div>
                )}

                {/* Auto-Übersetzung Toggle */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', borderRadius: '12px',
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  marginBottom: '16px',
                }}>
                  <div>
                    <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.88rem', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Globe size={14} /> Menü-Übersetzung
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Namen & Beschreibungen automatisch übersetzen beim Speichern
                    </p>
                  </div>
                  <button
                    onClick={toggleAutoTranslate}
                    style={{
                      width: '44px', height: '24px', borderRadius: '12px',
                      border: 'none', cursor: 'pointer', flexShrink: 0,
                      background: autoTranslate ? 'var(--accent)' : 'var(--border)',
                      position: 'relative', transition: 'background 0.2s',
                    }}
                    aria-label="Auto-Übersetzung umschalten"
                  >
                    <span style={{
                      position: 'absolute', top: '3px',
                      left: autoTranslate ? '23px' : '3px',
                      width: '18px', height: '18px', borderRadius: '50%',
                      background: '#fff', transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>

                {/* Anleitung */}
                <button
                  onClick={() => setAiGuideOpen(o => !o)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <BookOpen size={14} /> Anleitung: KI-API Key einrichten {aiGuideOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {aiGuideOpen && (
                  <div style={{ marginTop: '14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {[
                        { step: '1', text: 'Gehe zu', link: 'https://console.anthropic.com', linkText: 'console.anthropic.com' },
                        { step: '2', text: 'Erstelle einen Account (private E-Mail reicht aus, kein Gewerbe nötig)' },
                        { step: '3', text: 'Klicke oben rechts auf "API Keys"' },
                        { step: '4', text: 'Klicke auf "+ Create Key", gib einen Namen ein (z.B. "RestaurantOS") und kopiere den Key — er wird nur einmal angezeigt!' },
                        { step: '5', text: 'Lade dein Guthaben unter "Billing → Add Credits" auf — empfohlen: 5€ (reicht für ~5.000 Gäste-Chats)' },
                        { step: '6', text: 'Füge den Key oben ein und klicke auf "Speichern"' },
                      ].map(item => (
                        <div key={item.step} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                            {item.step}
                          </div>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
                            {item.text}
                            {item.link && (
                              <> <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>{item.linkText}</a></>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
                      <div style={{ background: '#14532d22', border: '1px solid #14532d44', borderRadius: '8px', padding: '10px 14px' }}>
                        <p style={{ color: '#4ade80', fontSize: '0.8rem', fontWeight: 700, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}><Lightbulb size={12} /> Kosten</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>~0,001€ pro Anfrage · 5€ ≈ 5.000 Chats</p>
                      </div>
                      <div style={{ background: '#45091422', border: '1px solid #45091444', borderRadius: '8px', padding: '10px 14px' }}>
                        <p style={{ color: '#f87171', fontSize: '0.8rem', fontWeight: 700, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> Sicherheit</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Teile deinen Key mit niemandem — er gibt Zugriff auf deinen KI-Account.</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

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
