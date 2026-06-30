'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEditorDraft } from '../useEditorDraft'
import type { SectionKey, LandingPageContent } from '@/lib/landing-content'

export type SectionTarget = SectionKey | 'basis'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1.5px solid var(--border)', background: 'var(--surface-2)',
  color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
}
const fieldLabel: React.CSSProperties = {
  display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px',
}
const sectionTitle: React.CSSProperties = { fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '14px' }
const aiBtn = (busy: boolean): React.CSSProperties => ({
  background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px',
  padding: '3px 8px', cursor: busy ? 'wait' : 'pointer', color: 'var(--accent)', fontSize: '0.7rem', fontWeight: 700,
})

const FEATURE_BADGE_OPTIONS = [
  'Vegetarisch', 'Vegan', 'Glutenfrei', 'Halal',
  'Lieferung', 'Reservierung', 'Takeaway', 'Catering',
  'Wifi', 'Terrasse', 'Parkplatz',
]
const DAYS = [
  { key: 'mo' as const, label: 'Montag' }, { key: 'di' as const, label: 'Dienstag' },
  { key: 'mi' as const, label: 'Mittwoch' }, { key: 'do' as const, label: 'Donnerstag' },
  { key: 'fr' as const, label: 'Freitag' }, { key: 'sa' as const, label: 'Samstag' },
  { key: 'so' as const, label: 'Sonntag' },
]

