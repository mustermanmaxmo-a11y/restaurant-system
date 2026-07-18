'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Template {
  id: string
  name: string
  trigger_type: string | null
  subject_template: string
  body_html: string
  is_active: boolean
  created_by_ai: boolean
  created_at: string
  style?: string | null
  uses_style?: boolean | null
}

const STYLE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Vom Branding übernehmen' },
  { value: 'modern-classic', label: 'Modern Classic' },
  { value: 'elegant-gold', label: 'Elegant Gold' },
  { value: 'warm-trattoria', label: 'Warm Trattoria' },
]

const PACKAGE_TO_STYLE_LABEL: Record<string, string> = {
  'modern-classic': 'Modern Classic',
  'elegant-gold': 'Elegant Gold',
  'warm-trattoria': 'Warm Trattoria',
  'minimalist-light': 'Modern Classic', // fallback
  'bold-street': 'Modern Classic',
  'zen-garden': 'Modern Classic',
  'biergarten-fresh': 'Modern Classic',
  'neon-nights': 'Modern Classic',
}

const SUGGESTABLE_TRIGGERS: { trigger: string; icon: string; title: string; description: string }[] = [
  { trigger: 'birthday', icon: '🎂', title: 'Geburtstags-Email', description: 'Persönlicher Glückwunsch + Gutschein als Geschenk' },
  { trigger: 'inactivity_14d', icon: '💌', title: 'Comeback nach 14 Tagen', description: 'Reaktiviert Gäste, die eine Weile nicht da waren' },
  { trigger: 'post_order', icon: '📦', title: 'Dankeschön nach Bestellung', description: 'Mit Sterne-Bewertung & Wieder-Bestellen-Button' },
  { trigger: 'seasonal', icon: '🌿', title: 'Saisonales Angebot', description: 'Für Weihnachten, Valentinstag, Ostern usw.' },
  { trigger: 'manual', icon: '✋', title: 'Allgemeine Kampagne', description: 'Für Specials, News, Events — flexibel einsetzbar' },
]

const TRIGGER_LABELS: Record<string, string> = {
  birthday: '🎂 Geburtstag',
  inactivity_14d: '💌 Comeback',
  seasonal: '🌿 Saisonal',
  post_order: '📦 Nach Bestellung',
  scheduled: '📅 Geplant',
  manual: '✋ Manuell',
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'Alle' },
  { value: 'birthday', label: '🎂 Geburtstag' },
  { value: 'inactivity_14d', label: '💌 Comeback' },
  { value: 'seasonal', label: '🌿 Saisonal' },
  { value: 'manual', label: '✋ Manuell' },
]

interface TemplateLibraryProps {
  initialTemplates: Template[]
  restaurantId: string
  designPackage?: string | null
  emailStyleOverride?: string | null
}

