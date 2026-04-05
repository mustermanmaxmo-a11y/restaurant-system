'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Brain, ArrowRight } from 'lucide-react'
import type { Restaurant } from '@/types/database'

type Tab = 'schicht' | 'kosten' | 'vorbereitung'

const TABS: { id: Tab; label: string; desc: string }[] = [
  { id: 'schicht',      label: 'Schichtübergabe',   desc: 'KI-Übergabebericht generieren' },
  { id: 'kosten',       label: 'Kostenanalyse',      desc: 'Lieferanten & Margen vergleichen' },
  { id: 'vorbereitung', label: 'Vorbereitungsliste', desc: 'Mise en Place für heute/morgen' },
]

function KiToolsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const activeTab: Tab = (searchParams.get('tab') as Tab) || 'schicht'

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/owner-login'); return }
      supabase.from('restaurants').select('*').eq('owner_id', session.user.id).limit(1).maybeSingle()
        .then(({ data }) => {
          if (!data) { router.push('/admin/setup'); return }
          setRestaurant(data)
          setLoading(false)
        })
    })
  }, [router])

  function setTab(tab: Tab) {
    router.push(`/admin/ki-tools?tab=${tab}`)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <p style={{ color: 'var(--text-muted)' }}>Lädt...</p>
    </div>
  )

  if (!restaurant) return null

  const isPro = restaurant.plan === 'pro' || restaurant.plan === 'enterprise'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '32px 24px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={18} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>KI-Tools</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '28px', marginLeft: '48px' }}>
          KI-gestützte Analysen und Empfehlungen für deinen Restaurantbetrieb
        </p>

        {/* Plan gate */}
        {!isPro && (
          <div style={{ background: 'rgba(255,150,0,0.1)', border: '1px solid rgba(255,150,0,0.3)', borderRadius: '12px', padding: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: '#FF9500' }}>Pro-Plan erforderlich</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>KI-Features sind im Pro- und Enterprise-Plan verfügbar.</p>
            </div>
            <button onClick={() => router.push('/admin/billing')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FF9500', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
              Upgrade <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--surface)', borderRadius: '12px', padding: '4px', marginBottom: '28px' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              style={{
                flex: 1, padding: '10px 16px', border: 'none', borderRadius: '9px', cursor: 'pointer',
                background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: '0.85rem', transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'schicht' && <SchichtTab restaurant={restaurant} disabled={!isPro} />}
        {activeTab === 'kosten' && <KostenTab restaurant={restaurant} disabled={!isPro} />}
        {activeTab === 'vorbereitung' && <VorbereitungTab restaurant={restaurant} disabled={!isPro} />}
      </div>
    </div>
  )
}

// ── Placeholder tab components (filled in Tasks 5, 7, 9) ─────────────────────

function SchichtTab({ restaurant, disabled }: { restaurant: Restaurant; disabled: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Schichtübergabe wird in Task 5 implementiert.</p>
    </div>
  )
}

function KostenTab({ restaurant, disabled }: { restaurant: Restaurant; disabled: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Kostenanalyse wird in Task 7 implementiert.</p>
    </div>
  )
}

function VorbereitungTab({ restaurant, disabled }: { restaurant: Restaurant; disabled: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Vorbereitungsliste wird in Task 9 implementiert.</p>
    </div>
  )
}

export default function KiToolsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}><p style={{ color: 'var(--text-muted)' }}>Lädt...</p></div>}>
      <KiToolsContent />
    </Suspense>
  )
}
