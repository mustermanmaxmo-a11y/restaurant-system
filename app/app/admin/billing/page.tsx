'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Restaurant } from '@/types/database'

const PLAN_LABELS: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
}

export default function BillingPage() {
  const router = useRouter()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }
      const { data: resto } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', session.user.id)
        .limit(1)
        .single()
      if (!resto) { router.push('/admin/setup'); return }
      setRestaurant(resto)
      setLoading(false)
    }
    load()
  }, [router])

  async function openPortal() {
    if (!restaurant?.stripe_customer_id) return
    setRedirecting(true)
    setError(null)
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession?.access_token ?? ''}`,
        },
        body: JSON.stringify({ return_url: window.location.href }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError('Portal konnte nicht geöffnet werden.')
        setRedirecting(false)
      }
    } catch {
      setError('Verbindungsfehler. Bitte erneut versuchen.')
      setRedirecting(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Lädt...</p>
    </div>
  )

  const hasSubscription = !!restaurant?.stripe_customer_id

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '1.2rem' }}>←</button>
        <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>Abrechnung & Abo</h1>
      </div>

      <div style={{ padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }}>
        {/* Plan Card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Aktueller Plan</p>
              <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.5rem' }}>
                {restaurant ? PLAN_LABELS[restaurant.plan] ?? restaurant.plan : '—'}
              </p>
            </div>
            <div style={{
              background: restaurant?.active ? '#ecfdf5' : '#fef2f2',
              color: restaurant?.active ? '#10b981' : '#ef4444',
              fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px', borderRadius: '20px',
            }}>
              {restaurant?.active ? 'Aktiv' : 'Inaktiv'}
            </div>
          </div>

          {hasSubscription ? (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
                Verwalte dein Abo, ändere den Plan, aktualisiere die Zahlungsmethode oder kündige im Stripe-Kundenportal.
              </p>
              {error && (
                <p style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '12px' }}>{error}</p>
              )}
              <button
                onClick={openPortal}
                disabled={redirecting}
                style={{
                  width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                  background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '0.95rem',
                  cursor: redirecting ? 'not-allowed' : 'pointer', opacity: redirecting ? 0.7 : 1,
                }}
              >
                {redirecting ? 'Öffne Portal...' : '💳 Abo verwalten'}
              </button>
            </>
          ) : (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
                Du hast noch kein aktives Abonnement. Wähle einen Plan, um alle Features freizuschalten.
              </p>
              <button
                onClick={() => router.push('/admin/setup')}
                style={{
                  width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                  background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
                }}
              >
                Plan auswählen →
              </button>
            </>
          )}
        </div>

        {/* Info */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Restaurant</p>
          <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>{restaurant?.name}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{restaurant?.slug}.restaurantos.de</p>
        </div>
      </div>
    </div>
  )
}
