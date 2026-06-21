'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Restaurant } from '@/types/database'
import { useLanguage } from '@/components/providers/language-provider'
import { getPlanLimits, PLAN_DISPLAY_NAMES, getTrialDaysLeft, isTrialExpired } from '@/lib/plan-limits'
import { TrialBanner } from '@/components/TrialBanner'
import type { RestaurantPlan } from '@/types/database'
import { CreditCard, Check, X, Star } from 'lucide-react'

const STARTER_FEATURES: [string, boolean][] = [
  ['Bis 15 Tische', true],
  ['Speisekarte + QR-Bestellung', true],
  ['Realtime Bestellstatus', true],
  ['3 Mitarbeiter', true],
  ['Bestellanalyse (7 Tage)', true],
  ['KI-Assistent', false],
  ['Reservierungen', false],
  ['Individuelles Branding', false],
]

const PRO_FEATURES = [
  'Unbegrenzte Tische',
  'Unbegrenzte Mitarbeiter',
  'KI-Menüassistent',
  'Reservierungen',
  'Branding (Logo + Farben)',
  'Vollständige Bestellanalyse',
  'Tagesgerichte & Specials',
  'KI-Schichtplanung',
]

const ENTERPRISE_FEATURES = [
  'Alles aus Professional',
  'Mehrere Standorte',
  'POS-Integration',
  'API-Zugang',
  'Persönlicher Support',
]

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
      const { data: resto } = await supabase.from('restaurants').select('*').eq('owner_id', session.user.id).limit(1).single()
      if (!resto) { router.push('/admin/setup'); return }
      setRestaurant(resto)
      setLoading(false)
    }
    load()
  }, [router])

  async function openPortal() {
    if (!restaurant?.stripe_customer_id) return
    setRedirecting(true); setError(null)
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authSession?.access_token ?? ''}` },
        body: JSON.stringify({ return_url: window.location.href }),
      })
      const data = await res.json()
      if (data.url) { window.location.href = data.url }
      else { setError('Portal konnte nicht geöffnet werden.'); setRedirecting(false) }
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
  const currentPlan = restaurant?.plan ?? 'starter'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Page header */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '14px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10,
        flexWrap: 'wrap', gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#e879f918', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CreditCard size={18} color="#e879f9" />
          </div>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1 }}>Abrechnung</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1px' }}>Plan & Zahlungen</p>
          </div>
        </div>
        {hasSubscription && (
          <span style={{
            background: restaurant?.active ? '#10b98118' : '#ef444418',
            color: restaurant?.active ? '#10b981' : '#ef4444',
            border: `1px solid ${restaurant?.active ? '#10b98133' : '#ef444433'}`,
            fontSize: '0.72rem', fontWeight: 700,
            padding: '4px 12px', borderRadius: '20px',
          }}>
            {restaurant?.active ? 'Aktiv' : 'Inaktiv'}
          </span>
        )}
      </div>

      <div style={{ padding: '16px 20px 40px', maxWidth: '840px', margin: '0 auto' }}>
        {restaurant && <TrialBanner plan={restaurant.plan as RestaurantPlan} trialEndsAt={restaurant.trial_ends_at} />}

        {/* Current plan card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '22px', marginBottom: '24px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Aktueller Plan</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: hasSubscription ? '16px' : 0 }}>
            <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-0.02em' }}>{planName}</p>
            <span style={{
              background: restaurant?.active ? '#10b98118' : '#ef444418',
              color: restaurant?.active ? '#10b981' : '#ef4444',
              border: `1px solid ${restaurant?.active ? '#10b98133' : '#ef444433'}`,
              fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px', borderRadius: '20px',
            }}>
              {restaurant?.active ? '● Aktiv' : '● Inaktiv'}
            </span>
          </div>

          {hasSubscription && (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', marginBottom: '16px', lineHeight: 1.5 }}>
                Verwalte dein Abo, ändere den Plan, aktualisiere die Zahlungsmethode oder kündige im Stripe-Kundenportal.
              </p>
              {error && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '12px' }}>{error}</p>}
              <button onClick={openPortal} disabled={redirecting} style={{
                width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
                background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 700, fontSize: '0.92rem',
                cursor: redirecting ? 'not-allowed' : 'pointer', opacity: redirecting ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}>
                <CreditCard size={16} />
                {redirecting ? 'Öffne Portal…' : 'Abo verwalten'}
              </button>
            </>
          )}
        </div>

        {/* Pricing cards */}
        <h2 style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>Pläne</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: '14px', marginBottom: '24px' }}>

          {/* Starter */}
          <div style={{
            background: 'var(--surface)',
            border: `2px solid ${currentPlan === 'starter' ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: '14px', padding: '22px',
          }}>
            <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.05rem', marginBottom: '4px' }}>Starter</p>
            <p style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1.7rem', marginBottom: '16px' }}>
              29€<span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)' }}>/Monat</span>
            </p>
            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {STARTER_FEATURES.map(([label, included]) => (
                <li key={label} style={{ display: 'flex', alignItems: 'center', gap: '7px', color: included ? 'var(--text)' : 'var(--text-muted)', fontSize: '0.82rem' }}>
                  {included
                    ? <Check size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
                    : <X size={13} style={{ flexShrink: 0, opacity: 0.4 }} />
                  }
                  {label}
                </li>
              ))}
            </ul>
            {currentPlan === 'starter'
              ? <div style={{ textAlign: 'center', color: 'var(--accent)', fontWeight: 700, fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}><Check size={14} /> Aktueller Plan</div>
              : <button onClick={() => handleSelectPlan('starter')} disabled={planLoading} style={{ width: '100%', padding: '10px', borderRadius: '9px', border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 700, cursor: 'pointer', opacity: planLoading ? 0.6 : 1 }}>
                  {planLoading ? '…' : 'Starter wählen'}
                </button>
            }
          </div>

          {/* Professional */}
          <div style={{
            background: 'var(--surface)',
            border: `2px solid ${currentPlan === 'pro' ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: '14px', padding: '22px', position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)',
              background: 'var(--accent)', color: 'var(--accent-text)',
              fontSize: '0.66rem', fontWeight: 700, padding: '3px 12px', borderRadius: '20px', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              <Star size={9} /> Empfohlen
            </div>
            <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.05rem', marginBottom: '4px' }}>Professional</p>
            <p style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1.7rem', marginBottom: '16px' }}>
              59€<span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)' }}>/Monat</span>
            </p>
            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {PRO_FEATURES.map(label => (
                <li key={label} style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text)', fontSize: '0.82rem' }}>
                  <Check size={13} color="var(--accent)" style={{ flexShrink: 0 }} />{label}
                </li>
              ))}
            </ul>
            {currentPlan === 'pro'
              ? <div style={{ textAlign: 'center', color: 'var(--accent)', fontWeight: 700, fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}><Check size={14} /> Aktueller Plan</div>
              : <button onClick={() => handleSelectPlan('pro')} disabled={planLoading} style={{ width: '100%', padding: '10px', borderRadius: '9px', border: 'none', background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 700, cursor: 'pointer', opacity: planLoading ? 0.6 : 1 }}>
                  {planLoading ? '…' : 'Professional wählen'}
                </button>
            }
          </div>

          {/* Enterprise */}
          <div style={{ background: 'var(--surface)', border: '2px solid var(--border)', borderRadius: '14px', padding: '22px' }}>
            <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.05rem', marginBottom: '4px' }}>Enterprise</p>
            <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.7rem', marginBottom: '16px' }}>Individuell</p>
            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {ENTERPRISE_FEATURES.map(label => (
                <li key={label} style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text)', fontSize: '0.82rem' }}>
                  <Check size={13} color="#a78bfa" style={{ flexShrink: 0 }} />{label}
                </li>
              ))}
            </ul>
            <a href="mailto:hello@restaurantos.de" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '10px', borderRadius: '9px',
              border: '1.5px solid var(--border)', color: 'var(--text)',
              fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none',
            }}>
              Kontakt aufnehmen
            </a>
          </div>
        </div>

        {/* Restaurant info */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 18px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Restaurant</p>
          <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.92rem', marginBottom: '2px' }}>{restaurant?.name}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{restaurant?.slug}.restaurantos.de</p>
        </div>
      </div>
    </div>
  )
}
