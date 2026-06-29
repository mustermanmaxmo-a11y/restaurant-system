'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  LP_LAYOUTS,
  type LpLayoutSlug,
  type LandingPageContent,
  type LandingPageRow,
  type OpeningHours,
} from '@/lib/lp-layouts'
import type { Restaurant } from '@/types/database'
import type { SectionKey } from '@/lib/landing-content'
import { PreviewPane } from './editor/PreviewPane'

// ─── Constants ────────────────────────────────────────────────────────────────
type LpTab = 'templates' | 'inhalt' | 'farben' | 'layout' | 'ki-chat'

// Der Landing-Layout-Wähler ist vorerst ausgeblendet: die öffentliche Landing-Seite
// (app/[slug]/info) rendert aktuell nur ein festes Hero-Layout. Sobald die 4 Layouts
// (classic-hero/split-hero/minimal/bold-fullscreen) dort echt gebaut sind (#2/#3),
// hier wieder auf true setzen. lpLayout bleibt unterdessen auf 'classic-hero'.
const SHOW_LP_LAYOUT_PICKER = false

const FEATURE_BADGE_OPTIONS = [
  'Vegetarisch', 'Vegan', 'Glutenfrei', 'Halal',
  'Lieferung', 'Reservierung', 'Takeaway', 'Catering',
  'Wifi', 'Terrasse', 'Parkplatz',
]

const DAYS = [
  { key: 'mo' as const, label: 'Montag' },
  { key: 'di' as const, label: 'Dienstag' },
  { key: 'mi' as const, label: 'Mittwoch' },
  { key: 'do' as const, label: 'Donnerstag' },
  { key: 'fr' as const, label: 'Freitag' },
  { key: 'sa' as const, label: 'Samstag' },
  { key: 'so' as const, label: 'Sonntag' },
]

// ─── Style helpers ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1.5px solid var(--border)', background: 'var(--surface-2)',
  color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
}
const fieldLabel: React.CSSProperties = {
  display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px',
}
const sectionTitle: React.CSSProperties = {
  fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)', marginBottom: '12px',
}
const navItemStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
  padding: '10px 6px', cursor: 'pointer', borderRadius: '8px',
  background: active ? 'var(--surface-2)' : 'transparent',
  color: active ? 'var(--accent)' : 'var(--text-muted)',
  fontSize: '9px', fontWeight: active ? 700 : 500,
  textTransform: 'uppercase', letterSpacing: '0.03em',
  border: 'none', width: '100%', transition: 'all 0.15s',
})

const brandInheritHint: React.CSSProperties = {
  padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: '10px', fontSize: '0.8rem', color: 'var(--text-muted)',
}

// ─── ImageDropzone ─────────────────────────────────────────────────────────────
function ImageDropzone({
  label, previewUrl, uploading, onFile, hint,
}: {
  label: string; previewUrl?: string; uploading: boolean
  onFile: (f: File) => void; hint?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      {label && <label style={fieldLabel}>{label}</label>}
      <div
        onClick={() => ref.current?.click()}
        style={{
          border: '2px dashed var(--border)', borderRadius: '10px',
          padding: previewUrl ? '8px' : '18px',
          textAlign: 'center', cursor: 'pointer',
          background: 'var(--surface-2)', position: 'relative',
        }}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" style={{ width: '100%', maxHeight: '100px', objectFit: 'cover', borderRadius: '6px' }} />
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <div style={{ fontSize: '1.4rem', marginBottom: '3px' }}>+</div>
            {uploading ? 'Wird hochgeladen…' : hint ?? 'Klicken zum Hochladen'}
            <div style={{ fontSize: '0.65rem', marginTop: '2px', opacity: 0.5 }}>JPEG, PNG, WebP · max. 8 MB</div>
          </div>
        )}
        {uploading && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '10px', color: '#fff', fontSize: '0.8rem',
          }}>Wird hochgeladen…</div>
        )}
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
    </div>
  )
}

// ─── VisibilityToggle ──────────────────────────────────────────────────────────
function VisibilityToggle({ visible, onChange }: { visible: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!visible)}
      title={visible ? 'Sektion sichtbar — klicken zum Ausblenden' : 'Sektion ausgeblendet — klicken zum Einblenden'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
        border: `1.5px solid ${visible ? 'var(--accent)' : 'var(--border)'}`,
        background: visible ? 'var(--accent)' : 'transparent',
        color: visible ? '#fff' : 'var(--text-muted)',
        fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap',
      }}
    >
      {visible ? '👁 Sichtbar' : '🚫 Aus'}
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
  restaurant: Restaurant
}