export function TemplateLibrary({ initialTemplates, restaurantId: _restaurantId, designPackage, emailStyleOverride }: TemplateLibraryProps) {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [filter, setFilter] = useState('all')
  const [generatingTrigger, setGeneratingTrigger] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const resolvedStyleLabel = emailStyleOverride
    ? (STYLE_OPTIONS.find(s => s.value === emailStyleOverride)?.label ?? 'Modern Classic')
    : (designPackage ? PACKAGE_TO_STYLE_LABEL[designPackage] ?? 'Modern Classic' : 'Modern Classic')

  const missingTriggers = SUGGESTABLE_TRIGGERS.filter(
    s => !templates.some(t => t.trigger_type === s.trigger && t.is_active)
  )

  async function generateSuggestion(trigger: string) {
    setGeneratingTrigger(trigger)
    setGenerateError(null)
    try {
      const res = await fetch('/api/marketing/templates/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger_type: trigger }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGenerateError(data.error ?? 'Konnte Vorschlag nicht erstellen')
      } else if (data.template) {
        setTemplates(prev => [data.template as Template, ...prev])
      }
    } catch {
      setGenerateError('Netzwerkfehler. Bitte erneut versuchen.')
    } finally {
      setGeneratingTrigger(null)
    }
  }
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSubject, setEditSubject] = useState('')
  const [editStyle, setEditStyle] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewMobile, setPreviewMobile] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (!previewTemplate) { setPreviewHtml(''); return }
    setPreviewLoading(true)
    setPreviewHtml('')
    fetch(`/api/marketing/templates?preview=${previewTemplate.id}`, { credentials: 'include' })
      .then(r => r.ok ? r.text() : Promise.reject(new Error(`Status ${r.status}`)))
      .then(html => setPreviewHtml(html))
      .catch(() => setPreviewHtml(previewTemplate.body_html || '<p style="padding:40px;text-align:center;color:#888;font-family:sans-serif">Vorschau konnte nicht geladen werden.</p>'))
      .finally(() => setPreviewLoading(false))
  }, [previewTemplate])

  const filtered = filter === 'all' ? templates : templates.filter(t => t.trigger_type === filter)

  async function toggleActive(id: string, current: boolean) {
    await fetch('/api/marketing/templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !current }),
    })
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, is_active: !current } : t))
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Template wirklich löschen?')) return
    await fetch(`/api/marketing/templates?id=${id}`, { method: 'DELETE' })
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  async function saveEdit(id: string) {
    setSaving(true)
    const payload: Record<string, unknown> = { id, name: editName, subject_template: editSubject }
    // Only attach style when the template is style-based (not custom HTML)
    const tpl = templates.find(t => t.id === id)
    if (tpl?.uses_style !== false) payload.style = editStyle || null
    await fetch('/api/marketing/templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, name: editName, subject_template: editSubject, style: editStyle || null } : t))
    setEditingId(null)
    setSaving(false)
  }

  return (
    <div style={{ padding: '28px 24px', maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.02em' }}>Email-Templates</h1>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>KI-generierte Templates für Automationen — werden beim Versand mit Branding befüllt</p>
        </div>
        <button
          onClick={() => router.push('/admin/marketing/advisor')}
          style={{ background: '#0e7490', border: 'none', borderRadius: '10px', padding: '10px 18px', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
        >
          + KI-Berater öffnen
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            style={{
              background: filter === opt.value ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${filter === opt.value ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '8px',
              padding: '6px 14px',
              color: filter === opt.value ? '#0e7490' : '#9ca3af',
              fontWeight: filter === opt.value ? 700 : 500,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* AI Suggestions Panel */}
      {missingTriggers.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.05))', border: '1px solid rgba(139,92,246,0.18)', borderRadius: '14px', padding: '18px 20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.1rem' }}>✨</span>
              <div>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>KI-Vorschläge</p>
                <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: '2px 0 0' }}>
                  Auf deinen Brand-Stil <strong style={{ color: '#7dd3e8' }}>{resolvedStyleLabel}</strong> abgestimmt — ein Klick erstellt das Template.
                </p>
              </div>
            </div>
          </div>

          {generateError && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '8px 12px', color: '#fca5a5', fontSize: '0.8rem', marginBottom: '10px' }}>
              {generateError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
            {missingTriggers.map(s => {
              const isGen = generatingTrigger === s.trigger
              return (
                <button
                  key={s.trigger}
                  onClick={() => generateSuggestion(s.trigger)}
                  disabled={isGen || generatingTrigger !== null}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    textAlign: 'left',
                    cursor: isGen || generatingTrigger !== null ? 'wait' : 'pointer',
                    opacity: generatingTrigger && !isGen ? 0.4 : 1,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={e => { if (!generatingTrigger) e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '1rem' }}>{s.icon}</span>
                    <span style={{ color: '#f3f4f6', fontWeight: 700, fontSize: '0.82rem' }}>{s.title}</span>
                  </div>
                  <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: '0 0 8px', lineHeight: 1.4 }}>{s.description}</p>
                  <span style={{ display: 'inline-block', background: isGen ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.12)', color: '#7dd3e8', fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: '5px' }}>
                    {isGen ? '✨ generiert…' : '+ Erstellen'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '48px', textAlign: 'center' }}>
          <p style={{ color: '#4b5563', fontSize: '0.95rem', margin: '0 0 16px' }}>Noch keine Templates. Lass die KI eines erstellen.</p>
          <button
            onClick={() => router.push('/admin/marketing/advisor')}
            style={{ background: '#0e7490', border: 'none', borderRadius: '8px', padding: '10px 20px', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
          >
            KI-Berater öffnen →
          </button>
        </div>
      )}

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {filtered.map(tpl => (
          <div
            key={tpl.id}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${tpl.is_active ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: '14px',
              overflow: 'hidden',
              opacity: tpl.is_active ? 1 : 0.6,
            }}
          >
            {/* Preview iframe */}
            <div style={{ height: '200px', background: '#1a1a1a', position: 'relative', overflow: 'hidden' }}>
              <iframe
                srcDoc={tpl.body_html}
                style={{ width: '200%', height: '400px', border: 'none', transform: 'scale(0.5)', transformOrigin: '0 0', pointerEvents: 'none' }}
                sandbox="allow-same-origin"
                title={tpl.name}
              />
              <button
                onClick={() => setPreviewTemplate(tpl)}
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
              >
                <span style={{ background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>Vorschau öffnen</span>
              </button>
            </div>

            {/* Info */}
            <div style={{ padding: '14px 16px' }}>
              {editingId === tpl.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Template Name"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '0.82rem', outline: 'none' }}
                  />
                  <input
                    value={editSubject}
                    onChange={e => setEditSubject(e.target.value)}
                    placeholder="Betreff-Template"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '0.82rem', outline: 'none' }}
                  />
                  {tpl.uses_style !== false ? (
                    <select
                      value={editStyle}
                      onChange={e => setEditStyle(e.target.value)}
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '0.82rem', outline: 'none' }}
                    >
                      {STYLE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value} style={{ background: '#1a1a1a' }}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <p style={{ color: '#6b7280', fontSize: '0.72rem', margin: 0, fontStyle: 'italic' }}>Eigenes HTML — Style wird ignoriert.</p>
                  )}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => saveEdit(tpl.id)} disabled={saving} style={{ background: '#0e7490', border: 'none', borderRadius: '6px', padding: '5px 12px', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                      {saving ? '...' : 'Speichern'}
                    </button>
                    <button onClick={() => setEditingId(null)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '5px 12px', color: '#9ca3af', fontSize: '0.78rem', cursor: 'pointer' }}>
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>{tpl.name}</p>
                    {tpl.created_by_ai && (
                      <span style={{ background: 'rgba(139,92,246,0.15)', color: '#0e7490', fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, flexShrink: 0, marginLeft: '8px' }}>✨ KI</span>
                    )}
                  </div>
                  {tpl.trigger_type && (
                    <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0 0 4px' }}>{TRIGGER_LABELS[tpl.trigger_type] ?? tpl.trigger_type}</p>
                  )}
                  <p style={{ color: '#9ca3af', fontSize: '0.78rem', margin: '0 0 12px', fontStyle: 'italic' }}>
                    Betreff: {tpl.subject_template}
                  </p>
                </>
              )}

              {/* Actions */}
              {editingId !== tpl.id && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { setEditingId(tpl.id); setEditName(tpl.name); setEditSubject(tpl.subject_template); setEditStyle(tpl.style ?? '') }}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '5px 10px', color: '#9ca3af', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    ✏️ Bearbeiten
                  </button>
                  <button
                    onClick={() => toggleActive(tpl.id, tpl.is_active)}
                    style={{ background: tpl.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${tpl.is_active ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '6px', padding: '5px 10px', color: tpl.is_active ? '#22c55e' : '#6b7280', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    {tpl.is_active ? '✓ Aktiv' : '○ Inaktiv'}
                  </button>
                  <button
                    onClick={() => deleteTemplate(tpl.id)}
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '5px 10px', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    🗑
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {previewTemplate && (
        <div
          onClick={() => { setPreviewTemplate(null); setPreviewMobile(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', borderRadius: '16px', overflow: 'hidden', width: '100%', maxWidth: '760px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem', margin: 0, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewTemplate.name}</p>
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '3px' }}>
                <button onClick={() => setPreviewMobile(false)} style={{ background: !previewMobile ? '#0e7490' : 'transparent', border: 'none', borderRadius: '5px', padding: '4px 10px', color: !previewMobile ? '#fff' : '#9ca3af', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>Desktop</button>
                <button onClick={() => setPreviewMobile(true)} style={{ background: previewMobile ? '#0e7490' : 'transparent', border: 'none', borderRadius: '5px', padding: '4px 10px', color: previewMobile ? '#fff' : '#9ca3af', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>Mobile</button>
              </div>
              <button onClick={() => { setPreviewTemplate(null); setPreviewMobile(false) }} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', background: '#f5f5f5', display: 'flex', justifyContent: 'center', padding: previewMobile ? '20px 0' : '0' }}>
              {previewLoading ? (
                <div style={{ alignSelf: 'center', color: '#888', fontSize: '0.85rem' }}>Lade Vorschau…</div>
              ) : (
                <iframe
                  srcDoc={previewHtml}
                  style={{ width: previewMobile ? '380px' : '100%', height: '720px', border: previewMobile ? '1px solid rgba(0,0,0,0.15)' : 'none', borderRadius: previewMobile ? '12px' : '0', background: '#fff' }}
                  sandbox="allow-same-origin"
                  title={previewTemplate.name}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
