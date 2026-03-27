'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Restaurant } from '@/types/database'

function AdminContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const welcome = searchParams.get('welcome') === 'true'
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }

      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', session.user.id)
        .limit(1)
        .single()

      if (!data) {
        router.push('/admin/setup')
        return
      }

      setRestaurant(data)
      setLoading(false)
    }
    load()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/owner-login')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <p style={{ color: 'var(--text-muted)' }}>Lädt...</p>
      </div>
    )
  }

  if (!restaurant) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '32px 24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700 }}>
              {restaurant.name}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>
              Plan:{' '}
              <span style={{ color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase' }}>
                {restaurant.plan}
              </span>
              {' · '}
              {restaurant.active ? (
                <span style={{ color: '#10b981' }}>● Aktiv</span>
              ) : (
                <span style={{ color: '#ef4444' }}>● Inaktiv</span>
              )}
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '8px 16px',
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Ausloggen
          </button>
        </div>

        {/* Welcome Banner */}
        {welcome && (
          <div style={{
            background: 'var(--accent-subtle)',
            border: '1px solid var(--border-accent)',
            borderRadius: '12px',
            padding: '20px 24px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <span style={{ fontSize: '2rem' }}>🎉</span>
            <div>
              <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '4px' }}>
                Willkommen bei RestaurantOS!
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Dein Restaurant ist eingerichtet. Leg jetzt dein Menü an und generiere QR-Codes.
              </p>
            </div>
          </div>
        )}

        {/* Inactive Banner */}
        {!restaurant.active && (
          <div style={{
            background: '#ef444415',
            border: '1px solid #ef444433',
            borderRadius: '12px',
            padding: '20px 24px',
            marginBottom: '24px',
          }}>
            <p style={{ color: '#ef4444', fontWeight: 700, marginBottom: '4px' }}>
              ⚠️ Abo noch nicht aktiv
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '12px' }}>
              Bitte schließe den Zahlungsvorgang ab um dein Restaurant zu aktivieren.
            </p>
            <button
              onClick={() => router.push('/admin/setup')}
              style={{
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 20px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Plan abschließen →
            </button>
          </div>
        )}

        {/* Navigation Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {[
            { icon: '🍔', label: 'Menü verwalten', href: '/admin/menu', available: true },
            { icon: '🪑', label: 'Tische & QR-Codes', href: '/admin/tables', available: true },
            { icon: '👨‍🍳', label: 'Staff verwalten', href: '/admin/staff', available: true },
            { icon: '📊', label: 'Analytics', href: '/admin/analytics', available: restaurant.plan === 'pro' },
            { icon: '💳', label: 'Billing', href: '/admin/billing', available: true },
          ].map(card => (
            <button
              key={card.label}
              onClick={() => card.available && router.push(card.href)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '24px 20px',
                textAlign: 'left',
                cursor: card.available ? 'pointer' : 'not-allowed',
                opacity: card.available ? 1 : 0.5,
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => card.available && (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div style={{ fontSize: '1.75rem', marginBottom: '10px' }}>{card.icon}</div>
              <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem' }}>{card.label}</div>
              {!card.available && (
                <div style={{ color: 'var(--accent)', fontSize: '0.7rem', marginTop: '4px', fontWeight: 600 }}>PRO</div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
      <AdminContent />
    </Suspense>
  )
}
