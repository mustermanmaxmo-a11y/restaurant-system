'use client'

import { useState, useTransition } from 'react'
import { UserPlus, Trash2, Crown, ChevronDown, Building2, X } from 'lucide-react'

type TeamRole = 'co_founder' | 'developer' | 'billing' | 'support'

type Member = {
  id: string
  user_id: string
  email: string
  role: string
  created_at: string
  restaurant_ids: string[]
}

type Restaurant = {
  id: string
  name: string
  slug: string
}

const ROLE_OPTIONS: { value: TeamRole; label: string; color: string; bg: string; desc: string }[] = [
  { value: 'co_founder', label: 'Co-Founder', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', desc: 'Fast alle Rechte, Rechtstexte zur Freigabe einreichen' },
  { value: 'developer',  label: 'Developer',  color: '#6366f1', bg: 'rgba(99,102,241,0.1)', desc: 'Überblick & Restaurants bearbeiten, kein Billing/Team' },
  { value: 'billing',    label: 'Billing',    color: '#10b981', bg: 'rgba(16,185,129,0.1)', desc: 'Nur Billing-Seite' },
  { value: 'support',    label: 'Support',    color: '#38bdf8', bg: 'rgba(56,189,248,0.1)', desc: 'Menü & Branding für zugewiesene Restaurants' },
]

function RoleBadge({ role }: { role: string }) {
  const r = ROLE_OPTIONS.find(o => o.value === role)
  if (!r) return null
  return (
    <span style={{
      fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
      color: r.color, background: r.bg, padding: '2px 7px', borderRadius: '5px',
    }}>
      {r.label}
    </span>
  )
}

export function TeamManagerFull({
  currentUserId,
  currentUserEmail,
  members: initial,
  restaurants,
}: {
  currentUserId: string
  currentUserEmail: string
  members: Member[]
  restaurants: Restaurant[]
}) {
  const [members, setMembers] = useState(initial)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<TeamRole>('co_founder')
  const [addError, setAddError] = useState('')
  const [addOk, setAddOk] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function addMember() {
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    setAddError('')
    setAddOk('')

    startTransition(async () => {
      const res = await fetch('/api/platform/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: newRole }),
      })
      const data = await res.json()

      if (!res.ok) {
        setAddError(data.error ?? 'Fehler beim Hinzufügen.')
        return
      }

      setMembers(prev => [...prev, {
        id: data.id,
        user_id: data.user_id,
        email: data.email,
        role: newRole,
        created_at: new Date().toISOString(),
        restaurant_ids: [],
      }])
      setNewEmail('')
      setAddOk(`${data.email} wurde als ${ROLE_OPTIONS.find(r => r.value === newRole)?.label} hinzugefügt.`)
    })
  }

  function changeRole(memberId: string, role: TeamRole) {
    startTransition(async () => {
      const res = await fetch('/api/platform/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: memberId, role }),
      })
      if (!res.ok) return
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m))
    })
  }

  function removeMember(memberId: string) {
    if (!confirm('Team-Mitglied entfernen?')) return
    startTransition(async () => {
      const res = await fetch('/api/platform/team', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: memberId }),
      })
      if (!res.ok) return
      setMembers(prev => prev.filter(m => m.id !== memberId))
    })
  }

  function assignRestaurant(memberId: string, restaurantId: string) {
    startTransition(async () => {
      const res = await fetch('/api/platform/team/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_member_id: memberId, restaurant_id: restaurantId }),
      })
      if (!res.ok) return
      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, restaurant_ids: [...m.restaurant_ids, restaurantId] } : m
      ))
    })
  }

  function removeRestaurant(memberId: string, restaurantId: string) {
    startTransition(async () => {
      const res = await fetch('/api/platform/team/restaurants', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_member_id: memberId, restaurant_id: restaurantId }),
      })
      if (!res.ok) return
      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, restaurant_ids: m.restaurant_ids.filter(r => r !== restaurantId) } : m
      ))
    })
  }

  return (
    <div>
      {/* Owner (du) */}
      <div style={{ background: '#242438', border: '1px solid #2a2a3e', borderRadius: '14px', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #2a2a3e' }}>
          <span style={{ color: '#888', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Owner
          </span>
        </div>
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Crown size={15} color="#ef4444" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{currentUserEmail}</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '2px 7px', borderRadius: '5px' }}>Du</span>
            </div>
            <span style={{ color: '#666', fontSize: '0.72rem' }}>Voller Zugriff · Kann nicht entfernt werden</span>
          </div>
        </div>
      </div>

      {/* Team-Mitglieder */}
      <div style={{ background: '#242438', border: '1px solid #2a2a3e', borderRadius: '14px', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #2a2a3e' }}>
          <span style={{ color: '#888', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {members.length} Team-Mitglied{members.length !== 1 ? 'er' : ''}
          </span>
        </div>

        {members.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontSize: '0.85rem' }}>
            Noch keine Team-Mitglieder. Füge unten jemanden hinzu.
          </div>
        ) : (
          members.map(m => {
            const isExpanded = expandedId === m.id
            const assignedRestaurants = restaurants.filter(r => m.restaurant_ids.includes(r.id))
            const unassignedRestaurants = restaurants.filter(r => !m.restaurant_ids.includes(r.id))

            return (
              <div key={m.id} style={{ borderBottom: '1px solid #2a2a3e' }}>
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#1f1f30', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#888', fontSize: '0.75rem', fontWeight: 700 }}>
                      {m.email.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{m.email}</span>
                      <RoleBadge role={m.role} />
                    </div>
                    <span style={{ color: '#666', fontSize: '0.72rem' }}>
                      Seit {new Date(m.created_at).toLocaleDateString('de-DE')}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {/* Rolle ändern */}
                    <select
                      value={m.role}
                      onChange={e => changeRole(m.id, e.target.value as TeamRole)}
                      disabled={isPending}
                      style={{
                        background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '7px',
                        color: '#ccc', fontSize: '0.78rem', padding: '5px 8px', cursor: 'pointer',
                        outline: 'none',
                      }}
                    >
                      {ROLE_OPTIONS.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>

                    {/* Restaurants expandieren (nur Support) */}
                    {m.role === 'support' && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : m.id)}
                        title="Restaurants verwalten"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '7px',
                          color: '#38bdf8', fontSize: '0.75rem', fontWeight: 600,
                          padding: '5px 9px', cursor: 'pointer',
                        }}
                      >
                        <Building2 size={12} />
                        {m.restaurant_ids.length}
                        <ChevronDown size={12} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />
                      </button>
                    )}

                    <button
                      onClick={() => removeMember(m.id)}
                      disabled={isPending}
                      title="Entfernen"
                      style={{
                        background: 'transparent', border: '1px solid #2a2a3e',
                        borderRadius: '7px', color: '#666', cursor: isPending ? 'not-allowed' : 'pointer',
                        padding: '6px 9px', display: 'flex', alignItems: 'center',
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Restaurant-Zuweisung für Support */}
                {m.role === 'support' && isExpanded && (
                  <div style={{ padding: '12px 18px 18px', background: '#1a1a2a', borderTop: '1px solid #2a2a3e' }}>
                    <p style={{ color: '#888', fontSize: '0.75rem', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Restaurant-Zugriff
                    </p>

                    {assignedRestaurants.length === 0 ? (
                      <p style={{ color: '#555', fontSize: '0.8rem', marginBottom: '10px' }}>Noch keine Restaurants zugewiesen.</p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '12px' }}>
                        {assignedRestaurants.map(r => (
                          <span key={r.id} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)',
                            borderRadius: '6px', padding: '4px 8px',
                            color: '#38bdf8', fontSize: '0.78rem', fontWeight: 600,
                          }}>
                            {r.name}
                            <button
                              onClick={() => removeRestaurant(m.id, r.id)}
                              disabled={isPending}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#38bdf8', padding: '0', display: 'flex', lineHeight: 1 }}
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {unassignedRestaurants.length > 0 && (
                      <select
                        onChange={e => { if (e.target.value) assignRestaurant(m.id, e.target.value) }}
                        value=""
                        disabled={isPending}
                        style={{
                          background: '#1f1f30', border: '1px solid #2a2a3e', borderRadius: '7px',
                          color: '#888', fontSize: '0.8rem', padding: '7px 10px',
                          cursor: 'pointer', outline: 'none', width: '100%',
                        }}
                      >
                        <option value="">+ Restaurant hinzufügen…</option>
                        {unassignedRestaurants.map(r => (
                          <option key={r.id} value={r.id}>{r.name} ({r.slug})</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Mitarbeiter hinzufügen */}
      <div style={{ background: '#242438', border: '1px solid #2a2a3e', borderRadius: '14px', padding: '20px' }}>
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', marginBottom: '6px' }}>
          Team-Mitglied hinzufügen
        </h2>
        <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '16px', lineHeight: 1.5 }}>
          Die Person muss sich zuerst unter <a href="/team-register" style={{ color: '#ef4444' }}>/team-register</a> einen Account erstellen.
        </p>

        {/* Rolle wählen */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {ROLE_OPTIONS.map(r => (
              <button
                key={r.value}
                onClick={() => setNewRole(r.value)}
                style={{
                  padding: '10px 12px', borderRadius: '9px', border: '2px solid',
                  borderColor: newRole === r.value ? r.color : '#2a2a3e',
                  background: newRole === r.value ? r.bg : 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ color: r.color, fontWeight: 700, fontSize: '0.8rem' }}>{r.label}</div>
                <div style={{ color: '#666', fontSize: '0.7rem', marginTop: '2px', lineHeight: 1.3 }}>{r.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMember()}
            placeholder="name@email.de"
            style={{
              flex: 1, minWidth: '200px', padding: '10px 14px', borderRadius: '8px',
              border: '1px solid #2a2a3e', background: '#1a1a2e',
              color: '#fff', fontSize: '0.9rem', outline: 'none',
            }}
          />
          <button
            onClick={addMember}
            disabled={isPending || !newEmail.trim()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '10px 16px', borderRadius: '8px', border: 'none',
              background: newEmail.trim() && !isPending ? '#ef4444' : '#2a2a3e',
              color: newEmail.trim() && !isPending ? '#fff' : '#666',
              fontWeight: 700, fontSize: '0.85rem',
              cursor: newEmail.trim() && !isPending ? 'pointer' : 'not-allowed',
            }}
          >
            <UserPlus size={15} />
            {isPending ? 'Wird hinzugefügt…' : 'Hinzufügen'}
          </button>
        </div>

        {addError && (
          <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '10px', background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: '7px' }}>
            {addError}
          </p>
        )}
        {addOk && (
          <p style={{ color: '#10b981', fontSize: '0.8rem', marginTop: '10px', background: 'rgba(16,185,129,0.1)', padding: '8px 12px', borderRadius: '7px' }}>
            {addOk}
          </p>
        )}
      </div>
    </div>
  )
}
