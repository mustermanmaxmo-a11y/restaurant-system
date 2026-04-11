'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Restaurant } from '@/types/database'
import { useLanguage } from '@/components/providers/language-provider'
import { getPlanLimits, PLAN_DISPLAY_NAMES, getTrialDaysLeft, isTrialExpired } from '@/lib/plan-limits'
import { TrialBanner } from '@/components/TrialBanner'
import type { RestaurantPlan } from '@/types/database'

export default function BillingPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)
  const [planLoading, setPlanLoading] = useState(false)
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

  async function handleSelectPlan(plan: 'starter' | 'pro') {
    setPlanLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ plan }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setPlanLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
    </div>
  )

  const hasSubscription = !!restaurant?.stripe_subscription_id
  const planName = restaurant ? (PLAN_DISPLAY_NAMES[restaurant.plan as RestaurantPlan] ?? restaurant.plan) : '—'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '1.2rem' }}>←</button>
        <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>Abrechnung & Abo</h1>
      </div>

      <div style={{ padding: '32px 24px', maxWidth: '800px', margin: '0 auto' }}>
        {/* Trial Banner */}
        {restaurant && (
          <TrialBanner plan={restaurant.plan as RestaurantPlan} trialEndsAt={restaurant.trial_ends_at} />
        )}

        {/* Current Plan Card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Aktueller Plan</p>
              <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.5rem' }}>{planName}</p>
            </div>
            <div style={{
              background: restaurant?.active ? '#ecfdf5' : '#fef2f2',
              color: restaurant?.active ? '#10b981' : '#ef4444',
              fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px', borderRadius: '20px',
            }}>
              {restaurant?.active ? 'Aktiv' : 'Inaktiv'}
            </div>
          </div>

          {hasSubscription && (
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
          )}
        </div>

        {/* Pricing Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>

          {/* Starter */}
          <div style={{
            background: 'var(--surface)', border: `2px solid ${restaurant?.plan === 'starter' ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: '16px', padding: '24px',
          }}>
            <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '4px' }}>Starter</p>
            <p style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1.8rem', marginBottom: '4px' }}>29€<span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-muted)' }}>/Monat</span></p>
            <ul style={{ color: 'var(--text-muted)', fontSize: '0.8rem', listStyle: 'none', padding: 0, marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>✓ Bis 15 Tische</li>
              <li>✓ Speisekarte + QR-Bestellung</li>
              <li>✓ Realtime Bestellstatus</li>
              <li>✓ 3 Mitarbeiter</li>
              <li>✓ Bestellanalyse (7 Tage)</li>
              <li style={{ color: 'var(--border)' }}>✗ KI-Assistent</li>
              <li style={{ color: 'var(--border)' }}>✗ Reservierungen</li>
              <li style={{ color: 'var(--border)' }}>✗ Branding</li>
            </ul>
            {restaurant?.plan === 'starter' ? (
              <div style={{ textAlign: 'center', color: 'var(--accent)', fontWeight: 700, fontSize: '0.85rem' }}>✓ Aktueller Plan</div>
            ) : (
              <button onClick={() => handleSelectPlan('starter')} disabled={planLoading} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: planLoading ? 0.6 : 1 }}>
                {planLoading ? '...' : 'Starter wählen'}
              </button>
            )}
          </div>

          {/* Professional */}
          <div style={{
            background: 'var(--surface)', border: `2px solid ${restaurant?.plan === 'pro' ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: '16px', padding: '24px', position: 'relative',
          }}>
            <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
              Empfohlen
            </div>
            <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '4px' }}>Professional</p>
            <p style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1.8rem', marginBottom: '4px' }}>59€<span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-muted)' }}>/Monat</span></p>
            <ul style={{ color: 'var(--text-muted)', fontSize: '0.8rem', listStyle: 'none', padding: 0, marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>✓ Unbegrenzte Tische</li>
              <li>✓ Unbegrenzte Mitarbeiter</li>
              <li>✓ KI-Menüassistent</li>
              <li>✓ Reservierungen</li>
              <li>✓ Branding (Logo + Farben)</li>
              <li>✓ Vollständige Bestellanalyse</li>
              <li>✓ Tagesgerichte & Specials</li>
            </ul>
            {restaurant?.plan === 'pro' ? (
              <div style={{ textAlign: 'center', color: 'var(--accent)', fontWeight: 700, fontSize: '0.85rem' }}>✓ Aktueller Plan</div>
            ) : (
              <button onClick={() => handleSelectPlan('pro')} disabled={planLoading} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: planLoading ? 0.6 : 1 }}>
                {planLoading ? '...' : 'Professional wählen'}
              </button>
            )}
          </div>

          {/* Enterprise */}
          <div style={{
            background: 'var(--surface)', border: '2px solid var(--border)',
            borderRadius: '16px', padding: '24px',
          }}>
            <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.1rem', marginBottom: '4px' }}>Enterprise</p>
            <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.8rem', marginBottom: '4px' }}>Individuell</p>
            <ul style={{ color: 'var(--text-muted)', fontSize: '0.8rem', listStyle: 'none', padding: 0, marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>✓ Alles aus Professional</li>
              <li>✓ Mehrere Standorte</li>
              <li>✓ POS-Integration</li>
              <li>✓ API-Zugang</li>
              <li>✓ Persönlicher Support</li>
            </ul>
            <a href="mailto:hello@restaurantos.de" style={{ display: 'block', textAlign: 'center', padding: '10px', borderRadius: '10px', border: '1.5px solid var(--border)', color: 'var(--text)', fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none' }}>
              Kontakt aufnehmen
            </a>
          </div>
        </div>

        {/* Restaurant Info */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Restaurant</p>
          <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>{restaurant?.name}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{restaurant?.slug}.restaurantos.de</p>
        </div>
      </div>
    </div>
  )
}
