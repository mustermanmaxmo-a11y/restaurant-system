'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Restaurant } from '@/types/database'

// ─── Types ───────────────────────────────────────────────────────────────────
export interface LandingPageContent {
  logo_url?: string
  hero_image_url?: string
  headline?: string
  subheadline?: string
  about_text?: string
  cta_text?: string
  cta_url?: string
}

interface LandingPageRow {
  id: string
  restaurant_id: string
  template_slug: string
  content: LandingPageContent
  is_published: boolean
  custom_domain: string | null
  created_at: string
  updated_at: string
}

// ─── Template definitions ────────────────────────────────────────────────────
const TEMPLATES = [
  { slug: 'minimal-dark',  label: 'Dark, Minimal',   bg: '#0a0a0a', accent: '#e85d26' },
  { slug: 'warm-rustic',   label: 'Warm, Rustic',    bg: '#FDF8F0', accent: '#C75B39' },
  { slug: 'bold-modern',   label: 'Bold, Modern',    bg: '#0a0a0a', accent: '#FF3D00' },
  { slug: 'elegant-white', label: 'Elegant, Light',  bg: '#FFFFFF', accent: '#2C2C2C' },
  { slug: 'street-energy', label: 'Street Food',     bg: '#0d0d0d', accent: '#B44AFF' },
] as const

type TemplateSlug = typeof TEMPLATES[number]['slug']

function getTemplate(slug: string) {
  return TEMPLATES.find(t => t.slug === slug) ?? TEMPLATES[0]
}

// ─── Style constants ─────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1.5px solid var(--border)', background: 'var(--surface-2)',
  color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
}
const fieldLabel: React.CSSProperties = {
  display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px',
}
const sectionLabel: React.CSSProperties = {
  display: 'block', color: 'var(--text)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '12px',
}

// ─── Dropzone ────────────────────────────────────────────────────────────────
function ImageDropzone({
  label, previewUrl, uploading, onFile,
}: {
  label: string
  previewUrl?: string
  uploading: boolean
  onFile: (f: File) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      <div
        onClick={() => ref.current?.click()}
        style={{
          border: '2px dashed var(--border)', borderRadius: '10px',
          padding: previewUrl ? '8px' : '20px',
          textAlign: 'center', cursor: 'pointer',
          background: 'var(--surface-2)', position: 'relative',
        }}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '6px' }}
          />
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>+</div>
            {uploading ? 'Wird hochgeladen…' : 'Klicken zum Hochladen'}
            <div style={{ fontSize: '0.68rem', marginTop: '2px', opacity: 0.6 }}>
              JPEG, PNG, WebP — max. 8 MB
            </div>
          </div>
        )}
        {uploading && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '10px', color: '#fff', fontSize: '0.8rem',
          }}>
            Wird hochgeladen…
          </div>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
    </div>
  )
}

