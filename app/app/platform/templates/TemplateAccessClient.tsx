'use client'

import { useState, useEffect, useCallback } from 'react'
import { Layers, Search, Plus, Trash2, X, ChevronRight } from 'lucide-react'

type Restaurant = {
  id: string
  name: string
  slug: string
  plan: string
}

type Template = {
  id: string
  name: string
  slug: string
  category: string
  plan_tier: string
}

type GrantedTemplate = Template & {
  granted_by: string
  created_at: string
}

interface Props {
  restaurants: Restaurant[]
  allTemplates: Template[]
}

const PLAN_COLORS: Record<string, { bg: string; fg: string }> = {
  trial:      { bg: '#1e3a8a', fg: '#93c5fd' },
  starter:    { bg: '#065f46', fg: '#6ee7b7' },
  pro:        { bg: '#92400e', fg: '#fcd34d' },
  enterprise: { bg: '#581c87', fg: '#e9d5ff' },
}

const TIER_COLORS: Record<string, { bg: string; fg: string }> = {
  basic:     { bg: '#1e3a5f', fg: '#7dd3fc' },
  pro:       { bg: '#3b2a0e', fg: '#fbbf24' },
  premium:   { bg: '#2e1065', fg: '#c4b5fd' },
}

// Which plan_tiers a plan gives access to automatically
function planTiers(plan: string): string[] {
  switch (plan) {
    case 'trial':      return ['basic', 'pro']
    case 'starter':    return ['basic']
    case 'pro':        return ['basic', 'pro']
    case 'enterprise': return ['basic', 'pro', 'premium']
    default:           return []
  }
}

function PlanBadge({ plan }: { plan: string }) {
  const style = PLAN_COLORS[plan] ?? { bg: '#333', fg: '#ccc' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '8px',
      background: style.bg, color: style.fg,
      fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {plan}
    </span>
  )
}

function TierBadge({ tier }: { tier: string }) {
  const style = TIER_COLORS[tier] ?? { bg: '#333', fg: '#ccc' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '8px',
      background: style.bg, color: style.fg,
      fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {tier}
    </span>
  )
}

