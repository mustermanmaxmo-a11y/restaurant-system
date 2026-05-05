'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Building2, TrendingUp, ShoppingBag, AlertTriangle, ArrowRight } from 'lucide-react'

interface LocationSummary {
  id: string
  name: string
  slug: string
  plan: string
  active: boolean
  revenue7d: number
  orders7d: number
  avgOrderValue: number
  hasAlert: boolean
}

export default function OverviewPage() {
  const router = useRouter()
  const [locations, setLocations] = useState<LocationSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }

      const { data: restaurants } = await supabase
        .from('restaurants')
        .select('id, name, slug, plan, active')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: true })

      if (!restaurants || restaurants.length === 0) {
        router.push('/admin')
        return
      }

      if (restaurants.length === 1) {
        router.push('/admin')
        return
      }

      const weekAgo = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString()

      const summaries = await Promise.all(restaurants.map(async (resto) => {
        const [{ data: orders }, { data: lowStock }] = await Promise.all([
          supabase
            .from('orders')
            .select('total')
            .eq('restaurant_id', resto.id)
            .neq('status', 'cancelled')
            .gte('created_at', weekAgo),
          supabase
            .from('menu_items')
            .select('id')
            .eq('restaurant_id', resto.id)
            .eq('available', true)
            .not('stock_count', 'is', null)
            .lte('stock_count', 3)
            .limit(1),
        ])

        const revenue7d = (orders ?? []).reduce((s, o) => s + (o.total ?? 0), 0)
        const orders7d = orders?.length ?? 0
        const avgOrderValue = orders7d > 0 ? revenue7d / orders7d : 0

        return {
          id: resto.id,
          name: resto.name,
          slug: resto.slug,
          plan: resto.plan,
          active: resto.active,
          revenue7d,
          orders7d,
          avgOrderValue,
          hasAlert: (lowStock?.length ?? 0) > 0,
        }
      }))

      setLocations(summaries)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Lädt…</p>
    </div>
  )

  const totalRevenue = locations.reduce((s, l) => s + l.revenue7d, 0)
  const totalOrders = locations.reduce((s, l) => s + l.orders7d, 0)
  const alertCount = locations.filter(l => l.hasAlert).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Building2 size={20} color="var(--accent)" />
        <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem', flex: 1 }}>Alle Standorte</h1>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{locations.length} Standorte</span>
      </div>

      <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        {/* Aggregated KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '28px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <TrendingUp size={14} color="var(--accent)" />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>Umsatz (7T)</span>
            </div>
            <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.5rem' }}>{totalRevenue.toFixed(0)} €</p>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <ShoppingBag size={14} color="var(--accent)" />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>Bestellungen (7T)</span>
            </div>
            <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.5rem' }}>{totalOrders}</p>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Building2 size={14} color="var(--accent)" />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>Standorte</span>
            </div>
            <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.5rem' }}>{locations.length}</p>
          </div>
          {alertCount > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <AlertTriangle size={14} color="#ef4444" />
                <span style={{ color: '#ef4444', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>Alerts</span>
              </div>
              <p style={{ color: '#ef4444', fontWeight: 800, fontSize: '1.5rem' }}>{alertCount}</p>
            </div>
          )}
        </div>

        {/* Location cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {locations.map(loc => (
            <div
              key={loc.id}
              onClick={() => router.push(`/admin?restaurant=${loc.id}`)}
              style={{
                background: 'var(--surface)', border: `1px solid ${loc.hasAlert ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                borderRadius: '16px', padding: '20px 24px',
                display: 'flex', alignItems: 'center', gap: '16px',
                cursor: 'pointer', transition: 'border-color 0.2s',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: loc.hasAlert ? '#ef4444' : loc.orders7d > 0 ? '#22c55e' : '#6b7280' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem', margin: 0 }}>{loc.name}</p>
                  <span style={{ background: 'var(--bg)', color: 'var(--text-muted)', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}>{loc.plan}</span>
                  {loc.hasAlert && <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 700 }}>⚠ Bestand niedrig</span>}
                </div>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Umsatz: <strong style={{ color: 'var(--text)' }}>{loc.revenue7d.toFixed(0)} €</strong></span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Bestellungen: <strong style={{ color: 'var(--text)' }}>{loc.orders7d}</strong></span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Ø Wert: <strong style={{ color: 'var(--text)' }}>{loc.avgOrderValue.toFixed(0)} €</strong></span>
                </div>
              </div>
              <ArrowRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            </div>
          ))}
        </div>

        <button
          onClick={() => router.push('/admin')}
          style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 16px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          ← Zurück zum Dashboard
        </button>
      </div>
    </div>
  )
}