// ─── Live Preview ─────────────────────────────────────────────────────────────
function LandingPreview({
  restaurant, template, content,
}: {
  restaurant: Restaurant | null
  template: typeof TEMPLATES[number]
  content: LandingPageContent
}) {
  const isLight = template.bg === '#FFFFFF' || template.bg === '#FDF8F0'
  const textColor = isLight ? '#2C1810' : '#ffffff'
  const mutedColor = isLight ? 'rgba(44,24,16,0.6)' : 'rgba(255,255,255,0.6)'
  const cardBg = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'

  return (
    <div style={{
      background: template.bg, borderRadius: '12px', overflow: 'hidden',
      border: '1px solid var(--border)', fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Hero */}
      <div style={{
        minHeight: content.hero_image_url ? '160px' : '100px',
        background: content.hero_image_url
          ? `linear-gradient(to bottom, rgba(0,0,0,0.3), ${template.bg} 90%), url(${content.hero_image_url}) center/cover`
          : `linear-gradient(135deg, ${template.accent}22, ${template.bg})`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 20px',
        textAlign: 'center',
      }}>
        {content.logo_url && (
          <img
            src={content.logo_url}
            alt=""
            style={{
              width: '48px', height: '48px', objectFit: 'contain',
              borderRadius: '8px', background: '#fff', padding: '4px',
              marginBottom: '10px',
            }}
          />
        )}
        <div style={{
          fontSize: '1.1rem', fontWeight: 800, color: textColor, lineHeight: 1.2,
          textShadow: content.hero_image_url ? '0 1px 3px rgba(0,0,0,0.7)' : 'none',
        }}>
          {content.headline || restaurant?.name || 'Headline'}
        </div>
        {(content.subheadline) && (
          <div style={{
            fontSize: '0.75rem', color: textColor, opacity: 0.75, marginTop: '6px',
            textShadow: content.hero_image_url ? '0 1px 3px rgba(0,0,0,0.7)' : 'none',
          }}>
            {content.subheadline}
          </div>
        )}
      </div>

      {/* About */}
      {content.about_text && (
        <div style={{ padding: '16px 20px', background: cardBg }}>
          <div style={{ fontSize: '0.72rem', color: mutedColor, lineHeight: 1.5 }}>
            {content.about_text}
          </div>
        </div>
      )}

      {/* CTA */}
      <div style={{ padding: '16px 20px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block', padding: '10px 24px', borderRadius: '8px',
          background: template.accent, color: '#fff',
          fontSize: '0.78rem', fontWeight: 700,
        }}>
          {content.cta_text || 'Jetzt bestellen'}
        </div>
      </div>

      {/* Speisekarte teaser */}
      <div style={{
        margin: '0 16px 16px', borderRadius: '8px',
        background: cardBg, padding: '12px 14px',
        border: `1px solid ${template.accent}33`,
      }}>
        <div style={{ fontSize: '0.68rem', color: template.accent, fontWeight: 700, marginBottom: '4px' }}>
          SPEISEKARTE
        </div>
        <div style={{ fontSize: '0.72rem', color: mutedColor }}>
          {restaurant?.name ?? 'Restaurant'} — Alle Gerichte ansehen
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LandingPageBuilder() {
  const router = useRouter()

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [landingPage, setLandingPage] = useState<LandingPageRow | null>(null)
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [templateSlug, setTemplateSlug] = useState<TemplateSlug>('minimal-dark')
  const [content, setContent] = useState<LandingPageContent>({})
  const [isPublished, setIsPublished] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  const [uploading, setUploading] = useState({ hero: false, logo: false })

  const template = getTemplate(templateSlug)

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/owner-login'); return }

      const { data: resto } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', user.id)
        .limit(1)
        .single()
      if (!resto) { router.push('/admin/setup'); return }
      setRestaurant(resto)

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { router.push('/owner-login'); return }

      const res = await fetch(`/api/admin/landing-page?restaurant_id=${resto.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        const lp = json.data as LandingPageRow
        setLandingPage(lp)
        setTemplateSlug(lp.template_slug as TemplateSlug)
        setContent(lp.content ?? {})
        setIsPublished(lp.is_published ?? false)
      }
      setLoading(false)
    }
    load()
  }, [router])

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave(overrides?: Partial<{ is_published: boolean }>) {
    if (!restaurant) return
    setSaving(true)
    setSaveError('')
    setSaved(false)

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setSaving(false); return }

    const body = {
      restaurant_id: restaurant.id,
      template_slug: templateSlug,
      content,
      is_published: overrides?.is_published ?? isPublished,
    }

    const res = await fetch('/api/admin/landing-page', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })

    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setSaveError(j.error ?? 'Speichern fehlgeschlagen')
      return
    }
    const j = await res.json()
    setLandingPage(j.data)
    if (overrides?.is_published !== undefined) setIsPublished(overrides.is_published)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  // ── Publish toggle ────────────────────────────────────────────────────────
  async function handlePublishToggle() {
    const next = !isPublished
    setIsPublished(next)
    await handleSave({ is_published: next })
  }

  // ── AI generate ───────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!restaurant) return
    setGenerating(true)
    setGenerateError('')

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
      setGenerateError(j.error ?? 'KI-Generierung fehlgeschlagen')
      return
    }

    const j = await res.json()
    setContent(prev => ({
      ...prev,
      headline: j.headline ?? prev.headline,
      subheadline: j.subheadline ?? prev.subheadline,
      about_text: j.about_text ?? prev.about_text,
      cta_text: j.cta_text ?? prev.cta_text,
    }))
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  async function handleUpload(file: File, type: 'hero' | 'logo') {
    if (!restaurant) return
    setUploading(prev => ({ ...prev, [type]: true }))

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const form = new FormData()
    form.append('restaurant_id', restaurant.id)
    form.append('file', file)
    form.append('type', type)

    const res = await fetch('/api/admin/landing-page/upload', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })

    setUploading(prev => ({ ...prev, [type]: false }))

    if (res.ok) {
      const j = await res.json()
      const key = type === 'hero' ? 'hero_image_url' : 'logo_url'
      setContent(prev => ({ ...prev, [key]: j.url }))
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '40px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        Wird geladen…
      </div>
    )
  }

  const publicUrl = restaurant ? `/${restaurant.slug}/info` : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '12px 24px', display: 'flex', alignItems: 'center',
        gap: '12px', flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>
            Landing Page Builder
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {restaurant?.name}
          </div>
        </div>

        {/* Tab toggle (mobile) */}
        <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: '8px', padding: '3px', gap: '2px' }}>
          {(['edit', 'preview'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontSize: '0.78rem', fontWeight: tab === t ? 700 : 500,
                background: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              {t === 'edit' ? 'Bearbeiten' : 'Vorschau'}
            </button>
          ))}
        </div>

        <button
          onClick={() => handleSave()}
          disabled={saving}
          style={{
            padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: saved ? '#10b981' : 'var(--accent)',
            color: '#fff', fontWeight: 700, fontSize: '0.82rem',
            opacity: saving ? 0.7 : 1, transition: 'background 0.2s',
          }}
        >
          {saving ? 'Speichern…' : saved ? '✓ Gespeichert' : 'Speichern'}
        </button>

        <button
          onClick={handlePublishToggle}
          disabled={saving}
          style={{
            padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700,
            fontSize: '0.82rem', transition: 'all 0.2s',
            background: isPublished ? 'transparent' : '#10b981',
            color: isPublished ? 'var(--text-muted)' : '#fff',
            border: isPublished ? '1.5px solid var(--border)' : 'none',
          }}
        >
          {isPublished ? 'Depublizieren' : 'Publizieren'}
        </button>
      </div>

      {/* Published link */}
      {isPublished && publicUrl && (
        <div style={{
          background: 'rgba(16,185,129,0.08)', borderBottom: '1px solid rgba(16,185,129,0.2)',
          padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '0.78rem',
        }}>
          <span style={{ color: '#10b981', fontWeight: 700 }}>Live:</span>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#10b981', textDecoration: 'underline' }}
          >
            {typeof window !== 'undefined' ? window.location.origin : ''}{publicUrl}
          </a>
        </div>
      )}

      {saveError && (
        <div style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', padding: '8px 24px', fontSize: '0.78rem', color: '#ef4444' }}>
          {saveError}
        </div>
      )}

      {/* ── Two-column body ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '0', minHeight: 'calc(100vh - 64px)',
      }}>

        {/* ── LEFT: Editor ─────────────────────────────────────────────── */}
        <div
          className="lp-editor"
          style={{
            width: '420px', flexShrink: 0, borderRight: '1px solid var(--border)',
            padding: '24px', overflowY: 'auto', display: tab === 'preview' ? 'none' : 'block',
          }}
        >

          {/* Section 1 — Template */}
          <section style={{ marginBottom: '28px' }}>
            <label style={sectionLabel}>Template wählen</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {TEMPLATES.map(tpl => (
                <button
                  key={tpl.slug}
                  onClick={() => setTemplateSlug(tpl.slug)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                    padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    background: templateSlug === tpl.slug ? `${tpl.accent}22` : 'var(--surface)',
                    outline: templateSlug === tpl.slug ? `2px solid ${tpl.accent}` : '2px solid var(--border)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: '40px', height: '32px', borderRadius: '5px',
                    background: tpl.bg, border: `2px solid ${tpl.accent}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ width: '18px', height: '4px', borderRadius: '2px', background: tpl.accent }} />
                  </div>
                  <span style={{
                    fontSize: '0.6rem', fontWeight: 600, color: templateSlug === tpl.slug ? 'var(--text)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}>
                    {tpl.label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Section 2 — KI */}
          <section style={{ marginBottom: '28px' }}>
            <label style={sectionLabel}>KI-Texte generieren</label>
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                width: '100%', padding: '11px', borderRadius: '8px', border: 'none',
                background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer',
                fontSize: '0.85rem', opacity: generating ? 0.7 : 1, display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              {generating ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                  Texte werden generiert…
                </>
              ) : (
                <> Texte mit KI generieren</>
              )}
            </button>
            {generateError && (
              <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '6px' }}>
                {generateError}
              </div>
            )}
          </section>

          {/* Section 3 — Inhalte */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={sectionLabel}>Inhalte bearbeiten</label>

            <ImageDropzone
              label="Logo"
              previewUrl={content.logo_url}
              uploading={uploading.logo}
              onFile={f => handleUpload(f, 'logo')}
            />

            <ImageDropzone
              label="Hero-Bild"
              previewUrl={content.hero_image_url}
              uploading={uploading.hero}
              onFile={f => handleUpload(f, 'hero')}
            />

            <div>
              <label style={fieldLabel}>Headline <span style={{ opacity: 0.5 }}>(max. 80)</span></label>
              <input
                type="text"
                value={content.headline ?? ''}
                maxLength={80}
                onChange={e => setContent(prev => ({ ...prev, headline: e.target.value }))}
                placeholder="z.B. Willkommen im besten Ristorante der Stadt"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={fieldLabel}>Subheadline <span style={{ opacity: 0.5 }}>(max. 150)</span></label>
              <input
                type="text"
                value={content.subheadline ?? ''}
                maxLength={150}
                onChange={e => setContent(prev => ({ ...prev, subheadline: e.target.value }))}
                placeholder="z.B. Authentische Pasta & Pizza seit 1998"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={fieldLabel}>Über uns <span style={{ opacity: 0.5 }}>(max. 500)</span></label>
              <textarea
                value={content.about_text ?? ''}
                maxLength={500}
                rows={4}
                onChange={e => setContent(prev => ({ ...prev, about_text: e.target.value }))}
                placeholder="Beschreibe dein Restaurant…"
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '3px' }}>
                {(content.about_text ?? '').length}/500
              </div>
            </div>

            <div>
              <label style={fieldLabel}>CTA Button Text <span style={{ opacity: 0.5 }}>(max. 40)</span></label>
              <input
                type="text"
                value={content.cta_text ?? ''}
                maxLength={40}
                onChange={e => setContent(prev => ({ ...prev, cta_text: e.target.value }))}
                placeholder="Jetzt bestellen"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={fieldLabel}>CTA Link</label>
              <input
                type="text"
                value={content.cta_url ?? (restaurant ? `/bestellen/${restaurant.slug}` : '')}
                onChange={e => setContent(prev => ({ ...prev, cta_url: e.target.value }))}
                placeholder={restaurant ? `/bestellen/${restaurant.slug}` : '/bestellen/...'}
                style={inputStyle}
              />
            </div>
          </section>

          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>

        {/* ── RIGHT: Live Preview ───────────────────────────────────────── */}
        <div
          className="lp-preview"
          style={{
            flex: 1, padding: '24px',
            display: tab === 'edit' ? 'flex' : 'block',
            alignItems: 'flex-start',
            background: 'var(--surface-2)',
            ...(tab === 'preview' ? { display: 'flex', justifyContent: 'center', padding: '32px 16px' } : {}),
          }}
        >
          <div style={{ width: '100%', maxWidth: '480px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Vorschau
            </div>
            <LandingPreview restaurant={restaurant} template={template} content={content} />
          </div>
        </div>

      </div>

      <style>{`
        @media (max-width: 768px) {
          .lp-editor { width: 100% !important; border-right: none !important; }
          .lp-preview { display: none !important; }
        }
      `}</style>
    </div>
  )
}