export default function TemplateAccessClient({ restaurants, allTemplates }: Props) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [granted, setGranted] = useState<GrantedTemplate[]>([])
  const [loadingGrants, setLoadingGrants] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null) // template_id being mutated
  const [showModal, setShowModal] = useState(false)
  const [modalSearch, setModalSearch] = useState('')

  const selectedRestaurant = restaurants.find(r => r.id === selectedId) ?? null

  const fetchGrants = useCallback(async (restaurantId: string) => {
    setLoadingGrants(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/template-access?restaurant_id=${restaurantId}`)
      if (!res.ok) throw new Error('Fehler beim Laden der Freischaltungen.')
      const json = await res.json()
      setGranted(json.templates ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler.')
    } finally {
      setLoadingGrants(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) {
      setGranted([])
      fetchGrants(selectedId)
    }
  }, [selectedId, fetchGrants])

  async function grantTemplate(templateId: string) {
    if (!selectedId) return
    setPending(templateId)
    setError(null)
    try {
      const res = await fetch('/api/platform/template-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: selectedId, template_id: templateId }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Freischaltung fehlgeschlagen.')
      }
      await fetchGrants(selectedId)
      setShowModal(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler.')
    } finally {
      setPending(null)
    }
  }

  async function revokeTemplate(templateId: string) {
    if (!selectedId) return
    setPending(templateId)
    setError(null)
    try {
      const res = await fetch('/api/platform/template-access', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: selectedId, template_id: templateId }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Entfernen fehlgeschlagen.')
      }
      // Optimistic removal + server re-fetch to confirm actual DB state
      setGranted(prev => prev.filter(t => t.id !== templateId))
      await fetchGrants(selectedId)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler.')
    } finally {
      setPending(null)
    }
  }

  const filteredRestaurants = restaurants.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.slug.toLowerCase().includes(search.toLowerCase())
  )

  const grantedIds = new Set(granted.map(t => t.id))
  const autoTiers = selectedRestaurant ? planTiers(selectedRestaurant.plan) : []
  const autoAccessIds = new Set(
    allTemplates.filter(t => autoTiers.includes(t.plan_tier)).map(t => t.id)
  )

  // Templates available to grant: not already auto-accessible and not already manually granted
  const addableTemplates = allTemplates.filter(t =>
    !autoAccessIds.has(t.id) &&
    !grantedIds.has(t.id) &&
    (modalSearch === '' ||
      t.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
      t.slug.toLowerCase().includes(modalSearch.toLowerCase()))
  )

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Layers size={18} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: 0 }}>
            Template-Zugriff
          </h1>
        </div>
        <p style={{ color: '#888', fontSize: '0.85rem', margin: 0, marginLeft: '48px' }}>
          Verwalte, welche Templates Restaurants manuell freigeschaltet bekommen – zusätzlich zum Plan-Zugriff.
        </p>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
          borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: '#fca5a5',
          marginBottom: '20px',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>

        {/* Left panel — restaurant list */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px', overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Restaurant suchen…"
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', padding: '8px 10px 8px 30px', color: '#fff', fontSize: '0.8rem',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
            {filteredRestaurants.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: '#666', fontSize: '0.8rem' }}>
                Keine Restaurants gefunden.
              </div>
            )}
            {filteredRestaurants.map(r => {
              const isSelected = r.id === selectedId
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '12px 16px',
                    background: isSelected ? 'rgba(239,68,68,0.1)' : 'transparent',
                    borderLeft: isSelected ? '3px solid #ef4444' : '3px solid transparent',
                    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div>
                    <div style={{ color: isSelected ? '#fff' : '#ccc', fontWeight: 600, fontSize: '0.83rem', marginBottom: '3px' }}>
                      {r.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#666', fontSize: '0.7rem' }}>/{r.slug}</span>
                      <PlanBadge plan={r.plan} />
                    </div>
                  </div>
                  {isSelected && <ChevronRight size={14} style={{ color: '#ef4444', flexShrink: 0 }} />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right panel */}
        {!selectedRestaurant ? (
          <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '14px', padding: '60px 24px', textAlign: 'center',
          }}>
            <Layers size={32} style={{ color: '#444', marginBottom: '12px' }} />
            <p style={{ color: '#666', fontSize: '0.875rem', margin: 0 }}>
              Wähle ein Restaurant aus der Liste, um den Template-Zugriff zu verwalten.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Restaurant header */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '14px', padding: '16px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
            }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>
                  {selectedRestaurant.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#888', fontSize: '0.75rem' }}>/{selectedRestaurant.slug}</span>
                  <PlanBadge plan={selectedRestaurant.plan} />
                </div>
              </div>
              <button
                onClick={() => { setShowModal(true); setModalSearch('') }}
                disabled={loadingGrants}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '8px',
                  background: '#ef4444', border: 'none', color: '#fff',
                  fontSize: '0.8rem', fontWeight: 600, cursor: loadingGrants ? 'not-allowed' : 'pointer',
                  flexShrink: 0, opacity: loadingGrants ? 0.6 : 1,
                }}
              >
                <Plus size={14} />
                Template freischalten
              </button>
            </div>

            {/* Plan-based access */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '14px', padding: '18px 20px',
            }}>
              <SectionLabel>Plan-Zugriff (automatisch)</SectionLabel>
              <p style={{ color: '#888', fontSize: '0.75rem', marginBottom: '12px', marginTop: '4px' }}>
                Basierend auf Plan <strong style={{ color: '#ccc' }}>{selectedRestaurant.plan}</strong> — automatischer Zugriff auf folgende Tier-Ebenen:
              </p>
              {autoTiers.length === 0 ? (
                <p style={{ color: '#666', fontSize: '0.8rem' }}>Kein automatischer Zugriff.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {autoTiers.map(tier => <TierBadge key={tier} tier={tier} />)}
                </div>
              )}
              {allTemplates.filter(t => autoTiers.includes(t.plan_tier)).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {allTemplates.filter(t => autoTiers.includes(t.plan_tier)).map(t => (
                    <TemplateRow key={t.id} template={t} showRevoke={false} />
                  ))}
                </div>
              )}
            </div>

            {/* Manual grants */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '14px', padding: '18px 20px',
            }}>
              <SectionLabel>Manuell freigeschaltet</SectionLabel>
              {loadingGrants ? (
                <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '8px' }}>Lade…</p>
              ) : granted.length === 0 ? (
                <p style={{ color: '#666', fontSize: '0.8rem', marginTop: '8px' }}>
                  Keine manuellen Freischaltungen für dieses Restaurant.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                  {granted.map(t => (
                    <TemplateRow
                      key={t.id}
                      template={t}
                      showRevoke
                      revoking={pending === t.id}
                      onRevoke={() => revokeTemplate(t.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Grant modal */}
      {showModal && (
        <>
          <div
            onClick={() => setShowModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 101, width: '480px', maxWidth: 'calc(100vw - 32px)',
            background: '#141420', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px', padding: '24px', maxHeight: '70vh', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', margin: 0 }}>
                Template freischalten
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ color: '#888', fontSize: '0.78rem', marginBottom: '14px', marginTop: 0 }}>
              Für <strong style={{ color: '#ccc' }}>{selectedRestaurant?.name}</strong> — wähle ein Template, das zusätzlich freigeschaltet werden soll.
            </p>

            <div style={{ position: 'relative', marginBottom: '12px', flexShrink: 0 }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
              <input
                value={modalSearch}
                onChange={e => setModalSearch(e.target.value)}
                placeholder="Template suchen…"
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', padding: '8px 10px 8px 30px', color: '#fff', fontSize: '0.8rem',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {addableTemplates.length === 0 && (
                <p style={{ color: '#666', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>
                  {allTemplates.length === 0
                    ? 'Keine Templates in der Datenbank.'
                    : 'Alle verfügbaren Templates sind bereits freigeschaltet.'}
                </p>
              )}
              {addableTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => grantTemplate(t.id)}
                  disabled={pending === t.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    cursor: pending === t.id ? 'not-allowed' : 'pointer',
                    opacity: pending === t.id ? 0.6 : 1,
                    textAlign: 'left', gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.83rem', marginBottom: '3px' }}>
                      {t.name}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ color: '#666', fontSize: '0.7rem' }}>{t.category}</span>
                      <TierBadge tier={t.plan_tier} />
                    </div>
                  </div>
                  <div style={{
                    padding: '5px 12px', borderRadius: '7px', background: '#ef4444',
                    color: '#fff', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0,
                  }}>
                    {pending === t.id ? '…' : 'Freischalten'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      color: '#ef4444', fontSize: '10px', textTransform: 'uppercase',
      letterSpacing: '2px', fontWeight: 700,
    }}>
      {children}
    </div>
  )
}

function TemplateRow({
  template,
  showRevoke,
  revoking,
  onRevoke,
}: {
  template: Template
  showRevoke: boolean
  revoking?: boolean
  onRevoke?: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderRadius: '10px',
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      gap: '12px',
    }}>
      <div>
        <div style={{ color: '#ccc', fontWeight: 600, fontSize: '0.82rem', marginBottom: '3px' }}>
          {template.name}
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ color: '#555', fontSize: '0.7rem' }}>{template.category}</span>
          <TierBadge tier={template.plan_tier} />
        </div>
      </div>
      {showRevoke && onRevoke && (
        <button
          onClick={onRevoke}
          disabled={revoking}
          title="Freischaltung entfernen"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '28px', height: '28px', borderRadius: '7px',
            background: revoking ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            cursor: revoking ? 'not-allowed' : 'pointer',
            opacity: revoking ? 0.5 : 1, flexShrink: 0,
          }}
        >
          <Trash2 size={13} style={{ color: '#ef4444' }} />
        </button>
      )}
      {!showRevoke && (
        <span style={{ color: '#555', fontSize: '0.7rem', flexShrink: 0 }}>auto</span>
      )}
    </div>
  )
}
