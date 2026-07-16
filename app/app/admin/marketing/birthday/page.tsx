'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type TriggerType = 'birthday' | 'first_order_anniversary' | 'custom_event'

type Campaign = {
  id: string
  trigger_type: TriggerType
  send_date: string | null
  subject: string
  headline: string
  body_text: string
  discount_type: 'percent' | 'fixed' | null
  discount_value: number | null
  expires_days: number
  enabled: boolean
  sent_at: string | null
  created_at: string
}

type FormState = {
  trigger_type: TriggerType
  send_date: string
  subject: string
  headline: string
  body_text: string
  discount_type: 'percent' | 'fixed' | ''
  discount_value: string
  expires_days: string
  enabled: boolean
}

const DEFAULT_FORM: FormState = {
  trigger_type: 'birthday',
  send_date: '',
  subject: '',
  headline: '',
  body_text: '',
  discount_type: '',
  discount_value: '',
  expires_days: '7',
  enabled: true,
}

export default function BirthdayDashboard() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [showAiForm, setShowAiForm] = useState(false)
  const [aiDescription, setAiDescription] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/owner-login'); return }
      setToken(session.access_token)
    })
  }, [router])

  const loadCampaigns = useCallback(async () => {
    if (!token) return
    const res = await fetch('/api/admin/campaigns', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const data = await res.json()
    setCampaigns(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [token])

  useEffect(() => { loadCampaigns() }, [loadCampaigns])

  async function saveCampaign() {
    if (!token) return
    if (!form.subject.trim() || !form.headline.trim() || !form.body_text.trim()) return
    setSaving(true)
    const body = {
      trigger_type: form.trigger_type,
      send_date: form.trigger_type === 'custom_event' && form.send_date ? form.send_date : null,
      subject: form.subject,
      headline: form.headline,
      body_text: form.body_text,
      discount_type: form.discount_type || null,
      discount_value: form.discount_value ? parseFloat(form.discount_value) : null,
      expires_days: parseInt(form.expires_days) || 7,
      enabled: form.enabled,
    }
    await fetch('/api/admin/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    setShowForm(false)
    setForm(DEFAULT_FORM)
    await loadCampaigns()
    setSaving(false)
  }

  async function toggleEnabled(c: Campaign) {
    if (!token) return
    await fetch('/api/admin/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: c.id, enabled: !c.enabled }),
    })
    await loadCampaigns()
  }

  async function deleteCampaign(id: string) {
    if (!token || !confirm('Kampagne löschen?')) return
    await fetch('/api/admin/campaigns', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    await loadCampaigns()
  }

  async function generateWithAi() {
    if (!token || !aiDescription.trim()) return
    setAiLoading(true)
    setAiError('')
    try {
      const res = await fetch('/api/ai/create-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: aiDescription }),
      })
      const data = await res.json()
      if (!res.ok) { setAiError(data.error ?? 'Fehler'); setAiLoading(false); return }
      const c = data.campaign
      setForm({
        trigger_type: c.trigger_type ?? 'birthday',
        send_date: c.send_date ?? '',
        subject: c.subject ?? '',
        headline: c.headline ?? '',
        body_text: c.body_text ?? '',
        discount_type: c.discount_type ?? '',
        discount_value: c.discount_value != null ? String(c.discount_value) : '',
        expires_days: c.expires_days != null ? String(c.expires_days) : '7',
        enabled: true,
      })
      setShowAiForm(false)
      setAiDescription('')
      setShowForm(true)
    } catch {
      setAiError('Generierung fehlgeschlagen.')
    }
    setAiLoading(false)
  }

  const triggerLabel: Record<TriggerType, string> = {
    birthday: 'Geburtstag',
    first_order_anniversary: 'Bestell-Jahrestag',
    custom_event: 'Restaurant-Event',
  }

  if (loading && token) return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Lade…</div>

  return (
    <div style={{ padding: '24px', maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.4rem', margin: 0 }}>
            Geburtstag & Events
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', marginBottom: 0 }}>
            Automatische Emails mit individuellen Gutschein-Codes
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowAiForm(true)}
            style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Mit KI erstellen
          </button>
          <button
            onClick={() => setShowForm(true)}
            style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
          >
            + Neue Kampagne
          </button>
        </div>
      </div>

      {campaigns.length === 0 && !loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '12px' }}>
          Noch keine Kampagnen. Erstelle deine erste Geburtstags-Email!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {campaigns.map(c => (
            <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {triggerLabel[c.trigger_type]}
                    {c.send_date ? ` · ${c.send_date}` : ''}
                    {c.sent_at ? ' · Gesendet' : ''}
                  </span>
                  <p style={{ color: 'var(--text)', fontWeight: 700, margin: '4px 0 2px', fontSize: '0.95rem' }}>{c.headline}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
                    {c.discount_type && c.discount_value
                      ? `${c.discount_value} ${c.discount_type === 'percent' ? '%' : '€'} Rabatt · ${c.expires_days} Tage gültig`
                      : 'Kein Rabatt'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                  <button
                    onClick={() => toggleEnabled(c)}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: c.enabled ? '#16a34a20' : 'transparent', color: c.enabled ? '#16a34a' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
                  >
                    {c.enabled ? 'Aktiv' : 'Inaktiv'}
                  </button>
                  <button
                    onClick={() => deleteCampaign(c.id)}
                    aria-label="Kampagne löschen"
                    style={{ display: 'inline-flex', alignItems: 'center', padding: '6px', borderRadius: '8px', border: 'none', background: '#ef444415', color: '#ef4444', cursor: 'pointer' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Campaign Generator Modal */}
      {showAiForm && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setShowAiForm(false); setAiDescription(''); setAiError('') } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px', width: '100%', maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>Kampagne mit KI erstellen</h2>
              <button onClick={() => { setShowAiForm(false); setAiDescription(''); setAiError('') }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
              Beschreibe deine Kampagne — die KI erstellt automatisch alle Inhalte.
            </p>
            <textarea
              value={aiDescription}
              onChange={e => setAiDescription(e.target.value)}
              placeholder="z.B. Erstelle eine Geburtstags-Kampagne mit 10% Rabatt für unsere Gäste"
              rows={4}
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface-2, #1a1a2a)', color: 'var(--text)', fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical' as const, outline: 'none' }}
            />
            {aiError && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '8px' }}>{aiError}</p>}
            <button
              onClick={generateWithAi}
              disabled={aiLoading || !aiDescription.trim()}
              style={{ width: '100%', marginTop: '16px', padding: '14px', borderRadius: '12px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', opacity: aiLoading ? 0.7 : 1 }}
            >
              {aiLoading ? 'KI generiert…' : 'Kampagne generieren'}
            </button>
          </div>
        </div>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>Neue Kampagne</h2>
              <button onClick={() => { setShowForm(false); setForm(DEFAULT_FORM) }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            <label style={labelStyle}>Trigger</label>
            <select value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value as TriggerType }))} style={inputStyle}>
              <option value="birthday">Geburtstag (täglich automatisch)</option>
              <option value="first_order_anniversary">Bestell-Jahrestag (täglich automatisch)</option>
              <option value="custom_event">Restaurant-Event (einmalig)</option>
            </select>

            {form.trigger_type === 'custom_event' && (
              <>
                <label style={labelStyle}>Sendedatum</label>
                <input type="date" value={form.send_date} onChange={e => setForm(f => ({ ...f, send_date: e.target.value }))} style={inputStyle} />
              </>
            )}

            <label style={labelStyle}>Betreff</label>
            <input type="text" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Alles Gute zum Geburtstag" style={inputStyle} />

            <label style={labelStyle}>Headline (groß in der Email)</label>
            <input type="text" value={form.headline} onChange={e => setForm(f => ({ ...f, headline: e.target.value }))} placeholder="Heute ist dein Tag!" style={inputStyle} />

            <label style={labelStyle}>Text</label>
            <textarea value={form.body_text} onChange={e => setForm(f => ({ ...f, body_text: e.target.value }))} placeholder="Wir freuen uns, deinen Geburtstag mit dir zu feiern…" rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} />

            <label style={labelStyle}>Rabatt-Typ (optional)</label>
            <select value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value as FormState['discount_type'] }))} style={inputStyle}>
              <option value="">Kein Rabatt</option>
              <option value="percent">Prozent (%)</option>
              <option value="fixed">Fixer Betrag (€)</option>
            </select>

            {form.discount_type && (
              <>
                <label style={labelStyle}>Rabatt-Wert</label>
                <input type="number" min={0} step={0.01} value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))} placeholder={form.discount_type === 'percent' ? '10' : '5.00'} style={inputStyle} />

                <label style={labelStyle}>Gültig für (Tage)</label>
                <input type="number" min={1} value={form.expires_days} onChange={e => setForm(f => ({ ...f, expires_days: e.target.value }))} style={inputStyle} />
              </>
            )}

            <button
              onClick={saveCampaign}
              disabled={saving || !form.subject.trim() || !form.headline.trim() || !form.body_text.trim()}
              style={{ width: '100%', marginTop: '20px', padding: '14px', borderRadius: '12px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Speichert…' : 'Kampagne erstellen'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'var(--text-muted)',
  fontSize: '0.75rem',
  fontWeight: 600,
  marginBottom: '5px',
  marginTop: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'var(--surface-2, #1a1a2a)',
  color: 'var(--text)',
  fontSize: '0.9rem',
  outline: 'none',
  fontFamily: 'inherit',
}
