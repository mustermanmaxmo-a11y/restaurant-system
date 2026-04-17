'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Palette, Clock, CheckCircle, Loader2, ChevronDown } from 'lucide-react'

type DesignRequest = {
  id: string
  message: string
  status: 'pending' | 'in_progress' | 'done'
  admin_note: string | null
  created_at: string
  updated_at: string
  restaurants: { name: string; plan: string } | null
}

const STATUS_LABELS = {
  pending: 'Offen',
  in_progress: 'In Bearbeitung',
  done: 'Abgeschlossen',
}

const STATUS_COLORS = {
  pending: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', dot: '#ef4444' },
  in_progress: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', dot: '#f59e0b' },
  done: { bg: 'rgba(16,185,129,0.12)', text: '#10b981', dot: '#10b981' },
}

export default function DesignRequestsPage() {
  const [requests, setRequests] = useState<DesignRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'done'>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [noteEdits, setNoteEdits] = useState<Record<string, string>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('design_requests')
      .select('*, restaurants(name, plan)')
      .order('created_at', { ascending: false })
    setRequests((data as DesignRequest[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id)
    const note = noteEdits[id] ?? null
    const res = await fetch('/api/platform/design-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, admin_note: note || null }),
    })
    if (res.ok) {
      setRequests(prev =>
        prev.map(r => r.id === id ? { ...r, status: status as DesignRequest['status'], admin_note: note || null } : r)
      )
    }
    setUpdatingId(null)
  }

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div style={{ padding: '32px 24px', maxWidth: '860px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <Palette size={20} color="#ef4444" />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: 0 }}>
            Design-Anfragen
          </h1>
          {pendingCount > 0 && (
            <span style={{
              background: '#ef4444', color: '#fff', fontSize: '0.7rem',
              fontWeight: 800, padding: '2px 8px', borderRadius: '10px',
            }}>
              {pendingCount} neu
            </span>
          )}
        </div>
        <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>
          Individuelle Design-Anfragen von Restaurant-Admins.
        </p>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {(['all', 'pending', 'in_progress', 'done'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: '8px', border: '1px solid',
              borderColor: filter === f ? '#ef4444' : '#2a2a3e',
              background: filter === f ? 'rgba(239,68,68,0.12)' : 'transparent',
              color: filter === f ? '#ef4444' : '#888',
              fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {f === 'all' ? `Alle (${requests.length})` : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#888', fontSize: '0.875rem', padding: '40px 0', textAlign: 'center' }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
          <br />Laden…
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ color: '#666', fontSize: '0.875rem', padding: '60px 0', textAlign: 'center' }}>
          Keine Anfragen gefunden.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map(req => {
            const colors = STATUS_COLORS[req.status]
            const isExpanded = expandedId === req.id
            const noteVal = noteEdits[req.id] ?? (req.admin_note ?? '')

            return (
              <div key={req.id} style={{
                background: '#242438', border: '1px solid #2a2a3e',
                borderRadius: '14px', overflow: 'hidden',
                borderLeft: `3px solid ${colors.dot}`,
              }}>
                {/* Card Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>
                        {req.restaurants?.name ?? '—'}
                      </span>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                        padding: '2px 7px', borderRadius: '5px',
                        background: colors.bg, color: colors.text,
                      }}>
                        {STATUS_LABELS[req.status]}
                      </span>
                      <span style={{ color: '#555', fontSize: '0.72rem' }}>
                        {new Date(req.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <p style={{
                      color: '#aaa', fontSize: '0.8rem', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap',
                    }}>
                      {req.message}
                    </p>
                  </div>
                  <ChevronDown
                    size={16} color="#555"
                    style={{ flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                  />
                </button>

                {/* Expanded */}
                {isExpanded && (
                  <div style={{ padding: '0 18px 18px', borderTop: '1px solid #2a2a3e' }}>
                    {/* Full message */}
                    <div style={{ padding: '14px', background: '#1a1a2e', borderRadius: '8px', margin: '14px 0' }}>
                      <p style={{ color: '#ccc', fontSize: '0.82rem', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                        {req.message}
                      </p>
                    </div>

                    {/* Admin note */}
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', color: '#666', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                        Interne Notiz (optional)
                      </label>
                      <textarea
                        value={noteVal}
                        onChange={e => setNoteEdits(prev => ({ ...prev, [req.id]: e.target.value }))}
                        placeholder="z.B. Figma-Link, Absprache, Lieferdatum…"
                        rows={2}
                        style={{
                          width: '100%', padding: '9px 12px', borderRadius: '7px',
                          border: '1.5px solid #2a2a3e', background: '#1a1a2e',
                          color: '#ccc', fontSize: '0.8rem', resize: 'vertical',
                          outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    {/* Status Actions */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {(['pending', 'in_progress', 'done'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => updateStatus(req.id, s)}
                          disabled={req.status === s || updatingId === req.id}
                          style={{
                            padding: '8px 16px', borderRadius: '7px', border: '1px solid',
                            borderColor: req.status === s ? STATUS_COLORS[s].dot : '#2a2a3e',
                            background: req.status === s ? STATUS_COLORS[s].bg : 'transparent',
                            color: req.status === s ? STATUS_COLORS[s].text : '#666',
                            fontSize: '0.78rem', fontWeight: 600, cursor: req.status === s ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px',
                          }}
                        >
                          {updatingId === req.id && req.status !== s
                            ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                            : s === 'done' ? <CheckCircle size={11} /> : <Clock size={11} />
                          }
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
