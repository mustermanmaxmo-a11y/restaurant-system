'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Restaurant } from '@/types/database'
import { useEditorDraft } from '../useEditorDraft'

type DesignReq = { id: string; status: string; created_at: string; result_template_id: string | null }

const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }
const fieldLabel: React.CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, marginBottom: '6px' }

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'In Bearbeitung', color: '#93c5fd', bg: 'rgba(147,197,253,0.1)' },
  building: { label: 'Wird gebaut', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  done: { label: 'Fertig', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  rejected: { label: 'Abgelehnt', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
}

export function RequestsPanel({ restaurant }: { restaurant: Restaurant }) {
  const { applyDesignConfig } = useEditorDraft()
  const [description, setDescription] = useState('')
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reqs, setReqs] = useState<DesignReq[]>([])

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('design_requests').select('id, status, created_at, result_template_id').eq('restaurant_id', restaurant.id).order('created_at', { ascending: false })
      if (data) setReqs(data as DesignReq[])
    })()
  }, [restaurant.id])

  async function submit() {
    setSubmitting(true); setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const form = new FormData()
    form.append('restaurant_id', restaurant.id)
    if (description.trim()) form.append('description', description.trim())
    if (screenshot) form.append('screenshot', screenshot)
    const res = await fetch('/api/admin/design-requests', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form })
    const json = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(json.error ?? 'Fehler beim Senden.'); return }
    setSent(true)
    setReqs(prev => [json.data as DesignReq, ...prev])
    setDescription(''); setScreenshot(null)
  }

  async function applyDelivered(req: DesignReq) {
    if (!req.result_template_id) return
    const res = await fetch(`/api/design-templates/${req.result_template_id}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurant_id: restaurant.id }) })
    if (!res.ok) { alert('Konnte Template nicht anwenden.'); return }
    const { data: resto } = await supabase.from('restaurants').select('design_config').eq('id', restaurant.id).single()
    if (resto?.design_config) applyDesignConfig(resto.design_config as Record<string, unknown>)
  }

  return (
    <div>
      <h2 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '4px' }}>Design anfragen</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.76rem', marginBottom: '14px' }}>Kein passendes Design dabei? Wir bauen dir ein individuelles Template.</p>

      {reqs.length > 0 && (
        <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {reqs.map(req => {
            const s = STATUS[req.status] ?? STATUS.pending
            return (
              <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', borderRadius: '8px', padding: '10px 12px', gap: '10px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', background: s.bg, color: s.color }}>{s.label}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{new Date(req.created_at).toLocaleDateString('de-DE')}</span>
                </div>
                {req.status === 'done' && req.result_template_id && (
                  <button onClick={() => applyDelivered(req)} style={{ padding: '6px 10px', borderRadius: '7px', border: 'none', background: '#10b981', color: '#fff', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Anwenden</button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {sent ? (
        <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', padding: '16px', color: '#10b981', fontSize: '0.85rem' }}>
          ✓ Anfrage gesendet — wir melden uns!
          <button onClick={() => setSent(false)} style={{ display: 'block', marginTop: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}>Weitere Anfrage</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={fieldLabel}>Beschreibung</label>
            <textarea value={description} onChange={e => { setDescription(e.target.value.slice(0, 1000)); setError(null) }} placeholder="z.B. Warmes mediterranes Design mit Olivgrün und Terrakotta…" rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div>
            <label style={fieldLabel}>Screenshot (optional)</label>
            <label style={{ display: 'block', border: '2px dashed var(--border)', borderRadius: '8px', padding: '14px', textAlign: 'center', cursor: 'pointer' }}>
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={e => { setScreenshot(e.target.files?.[0] ?? null); setError(null) }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{screenshot ? `✓ ${screenshot.name}` : 'Bild hochladen (max. 8 MB)'}</span>
            </label>
          </div>
          {error && <p style={{ color: '#ef4444', fontSize: '0.78rem', margin: 0 }}>{error}</p>}
          <button onClick={submit} disabled={submitting} style={{ padding: '10px 18px', borderRadius: '8px', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '0.82rem', border: 'none', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1, alignSelf: 'flex-start' }}>
            {submitting ? 'Senden…' : 'Anfrage senden'}
          </button>
        </div>
      )}
    </div>
  )
}