function ImageDropzone({ label, previewUrl, uploading, onFile, hint }: {
  label: string; previewUrl?: string; uploading: boolean; onFile: (f: File) => void; hint?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      {label && <label style={fieldLabel}>{label}</label>}
      <div onClick={() => ref.current?.click()} style={{
        border: '2px dashed var(--border)', borderRadius: '10px', padding: previewUrl ? '8px' : '18px',
        textAlign: 'center', cursor: 'pointer', background: 'var(--surface-2)', position: 'relative',
      }}>
        {previewUrl ? (
          <img src={previewUrl} alt="" style={{ width: '100%', maxHeight: '100px', objectFit: 'cover', borderRadius: '6px' }} />
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <div style={{ fontSize: '1.4rem', marginBottom: '3px' }}>+</div>
            {uploading ? 'Wird hochgeladen…' : hint ?? 'Klicken zum Hochladen'}
            <div style={{ fontSize: '0.65rem', marginTop: '2px', opacity: 0.5 }}>JPEG, PNG, WebP · max. 8 MB</div>
          </div>
        )}
        {uploading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', color: '#fff', fontSize: '0.8rem' }}>Wird hochgeladen…</div>}
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
    </div>
  )
}

const SECTION_TITLES: Record<SectionTarget, string> = {
  basis: 'Hero & Intro', about: 'Über uns', gallery: 'Foto-Galerie', featured_menu: 'Menü-Highlights',
  team: 'Team', story: 'Unsere Geschichte', ambiance: 'Atmosphäre', awards: 'Auszeichnungen & Presse',
  opening_hours: 'Öffnungszeiten', reviews: 'Bewertungen', reservation_cta: 'Reservierungs-Aufruf',
  contact: 'Kontakt & Adresse', instagram: 'Instagram',
}

export function SectionEditorPanel({ section, restaurantId }: { section: SectionTarget; restaurantId: string }) {
  const { draft, updateLandingContent } = useEditorDraft()
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [generatingField, setGeneratingField] = useState<string | null>(null)
  const [aiError, setAiError] = useState('')

  if (!draft) return null
  const content = draft.landing_content
  const setContent = updateLandingContent

  async function uploadImage(file: File, apiType: string, busyKey: string): Promise<string | null> {
    setUploading(prev => ({ ...prev, [busyKey]: true }))
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const form = new FormData()
    form.append('restaurant_id', restaurantId)
    form.append('file', file)
    form.append('type', apiType)
    const res = await fetch('/api/admin/landing-page/upload', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form })
    setUploading(prev => ({ ...prev, [busyKey]: false }))
    if (!res.ok) return null
    const j = await res.json()
    return typeof j.url === 'string' ? j.url : null
  }

  async function handleUpload(file: File, type: 'hero' | 'logo' | 'gallery') {
    const url = await uploadImage(file, type, type)
    if (!url) return
    if (type === 'gallery') setContent(prev => ({ ...prev, gallery: [...(prev.gallery ?? []), url].slice(0, 6) }))
    else if (type === 'hero') setContent(prev => ({ ...prev, hero_image_url: url }))
    else setContent(prev => ({ ...prev, logo_url: url }))
  }

  async function handleGenerateField(field: 'about' | 'story') {
    setGeneratingField(field); setAiError('')
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setGeneratingField(null); return }
    const res = await fetch('/api/ai/landing-section', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ restaurant_id: restaurantId, field }),
    })
    setGeneratingField(null)
    if (!res.ok) { const j = await res.json().catch(() => ({})); setAiError(j.error ?? 'KI nicht verfügbar'); return }
    const j = await res.json()
    if (typeof j.text === 'string') setContent(prev => field === 'about' ? { ...prev, about_text: j.text } : { ...prev, story_text: j.text })
  }

  const isVis = (k: SectionKey) => content.section_visibility?.[k] !== false
  const setVisible = (k: SectionKey, v: boolean) => setContent(prev => ({ ...prev, section_visibility: { ...prev.section_visibility, [k]: v } }))

  return (
    <div>
      <div style={sectionTitle}>{SECTION_TITLES[section]}</div>
      {aiError && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginBottom: '10px' }}>{aiError}</div>}

      {section === 'basis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <ImageDropzone label="Logo" previewUrl={content.logo_url} uploading={!!uploading['logo']} onFile={f => handleUpload(f, 'logo')} />
          <ImageDropzone label="Hero-Bild" previewUrl={content.hero_image_url} uploading={!!uploading['hero']} onFile={f => handleUpload(f, 'hero')} />
          <div>
            <label style={fieldLabel}>Headline <span style={{ opacity: 0.4 }}>(max. 80)</span></label>
            <input type="text" value={content.headline ?? ''} maxLength={80} onChange={e => setContent(prev => ({ ...prev, headline: e.target.value }))} placeholder="z.B. Willkommen im besten Ristorante der Stadt" style={inputStyle} />
          </div>
          <div>
            <label style={fieldLabel}>Subheadline <span style={{ opacity: 0.4 }}>(max. 150)</span></label>
            <input type="text" value={content.subheadline ?? ''} maxLength={150} onChange={e => setContent(prev => ({ ...prev, subheadline: e.target.value }))} placeholder="z.B. Authentische Pasta & Pizza seit 1998" style={inputStyle} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ ...fieldLabel, marginBottom: 0 }}>Über uns <span style={{ opacity: 0.4 }}>(max. 500)</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => handleGenerateField('about')} disabled={generatingField === 'about'} style={aiBtn(generatingField === 'about')}>{generatingField === 'about' ? '⟳' : '✦ KI'}</button>
                <button onClick={() => setVisible('about', !isVis('about'))} title={isVis('about') ? 'Sichtbar' : 'Aus'} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.85rem', opacity: isVis('about') ? 1 : 0.4 }}>{isVis('about') ? '👁' : '🚫'}</button>
              </div>
            </div>
            <textarea value={content.about_text ?? ''} maxLength={500} rows={4} onChange={e => setContent(prev => ({ ...prev, about_text: e.target.value }))} placeholder="Beschreibe dein Restaurant…" style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div>
            <label style={fieldLabel}>CTA Button Text <span style={{ opacity: 0.4 }}>(max. 40)</span></label>
            <input type="text" value={content.cta_text ?? ''} maxLength={40} onChange={e => setContent(prev => ({ ...prev, cta_text: e.target.value }))} placeholder="Jetzt bestellen" style={inputStyle} />
          </div>
          <div>
            <label style={fieldLabel}>CTA Link</label>
            <input type="text" value={content.cta_url ?? ''} onChange={e => setContent(prev => ({ ...prev, cta_url: e.target.value }))} placeholder="/bestellen/…" style={inputStyle} />
          </div>
        </div>
      )}

      {section === 'contact' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div><label style={fieldLabel}>Adresse</label><input type="text" value={content.address ?? ''} onChange={e => setContent(prev => ({ ...prev, address: e.target.value }))} placeholder="Musterstraße 1, 80331 München" style={inputStyle} /></div>
          <div><label style={fieldLabel}>Google Maps Link</label><input type="text" value={content.maps_url ?? ''} onChange={e => setContent(prev => ({ ...prev, maps_url: e.target.value }))} placeholder="https://maps.google.com/..." style={inputStyle} /></div>
          <div><label style={fieldLabel}>Telefon</label><input type="tel" value={content.phone ?? ''} onChange={e => setContent(prev => ({ ...prev, phone: e.target.value }))} placeholder="+49 89 123456" style={inputStyle} /></div>
          <div><label style={fieldLabel}>E-Mail</label><input type="email" value={content.email ?? ''} onChange={e => setContent(prev => ({ ...prev, email: e.target.value }))} placeholder="info@restaurant.de" style={inputStyle} /></div>
          <div><label style={fieldLabel}>Facebook</label><input type="text" value={content.facebook ?? ''} onChange={e => setContent(prev => ({ ...prev, facebook: e.target.value }))} placeholder="https://facebook.com/..." style={inputStyle} /></div>
        </div>
      )}

      {section === 'instagram' && (
        <div><label style={fieldLabel}>Instagram-Handle</label><input type="text" value={content.instagram ?? ''} onChange={e => setContent(prev => ({ ...prev, instagram: e.target.value }))} placeholder="@restaurantname" style={inputStyle} /></div>
      )}

      {section === 'opening_hours' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {DAYS.map(day => {
            const val = content.opening_hours?.[day.key] ?? { open: true, from: '11:00', to: '22:00' }
            return (
              <div key={day.key} style={{ display: 'grid', gridTemplateColumns: '40px auto 1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text)', fontWeight: 600 }}>{day.label.slice(0, 2)}.</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={val.open} onChange={e => setContent(prev => ({ ...prev, opening_hours: { ...prev.opening_hours, [day.key]: { ...val, open: e.target.checked } } }))} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Offen</span>
                </label>
                {val.open ? (
                  <>
                    <input type="time" value={val.from} onChange={e => setContent(prev => ({ ...prev, opening_hours: { ...prev.opening_hours, [day.key]: { ...val, from: e.target.value } } }))} style={{ ...inputStyle, padding: '6px 8px', fontSize: '0.78rem' }} />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>–</span>
                    <input type="time" value={val.to} onChange={e => setContent(prev => ({ ...prev, opening_hours: { ...prev.opening_hours, [day.key]: { ...val, to: e.target.value } } }))} style={{ ...inputStyle, padding: '6px 8px', fontSize: '0.78rem' }} />
                  </>
                ) : <span style={{ gridColumn: 'span 3', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Geschlossen</span>}
              </div>
            )
          })}
        </div>
      )}

      {section === 'gallery' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {(content.gallery ?? []).map((url, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }} />
              <button onClick={() => setContent(prev => ({ ...prev, gallery: (prev.gallery ?? []).filter((_, j) => j !== i) }))} style={{ position: 'absolute', top: '3px', right: '3px', background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '10px' }}>✕</button>
            </div>
          ))}
          {(content.gallery ?? []).length < 6 && <ImageDropzone label="" uploading={!!uploading['gallery']} onFile={f => handleUpload(f, 'gallery')} hint="Foto hinzufügen" />}
        </div>
      )}

      {section === 'ambiance' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {(content.ambiance_gallery ?? []).map((url, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }} />
              <button onClick={() => setContent(prev => ({ ...prev, ambiance_gallery: (prev.ambiance_gallery ?? []).filter((_, j) => j !== i) }))} style={{ position: 'absolute', top: '3px', right: '3px', background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '10px' }}>✕</button>
            </div>
          ))}
          {(content.ambiance_gallery ?? []).length < 8 && <ImageDropzone label="" uploading={!!uploading['ambiance']} onFile={async f => { const url = await uploadImage(f, 'ambiance', 'ambiance'); if (url) setContent(prev => ({ ...prev, ambiance_gallery: [...(prev.ambiance_gallery ?? []), url].slice(0, 8) })) }} hint="Foto hinzufügen" />}
        </div>
      )}

      {section === 'team' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {(content.team ?? []).map((member, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: '10px', alignItems: 'center', background: 'var(--surface)', borderRadius: '8px', padding: '10px' }}>
              <ImageDropzone label="" previewUrl={member.photo_url} uploading={!!uploading[`team-${i}`]} onFile={async f => { const url = await uploadImage(f, 'team', `team-${i}`); if (url) setContent(prev => { const team = [...(prev.team ?? [])]; team[i] = { ...team[i], photo_url: url }; return { ...prev, team } }) }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <input type="text" value={member.name} placeholder="Name" onChange={e => setContent(prev => { const team = [...(prev.team ?? [])]; team[i] = { ...team[i], name: e.target.value }; return { ...prev, team } })} style={inputStyle} />
                <input type="text" value={member.role} placeholder="Rolle (z.B. Chefkoch)" onChange={e => setContent(prev => { const team = [...(prev.team ?? [])]; team[i] = { ...team[i], role: e.target.value }; return { ...prev, team } })} style={inputStyle} />
              </div>
              <button onClick={() => setContent(prev => ({ ...prev, team: (prev.team ?? []).filter((_, j) => j !== i) }))} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
            </div>
          ))}
          <button onClick={() => setContent(prev => ({ ...prev, team: [...(prev.team ?? []), { name: '', role: '' }] }))} style={{ padding: '8px', borderRadius: '8px', border: '1.5px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>+ Mitglied hinzufügen</button>
        </div>
      )}

      {section === 'story' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <ImageDropzone label="Bild" previewUrl={content.story_image_url} uploading={!!uploading['story']} onFile={async f => { const url = await uploadImage(f, 'story', 'story'); if (url) setContent(prev => ({ ...prev, story_image_url: url })) }} />
          <div><label style={fieldLabel}>Gegründet (Jahr)</label><input type="text" value={content.founded_year ?? ''} maxLength={20} onChange={e => setContent(prev => ({ ...prev, founded_year: e.target.value }))} placeholder="1998" style={inputStyle} /></div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ ...fieldLabel, marginBottom: 0 }}>Geschichte</label>
              <button onClick={() => handleGenerateField('story')} disabled={generatingField === 'story'} style={aiBtn(generatingField === 'story')}>{generatingField === 'story' ? '⟳' : '✦ KI'}</button>
            </div>
            <textarea value={content.story_text ?? ''} rows={4} onChange={e => setContent(prev => ({ ...prev, story_text: e.target.value }))} placeholder="Erzähle die Geschichte deines Restaurants…" style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>
      )}

      {section === 'awards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {(content.awards ?? []).map((award, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: '10px', alignItems: 'center', background: 'var(--surface)', borderRadius: '8px', padding: '10px' }}>
              <ImageDropzone label="" previewUrl={award.logo_url} uploading={!!uploading[`award-${i}`]} onFile={async f => { const url = await uploadImage(f, 'award', `award-${i}`); if (url) setContent(prev => { const awards = [...(prev.awards ?? [])]; awards[i] = { ...awards[i], logo_url: url }; return { ...prev, awards } }) }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <input type="text" value={award.title} placeholder="Titel (z.B. Gault&Millau)" onChange={e => setContent(prev => { const awards = [...(prev.awards ?? [])]; awards[i] = { ...awards[i], title: e.target.value }; return { ...prev, awards } })} style={inputStyle} />
                <input type="text" value={award.subtitle ?? ''} placeholder="Untertitel (z.B. 2024)" onChange={e => setContent(prev => { const awards = [...(prev.awards ?? [])]; awards[i] = { ...awards[i], subtitle: e.target.value }; return { ...prev, awards } })} style={inputStyle} />
              </div>
              <button onClick={() => setContent(prev => ({ ...prev, awards: (prev.awards ?? []).filter((_, j) => j !== i) }))} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
            </div>
          ))}
          <button onClick={() => setContent(prev => ({ ...prev, awards: [...(prev.awards ?? []), { title: '' }] }))} style={{ padding: '8px', borderRadius: '8px', border: '1.5px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>+ Auszeichnung hinzufügen</button>
        </div>
      )}

      {section === 'reviews' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><label style={fieldLabel}>Google Rating</label><input type="number" min="1" max="5" step="0.1" value={content.google_rating ?? ''} onChange={e => setContent(prev => ({ ...prev, google_rating: e.target.value ? parseFloat(e.target.value) : undefined }))} placeholder="4.8" style={inputStyle} /></div>
            <div><label style={fieldLabel}>Anzahl Bewertungen</label><input type="number" min="0" value={content.google_review_count ?? ''} onChange={e => setContent(prev => ({ ...prev, google_review_count: e.target.value ? parseInt(e.target.value, 10) : undefined }))} placeholder="247" style={inputStyle} /></div>
          </div>
          <div><label style={fieldLabel}>Google Maps Link</label><input type="text" value={content.google_maps_url ?? ''} onChange={e => setContent(prev => ({ ...prev, google_maps_url: e.target.value }))} placeholder="https://maps.app.goo.gl/..." style={inputStyle} /></div>
          {[0, 1, 2].map(i => {
            const quote = content.review_quotes?.[i]
            return (
              <div key={i} style={{ background: 'var(--surface)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Zitat {i + 1}</div>
                <textarea rows={2} value={quote?.text ?? ''} onChange={e => setContent(prev => { const quotes = [...(prev.review_quotes ?? [{ text: '', author: '' }, { text: '', author: '' }, { text: '', author: '' }])]; quotes[i] = { ...quotes[i], text: e.target.value }; return { ...prev, review_quotes: quotes } })} placeholder="Tolles Essen, super Atmosphäre…" style={{ ...inputStyle, resize: 'vertical' }} />
                <input type="text" value={quote?.author ?? ''} onChange={e => setContent(prev => { const quotes = [...(prev.review_quotes ?? [{ text: '', author: '' }, { text: '', author: '' }, { text: '', author: '' }])]; quotes[i] = { ...quotes[i], author: e.target.value }; return { ...prev, review_quotes: quotes } })} placeholder="Max M." style={inputStyle} />
              </div>
            )
          })}
        </div>
      )}

      {(section === 'featured_menu' || section === 'reservation_cta') && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.6 }}>
          Diese Sektion wird automatisch erzeugt{section === 'featured_menu' ? ' (aus deinen Menü-Highlights)' : ''} und hat keinen eigenen Inhalt. Die Sichtbarkeit schaltest du links in der Navigation um.
        </p>
      )}
    </div>
  )
}
