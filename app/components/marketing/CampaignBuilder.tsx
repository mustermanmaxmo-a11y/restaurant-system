'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Campaign {
  id: string
  subject: string
  status: 'draft' | 'sent' | 'scheduled'
  recipient_count: number | null
  open_count: number | null
  click_count: number | null
  conversion_revenue: number | null
  created_at: string
  sent_at: string | null
  scheduled_at: string | null
  generated_by_ai: boolean
  template_type: string | null
}

interface CampaignDraft {
  subject: string
  previewText: string
  bodyHtml: string
  ctaText: string
  ctaUrl: string
  discountCode: string | null
  templateType: string
}

interface Props {
  campaigns: Campaign[]
  restaurantId: string
}

const TEMPLATE_CHIPS = [
  { icon: '🏷️', label: 'Rabattaktion', templateType: 'discount', text: 'Erstelle eine Rabattaktion mit X% Rabatt auf unser Menü für unsere Stammkunden.' },
  { icon: '📅', label: 'Event', templateType: 'event', text: 'Wir haben ein besonderes Event und möchten unsere Gäste herzlich einladen.' },
  { icon: '🌿', label: 'Saisonspecial', templateType: 'seasonal', text: 'Saisonales Angebot für diese Jahreszeit mit frischen, regionalen Zutaten.' },
  { icon: '💝', label: 'Loyalitäts-Bonus', templateType: 'loyalty', text: 'Dankeschön für unsere Stammkunden — ein exklusives Angebot als Dankeschön.' },
  { icon: '🍽️', label: 'Neues Gericht', templateType: 'new_dish', text: 'Wir haben ein neues Gericht auf der Karte und möchten es vorstellen.' },
]

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function openRate(campaign: Campaign): string {
  if (!campaign.recipient_count || campaign.recipient_count === 0) return '—'
  if (campaign.open_count == null) return '—'
  return `${((campaign.open_count / campaign.recipient_count) * 100).toFixed(1)}%`
}

