'use client'

import { useState } from 'react'
import { Palette, Loader2, ChevronDown, X } from 'lucide-react'

type Restaurant = {
  id: string
  name: string
  slug: string
}

type DesignRequest = {
  id: string
  restaurant_id: string
  description: string | null
  screenshot_url: string | null
  status: 'pending' | 'building' | 'done' | 'rejected'
  result_template_id: string | null
  admin_notes: string | null
  created_at: string
  restaurants: Restaurant | null
}

const STATUS_LABELS: Record<DesignRequest['status'], string> = {
  pending: 'Offen',
  building: 'Wird gebaut',
  done: 'Fertig',
  rejected: 'Abgelehnt',
}

const STATUS_COLORS: Record<DesignRequest['status'], { bg: string; text: string; dot: string }> = {
  pending:  { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8', dot: '#818cf8' },
  building: { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b', dot: '#f59e0b' },
  done:     { bg: 'rgba(16,185,129,0.12)',  text: '#10b981', dot: '#10b981' },
  rejected: { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444', dot: '#ef4444' },
}

const VALID_STATUSES: DesignRequest['status'][] = ['pending', 'building', 'done', 'rejected']

type DetailState = {
  id: string
  status: DesignRequest['status']
  admin_notes: string
  result_template_id: string
  saving: boolean
  saveError: string | null
}

export default function DesignRequestsClient({ initialRequests }: { initialRequests: DesignRequest[] }) {
  const [requests, setRequests] = useState<DesignRequest[]>(initialRequests)
  const [filter, setFilter] = useState<'all' | DesignRequest['status']>('all')
  const [detail, setDetail] = useState<DetailState | null>(null)

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const pendingCount = requests.filter(r => r.status === 'pending').length

  function openDetail(req: DesignRequest) {
    setDetail({
      id: req.id,
      status: req.status,
      admin_notes: req.admin_notes ?? '',
      result_template_id: req.result_template_id ?? '',
      saving: false,
      saveError: null,
    })
  }

  async function saveDetail() {
    if (!detail) return
    setDetail(prev => prev ? { ...prev, saving: true, saveError: null } : null)

    const res = await fetch('/api/platform/design-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: detail.id,
        status: detail.status,
        admin_notes: detail.admin_notes || null,
        result_template_id: detail.result_template_id || null,
      }),
    })

    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string }
      setDetail(prev => prev ? { ...prev, saving: false, saveError: json.error ?? 'Fehler beim Speichern' } : null)
      return
    }

    const json = await res.json() as { data: DesignRequest }
    setRequests(prev => prev.map(r => r.id === detail.id ? { ...r, ...json.data } : r))
    setDetail(null)
  }

  const detailReq = detail ? requests.find(r => r.id === detail.id) : null

  return (
    <div style={{ padding: '32px 24px', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <Palette size={20} color="#818cf8" />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: 0 }}>
            Design-Anfragen
          </h1>
          {pendingCount > 0 && (
            <span style={{
              background: '#818cf8', color: '#fff', fontSize: '0.7rem',
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
        {(['all', ...VALID_STATUSES] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: '8px', border: '1px solid',
              borderColor: filter === f ? '#818cf8' : '#2a2a3e',
              background: filter === f ? 'rgba(99,102,241,0.12)' : 'transparent',
              color: filter === f ? '#818cf8' : '#888',
              fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {f === 'all' ? `Alle (${requests.length})` : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ color: '#666', fontSize: '0.875rem', padding: '60px 0', textAlign: 'center' }}>
          Keine Anfragen gefunden.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(req => {
            const colors = STATUS_COLORS[req.status]
            return (
              <div key={req.id} style={{
                background: '#242438', border: '1px solid #2a2a3e',
                borderRadius: '12px', padding: '14px 18px',
                borderLeft: `3px solid ${colors.dot}`,
                display: 'flex', alignItems: 'center', gap: '16px',
              }}>
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
                  {req.description && (
                    <p style={{
                      color: '#aaa', fontSize: '0.8rem', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: '500px',
                    }}>
                      {req.description}
                    </p>
                  )}
                  {!req.description && (
                    <p style={{ color: '#555', fontSize: '0.78rem', margin: 0, fontStyle: 'italic' }}>
                      Keine Beschreibung
                    </p>
                  )}
                </div>
                <button
                  onClick={() => openDetail(req)}
                  style={{
                    padding: '7px 14px', borderRadius: '8px', border: '1px solid #2a2a3e',
                    background: 'transparent', color: '#888', fontSize: '0.78rem',
                    fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: '5px',
                  }}
                >
                  Details <ChevronDown size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail Modal */}
      {detail && detailReq && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }} onClick={e => { if (e.target === e.currentTarget) setDetail(null) }}>
          <div style={{
            background: '#1a1a2e', border: '1px solid #2a2a3e',
            borderRadius: '16px', width: '100%', maxWidth: '560px',
            maxHeight: '90vh', overflowY: 'auto',
            padding: '24px',
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h2 style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>
                  {detailReq.restaurants?.name ?? 'Anfrage'}
                </h2>
                <p style={{ color: '#555', fontSize: '0.75rem', margin: '3px 0 0' }}>
                  {new Date(detailReq.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => setDetail(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Screenshot */}
            {detailReq.screenshot_url && (
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Screenshot</label>
                <img
                  src={detailReq.screenshot_url}
                  alt="Screenshot"
                  style={{ width: '100%', borderRadius: '8px', border: '1px solid #2a2a3e', display: 'block' }}
                />
              </div>
            )}

            {/* Full Description */}
            {detailReq.description && (
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Beschreibung</label>
                <div style={{
                  background: '#242438', borderRadius: '8px', padding: '12px 14px',
                  color: '#ccc', fontSize: '0.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                }}>
                  {detailReq.description}
                </div>
              </div>
            )}

            {/* Status */}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Status</label>
              <select
                value={detail.status}
                onChange={e => setDetail(prev => prev ? { ...prev, status: e.target.value as DesignRequest['status'] } : null)}
                style={inputStyle}
              >
                {VALID_STATUSES.map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {/* Admin Notes */}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Admin-Notizen</label>
              <textarea
                value={detail.admin_notes}
                onChange={e => setDetail(prev => prev ? { ...prev, admin_notes: e.target.value } : null)}
                placeholder="Interne Notizen, Figma-Links, Liefertermin…"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            {/* Result Template ID */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Result Template ID</label>
              <input
                type="text"
                value={detail.result_template_id}
                onChange={e => setDetail(prev => prev ? { ...prev, result_template_id: e.target.value } : null)}
                placeholder="UUID des zugewiesenen Templates"
                style={inputStyle}
              />
            </div>

            {/* Error */}
            {detail.saveError && (
              <p style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '12px' }}>
                {detail.saveError}
              </p>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={saveDetail}
                disabled={detail.saving}
                style={{
                  flex: 1, padding: '11px', borderRadius: '8px', border: 'none',
                  background: '#818cf8', color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                  cursor: detail.saving ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  opacity: detail.saving ? 0.7 : 1,
                }}
              >
                {detail.saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                Speichern
              </button>
              <button
                onClick={() => setDetail(null)}
                style={{
                  padding: '11px 18px', borderRadius: '8px', border: '1px solid #2a2a3e',
                  background: 'transparent', color: '#888', fontSize: '0.85rem', cursor: 'pointer',
                }}
              >
                Abbrechen
              </button>
            </div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', color: '#666', fontSize: '0.7rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '7px',
  border: '1.5px solid #2a2a3e', background: '#242438',
  color: '#ccc', fontSize: '0.82rem', outline: 'none',
  boxSizing: 'border-box',
}