export default function LandingPageTab({ restaurant }: Props) {
  const [activeTab, setActiveTab] = useState<LpTab>('inhalt')
  const [landingPage, setLandingPage] = useState<LandingPageRow | null>(null)
  const [content, setContent] = useState<LandingPageContent>({})
  const [lpLayout, setLpLayout] = useState<LpLayoutSlug>('classic-hero')
  const [isPublished, setIsPublished] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [reloadToken, setReloadToken] = useState(0)
  const didLoad = useRef(false)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return

      const res = await fetch(`/api/admin/landing-page?restaurant_id=${restaurant.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return

      const json = await res.json()
      const lp = json.data as LandingPageRow
      setLandingPage(lp)
      setIsPublished(lp.is_published ?? false)

      const c = lp.content ?? {}
      setLpLayout(c.lp_layout ?? 'classic-hero')
      setContent(c)
      didLoad.current = true
    }
    load()
  }, [restaurant])

  // Debounced Auto-Save: speichert ~0,8s nach der letzten Änderung und lädt danach die Vorschau neu.
  useEffect(() => {
    if (!didLoad.current) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => { void handleSave() }, 800)
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, lpLayout, isPublished])

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave(overrides?: Partial<{ is_published: boolean; contentOverride: LandingPageContent }>) {
    setSaving(true); setSaveError(''); setSaved(false)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setSaving(false); return }

    const fullContent: LandingPageContent = { ...(overrides?.contentOverride ?? content), lp_layout: lpLayout }

    const res = await fetch('/api/admin/landing-page', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        restaurant_id: restaurant.id,
        content: fullContent,
        is_published: overrides?.is_published ?? isPublished,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setSaveError(j.error ?? 'Speichern fehlgeschlagen'); return
    }
    const j = await res.json()
    setLandingPage(j.data)
    if (overrides?.is_published !== undefined) setIsPublished(overrides.is_published)
    setReloadToken(t => t + 1)
    setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  async function handlePublishToggle() {
    const next = !isPublished; setIsPublished(next)
    await handleSave({ is_published: next })
  }

  // Lädt ein Bild hoch und gibt die URL zurück (oder null). busyKey steuert den Lade-Spinner.
  async function uploadImage(file: File, apiType: string, busyKey: string): Promise<string | null> {
    setUploading(prev => ({ ...prev, [busyKey]: true }))
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const form = new FormData()
    form.append('restaurant_id', restaurant.id)
    form.append('file', file)
    form.append('type', apiType)

    const res = await fetch('/api/admin/landing-page/upload', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    setUploading(prev => ({ ...prev, [busyKey]: false }))
    if (!res.ok) return null
    const j = await res.json()
    return typeof j.url === 'string' ? j.url : null
  }

  async function handleUpload(file: File, type: 'hero' | 'logo' | 'gallery') {
    const url = await uploadImage(file, type, type)
    if (!url) return
    let updatedContent: LandingPageContent
    if (type === 'gallery') {
      updatedContent = { ...content, gallery: [...(content.gallery ?? []), url].slice(0, 6) }
    } else if (type === 'hero') {
      updatedContent = { ...content, hero_image_url: url }
    } else {
      updatedContent = { ...content, logo_url: url }
    }
    setContent(updatedContent)
    await handleSave({ contentOverride: updatedContent })
  }

  async function handleGenerate() {
    setGenerating(true); setGenerateError('')
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setGenerating(false); return }

    const res = await fetch('/api/ai/landing-page-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ restaurant_id: restaurant.id }),
    })
    setGenerating(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setGenerateError(j.error ?? 'KI-Generierung fehlgeschlagen'); return
    }
    const j = await res.json()
    setContent(prev => ({
      ...prev,
      headline:      j.headline     ?? prev.headline,
      subheadline:   j.subheadline  ?? prev.subheadline,
      about_text:    j.about_text   ?? prev.about_text,
      cta_text:      j.cta_text     ?? prev.cta_text,
      ...(Array.isArray(j.feature_badges) && j.feature_badges.length > 0
        ? { feature_badges: j.feature_badges }
        : {}),
    }))
  }

  const [generatingField, setGeneratingField] = useState<string | null>(null)
  async function handleGenerateField(field: 'about' | 'story') {
    setGeneratingField(field); setGenerateError('')
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setGeneratingField(null); return }

    const res = await fetch('/api/ai/landing-section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ restaurant_id: restaurant.id, field }),
    })
    setGeneratingField(null)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setGenerateError(j.error ?? 'KI-Generierung fehlgeschlagen'); return
    }
    const j = await res.json()
    if (typeof j.text === 'string') {
      setContent(prev => field === 'about' ? { ...prev, about_text: j.text } : { ...prev, story_text: j.text })
    }
  }

  const isVis = (key: SectionKey) => content.section_visibility?.[key] !== false
  const setVisible = (key: SectionKey, visible: boolean) =>
    setContent(prev => ({ ...prev, section_visibility: { ...prev.section_visibility, [key]: visible } }))

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative', flex: 1 }}>

      {/* Save/publish bar */}
      <div style={{
        position: 'absolute', top: 0, right: 0, zIndex: 10,
        display: 'flex', gap: '8px', padding: '12px 16px', alignItems: 'center',
      }}>
        {saveError && <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>{saveError}</span>}
        <button
          onClick={() => handleSave()}
          disabled={saving}
          style={{
            padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: saved ? '#10b981' : 'var(--accent)', color: '#fff',
            fontWeight: 700, fontSize: '0.8rem', opacity: saving ? 0.7 : 1, transition: 'background 0.2s',
          }}
        >
          {saving ? 'Speichern…' : saved ? '✓ Gespeichert' : 'Speichern'}
        </button>
        <button
          onClick={handlePublishToggle}
          disabled={saving}
          style={{
            padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700,
            fontSize: '0.8rem', transition: 'all 0.2s',
            background: isPublished ? 'transparent' : '#10b981',
            color: isPublished ? 'var(--text-muted)' : '#fff',
            border: isPublished ? '1.5px solid var(--border)' : 'none',
          }}
        >
          {isPublished ? 'Depublizieren' : 'Publizieren'}
        </button>
      </div>

      {/* Left nav */}
      <div style={{
        width: '60px', flexShrink: 0, borderRight: '1px solid var(--border)',
        padding: '56px 6px 8px', display: 'flex', flexDirection: 'column', gap: '2px',
      }}>
        {([
          { id: 'templates' as LpTab, icon: '⬛', label: 'Designs' },
          { id: 'inhalt'    as LpTab, icon: '✏️', label: 'Inhalt' },
          { id: 'farben'    as LpTab, icon: '🎨', label: 'Farben' },
          ...(SHOW_LP_LAYOUT_PICKER ? [{ id: 'layout' as LpTab, icon: '▦', label: 'Layout' }] : []),
          { id: 'ki-chat'   as LpTab, icon: '✦',  label: 'KI' },
        ]).map(item => (
          <button key={item.id} style={navItemStyle(activeTab === item.id)} onClick={() => setActiveTab(item.id)}>
            <span style={{ fontSize: '16px' }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Center content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingTop: '60px' }}>

        {/* ── TEMPLATES TAB ── */}
        {activeTab === 'templates' && (
          <div>
            <div style={sectionTitle}>Design</div>
            <div style={brandInheritHint}>
              Farben &amp; Schriftart werden automatisch aus deinem <strong>Brand</strong> (Tab „Bestellseite") übernommen — so bleiben Landing- und Bestellseite immer einheitlich. Hier legst du nur Landing-spezifische Inhalte fest (Hero, Headline, Galerie, Layout).
            </div>

            {SHOW_LP_LAYOUT_PICKER && (<>
            <div style={{ ...sectionTitle, marginTop: '24px' }}>Landing Page Layout</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {LP_LAYOUTS.map(layout => {
                const isActive = lpLayout === layout.slug
                return (
                  <button
                    key={layout.slug}
                    onClick={() => setLpLayout(layout.slug)}
                    style={{
                      padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                      background: isActive ? 'var(--accent)' : 'var(--surface)',
                      outline: isActive ? '2px solid var(--accent)' : '2px solid var(--border)',
                      textAlign: 'left', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isActive ? '#fff' : 'var(--text)', marginBottom: '3px' }}>{layout.label}</div>
                    <div style={{ fontSize: '0.7rem', color: isActive ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}>{layout.desc}</div>
                  </button>
                )
              })}
            </div>
            </>)}
          </div>
        )}

        {/* ── INHALT TAB ── */}
        {activeTab === 'inhalt' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={sectionTitle}>Basis-Inhalte</div>

            <ImageDropzone label="Logo" previewUrl={content.logo_url} uploading={!!uploading['logo']} onFile={f => handleUpload(f, 'logo')} />
            <ImageDropzone label="Hero-Bild" previewUrl={content.hero_image_url} uploading={!!uploading['hero']} onFile={f => handleUpload(f, 'hero')} />

            <div>
              <label style={fieldLabel}>Headline <span style={{ opacity: 0.4 }}>(max. 80)</span></label>
              <input type="text" value={content.headline ?? ''} maxLength={80}
                onChange={e => setContent(prev => ({ ...prev, headline: e.target.value }))}
                placeholder="z.B. Willkommen im besten Ristorante der Stadt" style={inputStyle} />
            </div>

            <div>
              <label style={fieldLabel}>Subheadline <span style={{ opacity: 0.4 }}>(max. 150)</span></label>
              <input type="text" value={content.subheadline ?? ''} maxLength={150}
                onChange={e => setContent(prev => ({ ...prev, subheadline: e.target.value }))}
                placeholder="z.B. Authentische Pasta & Pizza seit 1998" style={inputStyle} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ ...fieldLabel, marginBottom: 0 }}>Über uns <span style={{ opacity: 0.4 }}>(max. 500)</span></label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => handleGenerateField('about')} disabled={generatingField === 'about'}
                    style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.7rem', fontWeight: 700 }}>
                    {generatingField === 'about' ? '⟳' : '✦ KI'}
                  </button>
                  <VisibilityToggle visible={isVis('about')} onChange={v => setVisible('about', v)} />
                </div>
              </div>
              <textarea value={content.about_text ?? ''} maxLength={500} rows={4}
                onChange={e => setContent(prev => ({ ...prev, about_text: e.target.value }))}
                placeholder="Beschreibe dein Restaurant…" style={{ ...inputStyle, resize: 'vertical' }} />
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '3px' }}>
                {(content.about_text ?? '').length}/500
              </div>
            </div>

            <div>
              <label style={fieldLabel}>CTA Button Text <span style={{ opacity: 0.4 }}>(max. 40)</span></label>
              <input type="text" value={content.cta_text ?? ''} maxLength={40}
                onChange={e => setContent(prev => ({ ...prev, cta_text: e.target.value }))}
                placeholder="Jetzt bestellen" style={inputStyle} />
            </div>

            <div>
              <label style={fieldLabel}>CTA Link</label>
              <input type="text" value={content.cta_url ?? `/bestellen/${restaurant.slug ?? ''}`}
                onChange={e => setContent(prev => ({ ...prev, cta_url: e.target.value }))}
                placeholder={`/bestellen/${restaurant.slug ?? '...'}`} style={inputStyle} />
            </div>

            {/* ── Kontakt ── */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ ...sectionTitle, marginBottom: 0 }}>Kontakt & Adresse</div>
                <VisibilityToggle visible={isVis('contact')} onChange={v => setVisible('contact', v)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={fieldLabel}>Adresse</label>
                  <input type="text" value={content.address ?? ''}
                    onChange={e => setContent(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Musterstraße 1, 80331 München" style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabel}>Google Maps Link</label>
                  <input type="text" value={content.maps_url ?? ''}
                    onChange={e => setContent(prev => ({ ...prev, maps_url: e.target.value }))}
                    placeholder="https://maps.google.com/..." style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabel}>Telefon</label>
                  <input type="tel" value={content.phone ?? ''}
                    onChange={e => setContent(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+49 89 123456" style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabel}>E-Mail</label>
                  <input type="email" value={content.email ?? ''}
                    onChange={e => setContent(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="info@restaurant.de" style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabel}>Instagram</label>
                  <input type="text" value={content.instagram ?? ''}
                    onChange={e => setContent(prev => ({ ...prev, instagram: e.target.value }))}
                    placeholder="@restaurantname" style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabel}>Facebook</label>
                  <input type="text" value={content.facebook ?? ''}
                    onChange={e => setContent(prev => ({ ...prev, facebook: e.target.value }))}
                    placeholder="https://facebook.com/..." style={inputStyle} />
                </div>
              </div>
            </div>

            {/* ── Öffnungszeiten ── */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ ...sectionTitle, marginBottom: 0 }}>Öffnungszeiten</div>
                <VisibilityToggle visible={isVis('opening_hours')} onChange={v => setVisible('opening_hours', v)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {DAYS.map(day => {
                  const val = content.opening_hours?.[day.key] ?? { open: true, from: '11:00', to: '22:00' }
                  return (
                    <div key={day.key} style={{ display: 'grid', gridTemplateColumns: '80px auto 1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text)', fontWeight: 600 }}>{day.label.slice(0, 2)}.</span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={val.open}
                          onChange={e => setContent(prev => ({
                            ...prev,
                            opening_hours: { ...prev.opening_hours, [day.key]: { ...val, open: e.target.checked } }
                          }))}
                        />
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Offen</span>
                      </label>
                      {val.open ? (
                        <>
                          <input type="time" value={val.from}
                            onChange={e => setContent(prev => ({
                              ...prev,
                              opening_hours: { ...prev.opening_hours, [day.key]: { ...val, from: e.target.value } }
                            }))}
                            style={{ ...inputStyle, padding: '6px 8px', fontSize: '0.78rem' }} />
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>–</span>
                          <input type="time" value={val.to}
                            onChange={e => setContent(prev => ({
                              ...prev,
                              opening_hours: { ...prev.opening_hours, [day.key]: { ...val, to: e.target.value } }
                            }))}
                            style={{ ...inputStyle, padding: '6px 8px', fontSize: '0.78rem' }} />
                        </>
                      ) : (
                        <span style={{ gridColumn: 'span 3', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Geschlossen</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Galerie ── */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ ...sectionTitle, marginBottom: 0 }}>Foto-Galerie <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-muted)' }}>(max. 6 Bilder)</span></div>
                <VisibilityToggle visible={isVis('gallery')} onChange={v => setVisible('gallery', v)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
                {(content.gallery ?? []).map((url, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }} />
                    <button
                      onClick={() => setContent(prev => ({ ...prev, gallery: (prev.gallery ?? []).filter((_, j) => j !== i) }))}
                      style={{
                        position: 'absolute', top: '3px', right: '3px', background: 'rgba(0,0,0,0.7)',
                        color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px',
                        cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >✕</button>
                  </div>
                ))}
                {(content.gallery ?? []).length < 6 && (
                  <ImageDropzone label="" previewUrl={undefined} uploading={!!uploading['gallery']}
                    onFile={f => handleUpload(f, 'gallery')} hint="Foto hinzufügen" />
                )}
              </div>
            </div>

            {/* ── Feature Badges ── */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={sectionTitle}>Merkmale & Features</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {FEATURE_BADGE_OPTIONS.map(badge => {
                  const active = (content.feature_badges ?? []).includes(badge)
                  return (
                    <button
                      key={badge}
                      onClick={() => setContent(prev => ({
                        ...prev,
                        feature_badges: active
                          ? (prev.feature_badges ?? []).filter(b => b !== badge)
                          : [...(prev.feature_badges ?? []), badge],
                      }))}
                      style={{
                        padding: '6px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                        fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
                        background: active ? 'var(--accent)' : 'var(--surface)',
                        color: active ? '#fff' : 'var(--text-muted)',
                        outline: active ? 'none' : '1.5px solid var(--border)',
                      }}
                    >{badge}</button>
                  )
                })}
              </div>
            </div>

            {/* ── Bewertungen ── */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ ...sectionTitle, marginBottom: 0 }}>Bewertungen</div>
                <VisibilityToggle visible={isVis('reviews')} onChange={v => setVisible('reviews', v)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={fieldLabel}>Google Rating <span style={{ opacity: 0.4 }}>(z.B. 4.8)</span></label>
                    <input
                      type="number" min="1" max="5" step="0.1"
                      value={content.google_rating ?? ''}
                      onChange={e => setContent(prev => ({ ...prev, google_rating: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      placeholder="4.8" style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>Anzahl Bewertungen</label>
                    <input
                      type="number" min="0"
                      value={content.google_review_count ?? ''}
                      onChange={e => setContent(prev => ({ ...prev, google_review_count: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
                      placeholder="247" style={inputStyle}
                    />
                  </div>
                </div>
                <div>
                  <label style={fieldLabel}>Google Maps Link</label>
                  <input
                    type="text"
                    value={content.google_maps_url ?? ''}
                    onChange={e => setContent(prev => ({ ...prev, google_maps_url: e.target.value }))}
                    placeholder="https://maps.app.goo.gl/..." style={inputStyle}
                  />
                </div>
                {[0, 1, 2].map(i => {
                  const quote = content.review_quotes?.[i]
                  return (
                    <div key={i} style={{ background: 'var(--surface)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Zitat {i + 1}</div>
                      <textarea
                        rows={2}
                        value={quote?.text ?? ''}
                        onChange={e => setContent(prev => {
                          const quotes = [...(prev.review_quotes ?? [{ text: '', author: '' }, { text: '', author: '' }, { text: '', author: '' }])]
                          quotes[i] = { ...quotes[i], text: e.target.value }
                          return { ...prev, review_quotes: quotes }
                        })}
                        placeholder="Tolles Essen, super Atmosphäre…"
                        style={{ ...inputStyle, resize: 'vertical' as const }}
                      />
                      <input
                        type="text"
                        value={quote?.author ?? ''}
                        onChange={e => setContent(prev => {
                          const quotes = [...(prev.review_quotes ?? [{ text: '', author: '' }, { text: '', author: '' }, { text: '', author: '' }])]
                          quotes[i] = { ...quotes[i], author: e.target.value }
                          return { ...prev, review_quotes: quotes }
                        })}
                        placeholder="Max M." style={inputStyle}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Team ── */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ ...sectionTitle, marginBottom: 0 }}>Team</div>
                <VisibilityToggle visible={isVis('team')} onChange={v => setVisible('team', v)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(content.team ?? []).map((member, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: '10px', alignItems: 'center', background: 'var(--surface)', borderRadius: '8px', padding: '10px' }}>
                    <ImageDropzone label="" previewUrl={member.photo_url} uploading={!!uploading[`team-${i}`]}
                      onFile={async f => {
                        const url = await uploadImage(f, 'team', `team-${i}`)
                        if (url) setContent(prev => {
                          const team = [...(prev.team ?? [])]; team[i] = { ...team[i], photo_url: url }; return { ...prev, team }
                        })
                      }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <input type="text" value={member.name} placeholder="Name"
                        onChange={e => setContent(prev => { const team = [...(prev.team ?? [])]; team[i] = { ...team[i], name: e.target.value }; return { ...prev, team } })}
                        style={inputStyle} />
                      <input type="text" value={member.role} placeholder="Rolle (z.B. Chefkoch)"
                        onChange={e => setContent(prev => { const team = [...(prev.team ?? [])]; team[i] = { ...team[i], role: e.target.value }; return { ...prev, team } })}
                        style={inputStyle} />
                    </div>
                    <button onClick={() => setContent(prev => ({ ...prev, team: (prev.team ?? []).filter((_, j) => j !== i) }))}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                  </div>
                ))}
                <button onClick={() => setContent(prev => ({ ...prev, team: [...(prev.team ?? []), { name: '', role: '' }] }))}
                  style={{ padding: '8px', borderRadius: '8px', border: '1.5px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
                  + Mitglied hinzufügen
                </button>
              </div>
            </div>

            {/* ── Geschichte ── */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ ...sectionTitle, marginBottom: 0 }}>Unsere Geschichte</div>
                <VisibilityToggle visible={isVis('story')} onChange={v => setVisible('story', v)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <ImageDropzone label="Bild" previewUrl={content.story_image_url} uploading={!!uploading['story']}
                  onFile={async f => { const url = await uploadImage(f, 'story', 'story'); if (url) setContent(prev => ({ ...prev, story_image_url: url })) }} />
                <div>
                  <label style={fieldLabel}>Gegründet (Jahr)</label>
                  <input type="text" value={content.founded_year ?? ''} maxLength={20}
                    onChange={e => setContent(prev => ({ ...prev, founded_year: e.target.value }))}
                    placeholder="1998" style={inputStyle} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ ...fieldLabel, marginBottom: 0 }}>Geschichte</label>
                    <button onClick={() => handleGenerateField('story')} disabled={generatingField === 'story'}
                      style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.7rem', fontWeight: 700 }}>
                      {generatingField === 'story' ? '⟳' : '✦ KI'}
                    </button>
                  </div>
                  <textarea value={content.story_text ?? ''} rows={4}
                    onChange={e => setContent(prev => ({ ...prev, story_text: e.target.value }))}
                    placeholder="Erzähle die Geschichte deines Restaurants…" style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              </div>
            </div>

            {/* ── Atmosphäre ── */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ ...sectionTitle, marginBottom: 0 }}>Atmosphäre <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-muted)' }}>(max. 8)</span></div>
                <VisibilityToggle visible={isVis('ambiance')} onChange={v => setVisible('ambiance', v)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {(content.ambiance_gallery ?? []).map((url, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }} />
                    <button onClick={() => setContent(prev => ({ ...prev, ambiance_gallery: (prev.ambiance_gallery ?? []).filter((_, j) => j !== i) }))}
                      style={{ position: 'absolute', top: '3px', right: '3px', background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                ))}
                {(content.ambiance_gallery ?? []).length < 8 && (
                  <ImageDropzone label="" previewUrl={undefined} uploading={!!uploading['ambiance']}
                    onFile={async f => { const url = await uploadImage(f, 'ambiance', 'ambiance'); if (url) setContent(prev => ({ ...prev, ambiance_gallery: [...(prev.ambiance_gallery ?? []), url].slice(0, 8) })) }}
                    hint="Foto hinzufügen" />
                )}
              </div>
            </div>

            {/* ── Auszeichnungen ── */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ ...sectionTitle, marginBottom: 0 }}>Auszeichnungen & Presse</div>
                <VisibilityToggle visible={isVis('awards')} onChange={v => setVisible('awards', v)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(content.awards ?? []).map((award, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: '10px', alignItems: 'center', background: 'var(--surface)', borderRadius: '8px', padding: '10px' }}>
                    <ImageDropzone label="" previewUrl={award.logo_url} uploading={!!uploading[`award-${i}`]}
                      onFile={async f => { const url = await uploadImage(f, 'award', `award-${i}`); if (url) setContent(prev => { const awards = [...(prev.awards ?? [])]; awards[i] = { ...awards[i], logo_url: url }; return { ...prev, awards } }) }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <input type="text" value={award.title} placeholder="Titel (z.B. Gault&Millau)"
                        onChange={e => setContent(prev => { const awards = [...(prev.awards ?? [])]; awards[i] = { ...awards[i], title: e.target.value }; return { ...prev, awards } })}
                        style={inputStyle} />
                      <input type="text" value={award.subtitle ?? ''} placeholder="Untertitel (z.B. 2024)"
                        onChange={e => setContent(prev => { const awards = [...(prev.awards ?? [])]; awards[i] = { ...awards[i], subtitle: e.target.value }; return { ...prev, awards } })}
                        style={inputStyle} />
                    </div>
                    <button onClick={() => setContent(prev => ({ ...prev, awards: (prev.awards ?? []).filter((_, j) => j !== i) }))}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                  </div>
                ))}
                <button onClick={() => setContent(prev => ({ ...prev, awards: [...(prev.awards ?? []), { title: '' }] }))}
                  style={{ padding: '8px', borderRadius: '8px', border: '1.5px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
                  + Auszeichnung hinzufügen
                </button>
              </div>
            </div>

            {/* ── Weitere Sektionen ── */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={sectionTitle}>Weitere Sektionen ein-/ausblenden</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {([
                  { key: 'featured_menu' as SectionKey, label: 'Menü-Highlights' },
                  { key: 'reservation_cta' as SectionKey, label: 'Reservierungs-Aufruf' },
                  { key: 'instagram' as SectionKey, label: 'Instagram' },
                ]).map(s => (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text)' }}>{s.label}</span>
                    <VisibilityToggle visible={isVis(s.key)} onChange={v => setVisible(s.key, v)} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── FARBEN TAB ── */}
        {activeTab === 'farben' && (
          <div>
            <div style={sectionTitle}>Farben & Schriftart</div>
            <div style={brandInheritHint}>
              Farben &amp; Schriftart werden automatisch aus deinem <strong>Brand</strong> (Tab „Bestellseite") übernommen — so bleiben Landing- und Bestellseite immer einheitlich. Hier legst du nur Landing-spezifische Inhalte fest (Hero, Headline, Galerie, Layout).
            </div>
          </div>
        )}

        {/* ── LAYOUT TAB ── (vorerst ausgeblendet via SHOW_LP_LAYOUT_PICKER) */}
        {SHOW_LP_LAYOUT_PICKER && activeTab === 'layout' && (
          <div>
            <div style={sectionTitle}>Landing Page Layout</div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Wie werden die Sektionen auf der Landing Page angeordnet?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {LP_LAYOUTS.map(layout => {
                const isActive = lpLayout === layout.slug
                return (
                  <button
                    key={layout.slug}
                    onClick={() => setLpLayout(layout.slug)}
                    style={{
                      padding: '14px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                      background: isActive ? 'var(--accent)' : 'var(--surface)',
                      outline: isActive ? '2px solid var(--accent)' : '2px solid var(--border)',
                      textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: '48px', height: '36px', borderRadius: '4px', flexShrink: 0,
                      background: 'var(--surface-2)',
                      border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    }}>
                      <svg width="32" height="24" viewBox="0 0 32 24">
                        {layout.slug === 'classic-hero' && <>
                          <rect x="0" y="0" width="32" height="12" fill="var(--accent)" opacity="0.4" rx="2"/>
                          <rect x="2" y="14" width="28" height="3" fill="var(--text)" opacity="0.4" rx="1"/>
                          <rect x="2" y="19" width="20" height="2" fill="var(--text)" opacity="0.2" rx="1"/>
                        </>}
                        {layout.slug === 'split-hero' && <>
                          <rect x="0" y="0" width="15" height="24" fill="var(--accent)" opacity="0.4" rx="2"/>
                          <rect x="17" y="6" width="13" height="3" fill="var(--text)" opacity="0.4" rx="1"/>
                          <rect x="17" y="11" width="10" height="2" fill="var(--text)" opacity="0.2" rx="1"/>
                        </>}
                        {layout.slug === 'minimal' && <>
                          <rect x="4" y="4" width="24" height="4" fill="var(--text)" opacity="0.6" rx="1"/>
                          <rect x="8" y="10" width="16" height="2" fill="var(--text)" opacity="0.3" rx="1"/>
                          <rect x="10" y="16" width="12" height="5" fill="var(--accent)" opacity="0.5" rx="2"/>
                        </>}
                        {layout.slug === 'bold-fullscreen' && <>
                          <rect x="0" y="0" width="32" height="24" fill="var(--accent)" opacity="0.25" rx="2"/>
                          <rect x="4" y="8" width="24" height="5" fill="var(--text)" opacity="0.7" rx="1"/>
                          <rect x="8" y="15" width="16" height="4" fill="var(--accent)" opacity="0.6" rx="2"/>
                        </>}
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isActive ? '#fff' : 'var(--text)', marginBottom: '3px' }}>{layout.label}</div>
                      <div style={{ fontSize: '0.7rem', color: isActive ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}>{layout.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── KI-CHAT TAB ── */}
        {activeTab === 'ki-chat' && (
          <div>
            <div style={sectionTitle}>KI-Texte generieren</div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
              Die KI generiert Headline, Subheadline, Über-uns-Text und CTA basierend auf deinem Restaurant-Profil.
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
                background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer',
                fontSize: '0.875rem', opacity: generating ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              {generating ? '⟳ Texte werden generiert…' : '✦ Texte mit KI generieren'}
            </button>
            {generateError && (
              <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '8px' }}>{generateError}</div>
            )}
            {(content.headline || content.subheadline || content.about_text) && (
              <div style={{ marginTop: '16px', background: 'var(--surface)', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Generierte Texte</div>
                {content.headline && <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>{content.headline}</div>}
                {content.subheadline && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{content.subheadline}</div>}
                {content.about_text && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{content.about_text}</div>}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Right preview — echte Live-Vorschau via iframe */}
      <div style={{
        width: '440px', flexShrink: 0, borderLeft: '1px solid var(--border)',
        background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', paddingTop: '52px',
      }}>
        <PreviewPane slug={restaurant.slug ?? ''} reloadToken={reloadToken} />
      </div>

    </div>
  )
}