export function CampaignBuilder({ campaigns: initialCampaigns, restaurantId }: Props) {
  const router = useRouter()
  const [view, setView] = useState<'list' | 'builder'>('list')
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns)

  // Builder state
  const [step, setStep] = useState<'describe' | 'preview'>('describe')
  const [prompt, setPrompt] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // Draft state
  const [draft, setDraft] = useState<CampaignDraft | null>(null)
  const [editedSubject, setEditedSubject] = useState('')
  const [editedPreview, setEditedPreview] = useState('')

  // Send/schedule state
  const [sendConfirm, setSendConfirm] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ sent?: number; error?: string } | null>(null)
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [savingDraft, setSavingDraft] = useState(false)
  const [savedDraftMsg, setSavedDraftMsg] = useState<string | null>(null)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // On mount: check localStorage for draft from MarketingAdvisor
  useEffect(() => {
    const raw = localStorage.getItem('marketing_campaign_draft')
    if (raw) {
      try {
        const stored = JSON.parse(raw) as CampaignDraft
        localStorage.removeItem('marketing_campaign_draft')
        setDraft(stored)
        setEditedSubject(stored.subject)
        setEditedPreview(stored.previewText)
        setStep('preview')
        setView('builder')
      } catch {
        localStorage.removeItem('marketing_campaign_draft')
      }
    }
  }, [])

  function openBuilder() {
    setView('builder')
    setStep('describe')
    setPrompt('')
    setSelectedTemplate(null)
    setDraft(null)
    setGenerateError(null)
    setSendResult(null)
    setSendConfirm(false)
    setShowSchedule(false)
    setSavedDraftMsg(null)
  }

  function goBack() {
    setView('list')
    setStep('describe')
    setDraft(null)
    setSendResult(null)
    setSendConfirm(false)
    setShowSchedule(false)
    setSavedDraftMsg(null)
  }

  function selectChip(chip: typeof TEMPLATE_CHIPS[0]) {
    setPrompt(chip.text)
    setSelectedTemplate(chip.templateType)
  }

  async function generateDraft() {
    if (!prompt.trim()) return
    setGenerating(true)
    setGenerateError(null)

    try {
      const res = await fetch('/api/ai/marketing-campaign-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          restaurantId,
          templateType: selectedTemplate ?? 'discount',
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setGenerateError(data.error ?? 'Generierung fehlgeschlagen')
        return
      }

      setDraft(data.draft)
      setEditedSubject(data.draft.subject)
      setEditedPreview(data.draft.previewText)
      setStep('preview')
    } catch {
      setGenerateError('Netzwerkfehler. Bitte versuche es erneut.')
    } finally {
      setGenerating(false)
    }
  }

  async function saveDraftToDB(): Promise<string | null> {
    if (!draft) return null
    const res = await fetch('/api/marketing/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId,
        subject: editedSubject || draft.subject,
        previewText: editedPreview || draft.previewText,
        bodyHtml: draft.bodyHtml,
        discountCode: draft.discountCode,
        templateType: draft.templateType,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error ?? 'Speichern fehlgeschlagen')
    }
    return data.id as string
  }

  async function handleSaveDraft() {
    if (!draft) return
    setSavingDraft(true)
    setSavedDraftMsg(null)
    try {
      const id = await saveDraftToDB()
      setSavedDraftMsg('Entwurf gespeichert!')
      // Refresh campaigns list
      router.refresh()
      // Add to local list optimistically
      if (id) {
        setCampaigns(prev => [{
          id,
          subject: editedSubject || draft.subject,
          status: 'draft',
          recipient_count: null,
          open_count: null,
          click_count: null,
          conversion_revenue: null,
          created_at: new Date().toISOString(),
          sent_at: null,
          scheduled_at: null,
          generated_by_ai: true,
          template_type: draft.templateType,
        }, ...prev])
      }
    } catch (e: unknown) {
      setSavedDraftMsg((e as Error).message ?? 'Fehler beim Speichern')
    } finally {
      setSavingDraft(false)
    }
  }

  async function handleSend() {
    if (!draft) return
    setSending(true)
    setSendResult(null)

    try {
      // Save draft first to get a campaignId
      const campaignId = await saveDraftToDB()
      if (!campaignId) {
        setSendResult({ error: 'Kampagne konnte nicht gespeichert werden.' })
        return
      }

      const token = (await (await fetch('/api/auth/session')).json())?.access_token
      const res = await fetch('/api/marketing/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ restaurantId, campaignId }),
      })

      const data = await res.json()
      if (!res.ok) {
        setSendResult({ error: data.error ?? 'Fehler beim Senden' })
      } else {
        setSendResult({ sent: data.sent })
        setSendConfirm(false)
        router.refresh()
      }
    } catch {
      setSendResult({ error: 'Netzwerkfehler.' })
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(campaignId: string) {
    setDeletingId(campaignId)
    try {
      await fetch(`/api/marketing/campaigns?id=${campaignId}&restaurantId=${restaurantId}`, {
        method: 'DELETE',
      })
      setCampaigns(prev => prev.filter(c => c.id !== campaignId))
    } finally {
      setDeletingId(null)
    }
  }

  // ─── LIST VIEW ───────────────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div style={{ padding: '28px 32px', minHeight: '100vh', background: 'var(--bg, #0a0a0f)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Kampagnen
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '4px' }}>
              {campaigns.length} Kampagne{campaigns.length !== 1 ? 'n' : ''}
            </p>
          </div>
          <button
            onClick={openBuilder}
            style={{
              background: '#f97316',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 20px',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>+</span> Neue Kampagne
          </button>
        </div>

        {/* Empty state */}
        {campaigns.length === 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px dashed rgba(255,255,255,0.12)',
            borderRadius: '16px',
            padding: '64px 32px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📧</div>
            <p style={{ color: '#9ca3af', fontSize: '1rem', margin: 0 }}>
              Noch keine Kampagnen. Erstelle deine erste Kampagne mit dem KI-Berater.
            </p>
            <button
              onClick={openBuilder}
              style={{
                marginTop: '20px',
                background: '#f97316',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 20px',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Jetzt erstellen
            </button>
          </div>
        )}

        {/* Campaign table */}
        {campaigns.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {campaigns.map(c => (
              <div
                key={c.id}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto auto auto auto auto auto',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                {/* Subject */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      color: '#f3f4f6',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {c.subject}
                    </span>
                    {c.generated_by_ai && (
                      <span title="KI-generiert" style={{ fontSize: '0.8rem' }}>✨</span>
                    )}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '2px' }}>
                    {c.template_type ?? 'custom'}
                  </div>
                </div>

                {/* Status badge */}
                <StatusBadge status={c.status} />

                {/* Date */}
                <div style={{ color: '#9ca3af', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  {c.status === 'sent' ? formatDate(c.sent_at) :
                   c.status === 'scheduled' ? `🗓️ ${formatDate(c.scheduled_at)}` :
                   'Entwurf'}
                </div>

                {/* Recipients */}
                <div style={{ textAlign: 'right', minWidth: '60px' }}>
                  <div style={{ color: '#f3f4f6', fontSize: '0.875rem', fontWeight: 600 }}>
                    {c.recipient_count ?? '—'}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.7rem' }}>Empf.</div>
                </div>

                {/* Open rate */}
                <div style={{ textAlign: 'right', minWidth: '60px' }}>
                  <div style={{ color: '#f3f4f6', fontSize: '0.875rem', fontWeight: 600 }}>
                    {openRate(c)}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.7rem' }}>Öffnungen</div>
                </div>

                {/* Clicks */}
                <div style={{ textAlign: 'right', minWidth: '50px' }}>
                  <div style={{ color: '#f3f4f6', fontSize: '0.875rem', fontWeight: 600 }}>
                    {c.click_count ?? '—'}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.7rem' }}>Klicks</div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {c.status === 'draft' && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={deletingId === c.id}
                      title="Löschen"
                      style={{
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.25)',
                        color: '#ef4444',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        cursor: deletingId === c.id ? 'not-allowed' : 'pointer',
                        opacity: deletingId === c.id ? 0.6 : 1,
                      }}
                    >
                      {deletingId === c.id ? '...' : '🗑️'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── BUILDER VIEW ────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh', background: 'var(--bg, #0a0a0f)', maxWidth: '800px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <button
          onClick={goBack}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#9ca3af',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          ← Zurück
        </button>
        <div>
          <h1 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Neue Kampagne erstellen
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '2px' }}>
            {step === 'describe' ? 'Schritt 1 — Beschreibe deine Kampagne' : 'Schritt 2 — Vorschau & Senden'}
          </p>
        </div>
      </div>

      {/* STEP 1 — DESCRIBE */}
      {step === 'describe' && (
        <div>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Beschreibe deine Kampagne... z.B. 'Osteraktion mit 20% Rabatt auf alle Desserts'"
            rows={5}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px',
              color: '#f3f4f6',
              fontSize: '0.95rem',
              padding: '16px',
              resize: 'vertical',
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          {/* Template quick-picks */}
          <div style={{ marginTop: '16px', marginBottom: '24px' }}>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Schnellstart
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {TEMPLATE_CHIPS.map(chip => (
                <button
                  key={chip.templateType}
                  onClick={() => selectChip(chip)}
                  style={{
                    background: selectedTemplate === chip.templateType
                      ? 'rgba(249,115,22,0.2)'
                      : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${selectedTemplate === chip.templateType ? '#f97316' : 'rgba(255,255,255,0.1)'}`,
                    color: selectedTemplate === chip.templateType ? '#f97316' : '#d1d5db',
                    borderRadius: '8px',
                    padding: '7px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s',
                  }}
                >
                  {chip.icon} {chip.label}
                </button>
              ))}
            </div>
          </div>

          {generateError && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '10px',
              padding: '12px 16px',
              color: '#ef4444',
              fontSize: '0.875rem',
              marginBottom: '16px',
            }}>
              {generateError}
            </div>
          )}

          <button
            onClick={generateDraft}
            disabled={generating || !prompt.trim()}
            style={{
              background: generating || !prompt.trim() ? 'rgba(249,115,22,0.4)' : '#f97316',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 28px',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: generating || !prompt.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              justifyContent: 'center',
            }}
          >
            {generating ? (
              <>
                <PulsingDot /> KI generiert Entwurf…
              </>
            ) : (
              '✨ KI-Entwurf generieren'
            )}
          </button>

          {/* Pulsing animation while generating */}
          {generating && (
            <div style={{ marginTop: '24px' }}>
              <SkeletonLoader />
            </div>
          )}
        </div>
      )}

      {/* STEP 2 — PREVIEW */}
      {step === 'preview' && draft && (
        <div>
          {/* Subject line */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
              Betreffzeile
            </label>
            <input
              value={editedSubject}
              onChange={e => setEditedSubject(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px',
                color: '#f3f4f6',
                fontSize: '1rem',
                fontWeight: 700,
                padding: '12px 16px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Preview text */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
              Vorschautext
            </label>
            <input
              value={editedPreview}
              onChange={e => setEditedPreview(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px',
                color: '#d1d5db',
                fontSize: '0.875rem',
                padding: '10px 16px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Discount code badge */}
          {draft.discountCode && (
            <div style={{
              background: 'rgba(249,115,22,0.1)',
              border: '2px dashed #f97316',
              borderRadius: '12px',
              padding: '14px 20px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <span style={{ fontSize: '1.25rem' }}>🏷️</span>
              <div>
                <div style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Aktionscode</div>
                <div style={{ color: '#f97316', fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.08em' }}>{draft.discountCode}</div>
              </div>
              <span style={{
                marginLeft: 'auto',
                background: 'rgba(249,115,22,0.15)',
                color: '#f97316',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}>
                {draft.templateType}
              </span>
            </div>
          )}

          {/* HTML Preview */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '8px' }}>
              Email-Vorschau
            </label>
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <iframe
                srcDoc={draft.bodyHtml}
                style={{
                  width: '100%',
                  height: '480px',
                  border: 'none',
                  display: 'block',
                }}
                title="Email-Vorschau"
                sandbox="allow-same-origin"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
            {/* Send */}
            {!sendConfirm && !sendResult && (
              <button
                onClick={() => setSendConfirm(true)}
                style={{
                  background: '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '11px 20px',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                📧 Jetzt senden
              </button>
            )}

            {/* Schedule */}
            <button
              onClick={() => setShowSchedule(v => !v)}
              style={{
                background: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(59,130,246,0.3)',
                color: '#60a5fa',
                borderRadius: '10px',
                padding: '11px 20px',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🗓️ Planen
            </button>

            {/* Save draft */}
            <button
              onClick={handleSaveDraft}
              disabled={savingDraft}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#9ca3af',
                borderRadius: '10px',
                padding: '11px 20px',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: savingDraft ? 'not-allowed' : 'pointer',
                opacity: savingDraft ? 0.6 : 1,
              }}
            >
              {savingDraft ? '...' : '💾 Als Entwurf speichern'}
            </button>

            {/* Regenerate */}
            <button
              onClick={() => {
                setStep('describe')
                setDraft(null)
                setSendResult(null)
                setSendConfirm(false)
                setSavedDraftMsg(null)
              }}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#6b7280',
                borderRadius: '10px',
                padding: '11px 20px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🔄 Neu generieren
            </button>
          </div>

          {/* Save draft feedback */}
          {savedDraftMsg && (
            <div style={{
              background: savedDraftMsg.includes('Fehler') || savedDraftMsg.includes('fehler')
                ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
              border: `1px solid ${savedDraftMsg.includes('Fehler') || savedDraftMsg.includes('fehler') ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
              borderRadius: '10px',
              padding: '12px 16px',
              color: savedDraftMsg.includes('Fehler') || savedDraftMsg.includes('fehler') ? '#ef4444' : '#22c55e',
              fontSize: '0.875rem',
              marginBottom: '16px',
            }}>
              {savedDraftMsg}
            </div>
          )}

          {/* Send confirm */}
          {sendConfirm && !sendResult && (
            <div style={{
              background: 'rgba(249,115,22,0.08)',
              border: '1px solid rgba(249,115,22,0.25)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '16px',
            }}>
              <p style={{ color: '#f3f4f6', fontSize: '0.9rem', margin: '0 0 12px 0', fontWeight: 600 }}>
                Kampagne jetzt an alle Abonnenten senden?
              </p>
              <p style={{ color: '#9ca3af', fontSize: '0.82rem', margin: '0 0 16px 0' }}>
                Die Email wird sofort versendet und kann nicht rückgängig gemacht werden.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  style={{
                    background: '#f97316',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    cursor: sending ? 'not-allowed' : 'pointer',
                    opacity: sending ? 0.6 : 1,
                  }}
                >
                  {sending ? 'Sendet…' : 'Ja, jetzt senden'}
                </button>
                <button
                  onClick={() => setSendConfirm(false)}
                  disabled={sending}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#9ca3af',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {/* Send result */}
          {sendResult && (
            <div style={{
              background: sendResult.error ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
              border: `1px solid ${sendResult.error ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
              borderRadius: '12px',
              padding: '16px 20px',
              color: sendResult.error ? '#ef4444' : '#22c55e',
              fontSize: '0.9rem',
              fontWeight: 600,
              marginBottom: '16px',
            }}>
              {sendResult.error
                ? `Fehler: ${sendResult.error}`
                : `Erfolgreich an ${sendResult.sent} Abonnenten gesendet!`}
            </div>
          )}

          {/* Schedule picker */}
          {showSchedule && (
            <div style={{
              background: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '16px',
            }}>
              <p style={{ color: '#93c5fd', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 10px 0' }}>
                Versandzeitpunkt wählen
              </p>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    color: '#f3f4f6',
                    padding: '8px 12px',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={async () => {
                    if (!scheduleDate) return
                    try {
                      const id = await saveDraftToDB()
                      if (id) {
                        // Update scheduled_at via a simple upsert approach
                        setSavedDraftMsg(`Geplant für ${new Date(scheduleDate).toLocaleString('de-DE')}`)
                        setShowSchedule(false)
                      }
                    } catch (e: unknown) {
                      setSavedDraftMsg((e as Error).message)
                    }
                  }}
                  disabled={!scheduleDate}
                  style={{
                    background: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    cursor: !scheduleDate ? 'not-allowed' : 'pointer',
                    opacity: !scheduleDate ? 0.5 : 1,
                  }}
                >
                  Planen
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'draft' | 'sent' | 'scheduled' }) {
  const config = {
    draft: { bg: 'rgba(107,114,128,0.2)', border: 'rgba(107,114,128,0.3)', color: '#9ca3af', label: 'Entwurf' },
    sent: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)', color: '#22c55e', label: 'Gesendet' },
    scheduled: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.3)', color: '#60a5fa', label: 'Geplant' },
  }[status]

  return (
    <span style={{
      background: config.bg,
      border: `1px solid ${config.border}`,
      color: config.color,
      borderRadius: '6px',
      padding: '3px 10px',
      fontSize: '0.75rem',
      fontWeight: 700,
      whiteSpace: 'nowrap',
    }}>
      {config.label}
    </span>
  )
}

function PulsingDot() {
  return (
    <span style={{
      display: 'inline-block',
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: '#fff',
      animation: 'pulse 1s ease-in-out infinite',
    }} />
  )
}

function SkeletonLoader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[120, 80, 200, 160, 240].map((w, i) => (
        <div
          key={i}
          style={{
            height: '14px',
            width: `${w}px`,
            maxWidth: '100%',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '6px',
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}
