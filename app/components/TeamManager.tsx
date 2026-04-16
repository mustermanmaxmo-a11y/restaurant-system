'use client'

import { useState, useTransition } from 'react'
import { UserPlus, Trash2, Crown } from 'lucide-react'

type Member = {
  user_id: string
  email: string
  created_at: string
  isYou: boolean
}

export function TeamManager({ members: initial }: { members: Member[] }) {
  const [members, setMembers] = useState(initial)
  const [newEmail, setNewEmail] = useState('')
  const [addError, setAddError] = useState('')
  const [addOk, setAddOk] = useState('')
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
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (!res.ok) {
        setAddError(data.error ?? 'Fehler beim Hinzufügen.')
        return
      }

      setMembers(prev => [
        ...prev,
        { user_id: data.user_id, email: data.email, created_at: new Date().toISOString(), isYou: false },
      ])
      setNewEmail('')
      setAddOk(`${data.email} wurde hinzugefügt.`)
    })
  }

  function removeMember(user_id: string) {
    startTransition(async () => {
      const res = await fetch('/api/platform/team', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAddError(data.error ?? 'Fehler beim Entfernen.')
        return
      }
      setMembers(prev => prev.filter(m => m.user_id !== user_id))
    })
  }

  return (
    <div>
      {/* Aktuelle Mitglieder */}
      <div style={{ background: '#242438', border: '1px solid #2a2a3e', borderRadius: '14px', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #2a2a3e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#888', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {members.length} Mitglied{members.length !== 1 ? 'er' : ''}
          </span>
        </div>

        {members.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Keine Mitglieder.</div>
        ) : (
          members.map(m => (
            <div key={m.user_id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderBottom: '1px solid #2a2a3e',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '50%',
                  background: m.isYou ? 'rgba(239,68,68,0.15)' : '#1f1f30',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {m.isYou
                    ? <Crown size={15} color="#ef4444" />
                    : <span style={{ color: '#888', fontSize: '0.75rem', fontWeight: 700 }}>
                        {m.email.charAt(0).toUpperCase()}
                      </span>
                  }
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>
                    {m.email}
                    {m.isYou && (
                      <span style={{ marginLeft: '8px', color: '#ef4444', fontSize: '0.68rem', fontWeight: 700, background: 'rgba(239,68,68,0.1)', padding: '2px 7px', borderRadius: '6px' }}>
                        Du
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#666', fontSize: '0.72rem' }}>
                    Zugang seit {new Date(m.created_at).toLocaleDateString('de-DE')}
                  </div>
                </div>
              </div>

              {!m.isYou && (
                <button
                  onClick={() => removeMember(m.user_id)}
                  disabled={isPending}
                  title="Zugang entfernen"
                  style={{
                    background: 'transparent', border: '1px solid #2a2a3e',
                    borderRadius: '8px', color: '#666', cursor: isPending ? 'not-allowed' : 'pointer',
                    padding: '7px 10px', display: 'flex', alignItems: 'center',
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Mitarbeiter hinzufügen */}
      <div style={{ background: '#242438', border: '1px solid #2a2a3e', borderRadius: '14px', padding: '20px' }}>
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', marginBottom: '14px' }}>
          Mitarbeiter hinzufügen
        </h2>
        <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '14px', lineHeight: 1.5 }}>
          Der Mitarbeiter muss sich zuerst unter <a href="/register" style={{ color: '#ef4444' }}>/register</a> einen Account erstellen. Danach hier die E-Mail eintragen.
        </p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMember()}
            placeholder="mitarbeiter@email.de"
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
