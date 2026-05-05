'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Building2, Plus, Settings, LogOut, TrendingUp, ShoppingBag } from 'lucide-react'

interface Agency {
  id: string
  name: string
  slug: string
  wholesale_price_cents: number
}

interface AgencyBranding {
  logo_url: string | null
  primary_color: string
  accent_color: string
  domain: string | null
}

interface ClientRestaurant {
  id: string
  name: string
  slug: string
  plan: string
  active: boolean
  created_at: string
}

export default function AgencyPortalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [agency, setAgency] = useState<Agency | null>(null)
  const [branding, setBranding] = useState<AgencyBranding | null>(null)
  const [restaurants, setRestaurants] = useState<ClientRestaurant[]>([])
  const [tab, setTab] = useState<'clients' | 'branding' | 'billing'>('clients')

  // Branding edit state
  const [brandingEdits, setBrandingEdits] = useState<AgencyBranding>({ logo_url: null, primary_color: '#EA580C', accent_color: '#F5F5F7', domain: null })
  const [brandingSaving, setBrandingSaving] = useState(false)
  const [brandingSaved, setBrandingSaved] = useState(false)

  // New restaurant form
  const [showNewResto, setShowNewResto] = useState(false)
  const [newRestoName, setNewRestoName] = useState('')
  const [newRestoSlug, setNewRestoSlug] = useState('')
  const [newRestoCreating, setNewRestoCreating] = useState(false)
  const [newRestoError, setNewRestoError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }

      const { data: ag } = await supabase
        .from('agencies')
        .select('*')
        .eq('slug', slug)
        .eq('owner_id', session.user.id)
        .single()

      if (!ag) { router.push('/owner-login'); return }
      setAgency(ag as Agency)

      const [{ data: br }, { data: restos }] = await Promise.all([
        supabase.from('agency_branding').select('*').eq('agency_id', ag.id).single(),
        supabase.from('restaurants').select('id, name, slug, plan, active, created_at').eq('agency_id', ag.id).order('created_at', { ascending: false }),
      ])

      if (br) {
        setBranding(br as AgencyBranding)
        setBrandingEdits({ logo_url: br.logo_url, primary_color: br.primary_color, accent_color: br.accent_color, domain: br.domain })
      }
      setRestaurants((restos ?? []) as ClientRestaurant[])
      setLoading(false)
    }
    load()
  }, [slug, router])

  async function saveBranding() {
    if (!agency) return
    setBrandingSaving(true)
    await supabase.from('agency_branding').upsert({ agency_id: agency.id, ...brandingEdits, updated_at: new Date().toISOString() }, { onConflict: 'agency_id' })
    setBranding(brandingEdits)
    setBrandingSaving(false)
    setBrandingSaved(true)
    setTimeout(() => setBrandingSaved(false), 2500)
  }

  async function createRestaurant() {
    if (!agency || !newRestoName.trim() || !newRestoSlug.trim()) return
    setNewRestoCreating(true)
    setNewRestoError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const slugVal = newRestoSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const { data, error } = await supabase.from('restaurants').insert({
      name: newRestoName.trim(),
      slug: slugVal,
      owner_id: session.user.id,
      agency_id: agency.id,
      plan: 'trial',
      active: true,
    }).select('id, name, slug, plan, active, created_at').single()

    if (error) { setNewRestoError(error.message); setNewRestoCreating(false); return }
    setRestaurants(prev => [data as ClientRestaurant, ...prev])
    setShowNewResto(false)
    setNewRestoName('')
    setNewRestoSlug('')
    setNewRestoCreating(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Lädt…</p>
    </div>
  )

  if (!agency) return null

  const activeRestos = restaurants.filter(r => r.active)
  const monthlyRevenue = activeRestos.length * (agency.wholesale_price_cents / 100)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        {branding?.logo_url ? (
          <img src={branding.logo_url} alt={agency.name} style={{ height: '32px', objectFit: 'contain' }} />
        ) : (
          <Building2 size={20} color={branding?.primary_color ?? 'var(--accent)'} />
        )}
        <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem', flex: 1 }}>{agency.name} Portal</h1>
        <button onClick={() => supabase.auth.signOut().then(() => router.push('/owner-login'))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <LogOut size={18} />
        </button>
      </div>

      <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Building2 size={14} color="var(--accent)" />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>Restaurants</span>
            </div>
            <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.5rem' }}>{activeRestos.length}</p>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <TrendingUp size={14} color="var(--accent)" />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>Monat (Großhandel)</span>
            </div>
            <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.5rem' }}>{monthlyRevenue.toFixed(0)} €</p>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <ShoppingBag size={14} color="var(--accent)" />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>Pro Restaurant</span>
            </div>
            <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.5rem' }}>{(agency.wholesale_price_cents / 100).toFixed(0)} €</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--surface)', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
          {([{ key: 'clients', label: 'Restaurants' }, { key: 'branding', label: 'Branding' }, { key: 'billing', label: 'Billing' }] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '8px 16px', borderRadius: '9px', border: 'none', background: tab === t.key ? 'var(--accent)' : 'transparent', color: tab === t.key ? '#fff' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'clients' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button onClick={() => setShowNewResto(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--accent)', border: 'none', borderRadius: '10px', padding: '9px 16px', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                <Plus size={14} /> Neues Restaurant
              </button>
            </div>

            {restaurants.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Noch keine Restaurants. Lege dein erstes Kunden-Restaurant an.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {restaurants.map(resto => (
                  <div key={resto.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <p style={{ color: 'var(--text)', fontWeight: 700, margin: 0 }}>{resto.name}</p>
                        <span style={{ background: resto.active ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: resto.active ? '#22c55e' : '#6b7280', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px' }}>
                          {resto.active ? 'Aktiv' : 'Inaktiv'} · {resto.plan}
                        </span>
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>/{resto.slug}</p>
                    </div>
                    <button onClick={() => router.push('/admin')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 12px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
                      <Settings size={13} /> Dashboard
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'branding' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
            <h2 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '20px', fontSize: '1rem' }}>Agentur-Branding</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Logo URL</label>
                <input value={brandingEdits.logo_url ?? ''} onChange={e => setBrandingEdits(prev => ({ ...prev, logo_url: e.target.value || null }))} placeholder="https://..." style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Primärfarbe</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="color" value={brandingEdits.primary_color} onChange={e => setBrandingEdits(prev => ({ ...prev, primary_color: e.target.value }))} style={{ width: '40px', height: '36px', borderRadius: '6px', border: 'none', cursor: 'pointer' }} />
                    <input value={brandingEdits.primary_color} onChange={e => setBrandingEdits(prev => ({ ...prev, primary_color: e.target.value }))} style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Akzentfarbe</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="color" value={brandingEdits.accent_color} onChange={e => setBrandingEdits(prev => ({ ...prev, accent_color: e.target.value }))} style={{ width: '40px', height: '36px', borderRadius: '6px', border: 'none', cursor: 'pointer' }} />
                    <input value={brandingEdits.accent_color} onChange={e => setBrandingEdits(prev => ({ ...prev, accent_color: e.target.value }))} style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none' }} />
                  </div>
                </div>
              </div>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Custom Domain (CNAME)</label>
                <input value={brandingEdits.domain ?? ''} onChange={e => setBrandingEdits(prev => ({ ...prev, domain: e.target.value || null }))} placeholder="bestellungen.meine-agentur.de" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <button onClick={saveBranding} disabled={brandingSaving} style={{ background: brandingSaved ? '#22c55e' : 'var(--accent)', border: 'none', borderRadius: '10px', padding: '11px 20px', color: '#fff', fontWeight: 700, cursor: brandingSaving ? 'wait' : 'pointer', alignSelf: 'flex-start', fontSize: '0.875rem' }}>
                {brandingSaving ? 'Speichert…' : brandingSaved ? '✓ Gespeichert' : 'Branding speichern'}
              </button>
            </div>
          </div>
        )}

        {tab === 'billing' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
            <h2 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: '16px', fontSize: '1rem' }}>Billing-Übersicht</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {restaurants.filter(r => r.active).map(resto => (
                <div key={resto.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{resto.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{(agency.wholesale_price_cents / 100).toFixed(2)} € / Monat</span>
                </div>
              ))}
              {restaurants.filter(r => r.active).length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px' }}>
                  <span style={{ color: 'var(--text)', fontWeight: 700 }}>Gesamt</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 800 }}>{monthlyRevenue.toFixed(2)} € / Monat</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Restaurant Modal */}
      {showNewResto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px', padding: '28px', maxWidth: '420px', width: '100%' }}>
            <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '20px' }}>Neues Restaurant anlegen</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Restaurantname</label>
                <input value={newRestoName} onChange={e => { setNewRestoName(e.target.value); setNewRestoSlug(e.target.value.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').slice(0, 30)) }} placeholder="Pizzeria Roma" autoFocus style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>URL-Slug</label>
                <input value={newRestoSlug} onChange={e => setNewRestoSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="pizzeria-roma" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>bestell.link/{newRestoSlug}</p>
              </div>
              {newRestoError && <p style={{ color: '#ef4444', fontSize: '0.82rem' }}>{newRestoError}</p>}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowNewResto(false); setNewRestoName(''); setNewRestoSlug(''); setNewRestoError('') }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 16px', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>Abbrechen</button>
                <button onClick={createRestaurant} disabled={newRestoCreating || !newRestoName.trim() || !newRestoSlug.trim()} style={{ background: 'var(--accent)', border: 'none', borderRadius: '10px', padding: '10px 20px', color: '#fff', fontWeight: 700, cursor: newRestoCreating ? 'wait' : 'pointer', fontSize: '0.875rem' }}>
                  {newRestoCreating ? 'Erstelle…' : 'Anlegen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
