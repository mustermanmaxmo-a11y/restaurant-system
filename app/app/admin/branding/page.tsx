'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BRANDING_PRESETS } from '@/lib/branding-presets'
import { darken } from '@/lib/color-utils'
import type { Restaurant } from '@/types/database'
import { useLanguage } from '@/components/providers/language-provider'

// ─── ShineBorder (inlined, no extra deps) ──────────────────────────────────
function ShineBorder({
  color = '#FF6B2C',
  children,
  style,
}: {
  color?: string | string[]
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const gradientColor = Array.isArray(color) ? color.join(',') : color
  return (
    <div style={{ position: 'relative', borderRadius: '12px', ...style }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '12px', padding: '1.5px',
        background: `radial-gradient(transparent,transparent,${gradientColor},transparent,transparent)`,
        backgroundSize: '300% 300%',
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        animation: 'shinePulse 3s infinite linear',
        pointerEvents: 'none',
      }} />
      {children}
      <style>{`@keyframes shinePulse { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }`}</style>
    </div>
  )
}

// ─── Color Picker (native, no extra deps) ──────────────────────────────────
function ColorPickerInput({
  value,
  onChange,
}: {
  value: string
  onChange: (hex: string) => void
}) {
  const [hexInput, setHexInput] = useState(value)

  useEffect(() => { setHexInput(value) }, [value])

  function handleHexChange(raw: string) {
    setHexInput(raw)
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) onChange(raw)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {/* Native color wheel */}
      <label style={{ position: 'relative', cursor: 'pointer' }}>
        <input
          type="color"
          value={value}
          onChange={e => { onChange(e.target.value); setHexInput(e.target.value) }}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        />
        <div style={{
          width: '44px', height: '44px', borderRadius: '10px',
          background: value,
          border: '2px solid var(--border)',
          boxShadow: `0 0 0 4px ${value}22`,
          cursor: 'pointer',
          transition: 'box-shadow 0.2s',
        }} />
      </label>
      {/* Hex text input */}
      <input
        type="text"
        value={hexInput}
        onChange={e => handleHexChange(e.target.value)}
        maxLength={7}
        style={{
          flex: 1, padding: '10px 12px', borderRadius: '8px',
          border: '1.5px solid var(--border)', background: 'var(--surface-2)',
          color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'monospace',
          outline: 'none',
        }}
        placeholder="#FF6B2C"
      />
      {/* Live preview strip */}
      <div style={{
        height: '44px', width: '80px', borderRadius: '8px',
        background: `linear-gradient(135deg, ${value}, ${darken(value, 40)})`,
        border: '1.5px solid var(--border)', flexShrink: 0,
      }} />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function BrandingPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const { t } = useLanguage()

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [presetId, setPresetId] = useState('classic')
  const [primaryColor, setPrimaryColor] = useState('#FF6B2C')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactAddress, setContactAddress] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }
      const { data: resto } = await supabase
        .from('restaurants').select('*').eq('owner_id', session.user.id).limit(1).single()
      if (!resto) { router.push('/admin/setup'); return }
      setRestaurant(resto)
      if (resto.brand_preset) setPresetId(resto.brand_preset)
      if (resto.primary_color) setPrimaryColor(resto.primary_color)
      if (resto.logo_url) setLogoUrl(resto.logo_url)
      if (resto.contact_email) setContactEmail(resto.contact_email)
      if (resto.contact_phone) setContactPhone(resto.contact_phone)
      if (resto.contact_address) setContactAddress(resto.contact_address)
      if (resto.description) setDescription(resto.description)
      setLoading(false)
    }
    load()
  }, [router])

  function applyPreset(id: string) {
    const preset = BRANDING_PRESETS.find(p => p.id === id)
    if (!preset) return
    setPresetId(id)
    setPrimaryColor(preset.primaryColor)
    setSaved(false)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !restaurant) return
    setLogoUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${restaurant.id}/logo.${ext}`
    const { error } = await supabase.storage.from('restaurant-logos').upload(path, file, { upsert: true })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('restaurant-logos').getPublicUrl(path)
      setLogoUrl(publicUrl)
      await supabase.from('restaurants').update({ logo_url: publicUrl }).eq('id', restaurant.id)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } else {
      console.error('Logo upload error:', error)
    }
    setLogoUploading(false)
    // Reset input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = ''
  }

  async function removeLogo() {
    setLogoUrl(null)
    setSaved(false)
  }

  async function save() {
    if (!restaurant) return
    setSaving(true)
    const preset = BRANDING_PRESETS.find(p => p.id === presetId)
    await supabase.from('restaurants').update({
      brand_preset: presetId,
      primary_color: primaryColor,
      surface_color: preset?.surfaceColor ?? null,
      logo_url: logoUrl,
      contact_email: contactEmail || null,
      contact_phone: contactPhone || null,
      contact_address: contactAddress || null,
      description: description || null,
    }).eq('id', restaurant.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return (
    <div style={{ padding: '40px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('common.loading')}</div>
  )

  const activePreset = BRANDING_PRESETS.find(p => p.id === presetId)

  return (
    <div style={{ padding: '32px 24px', maxWidth: '800px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          Branding & Design
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>
          Passe das Aussehen deiner Bestell-Seite an — Änderungen sind sofort live.
        </p>
      </div>

      {/* ── Section 1: Preset Gallery ── */}
      <section style={{ marginBottom: '40px' }}>
        <label style={sectionLabel}>Design-Vorlage wählen</label>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '12px',
        }}>
          {BRANDING_PRESETS.map(preset => {
            const isActive = preset.id === presetId
            const card = (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                style={{
                  width: '100%',
                  background: isActive ? `${preset.primaryColor}12` : 'var(--surface)',
                  border: isActive ? `2px solid ${preset.primaryColor}` : '2px solid var(--border)',
                  borderRadius: '12px',
                  padding: '16px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  position: 'relative',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                {/* Active checkmark */}
                {isActive && (
                  <div style={{
                    position: 'absolute', top: '8px', right: '8px',
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: preset.primaryColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', color: '#fff', fontWeight: 700,
                  }}>✓</div>
                )}
                {/* Color swatch */}
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: `linear-gradient(135deg, ${preset.primaryColor}, ${darken(preset.primaryColor, 40)})`,
                  marginBottom: '10px',
                  boxShadow: isActive ? `0 0 0 3px ${preset.primaryColor}44` : 'none',
                }} />
                <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{preset.emoji}</div>
                <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.2 }}>
                  {preset.name}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginTop: '2px' }}>
                  {preset.cuisine}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginTop: '6px', lineHeight: 1.3 }}>
                  {preset.description}
                </div>
              </button>
            )

            return isActive ? (
              <ShineBorder key={preset.id} color={[preset.primaryColor, darken(preset.primaryColor, 30), '#ffffff22']}>
                {card}
              </ShineBorder>
            ) : card
          })}
        </div>
      </section>

      {/* ── Section 2: Fine-tune Color ── */}
      <section style={{ marginBottom: '40px' }}>
        <label style={sectionLabel}>Akzentfarbe anpassen</label>
        <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)' }}>
          <ColorPickerInput value={primaryColor} onChange={v => { setPrimaryColor(v); setSaved(false) }} />
          <button
            onClick={() => { if (activePreset) { setPrimaryColor(activePreset.primaryColor); setSaved(false) } }}
            style={{
              marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            ↺ Preset-Farbe wiederherstellen ({activePreset?.name})
          </button>
        </div>
      </section>

      {/* ── Section 3: Logo Upload ── */}
      <section style={{ marginBottom: '40px' }}>
        <label style={sectionLabel}>Logo</label>
        <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)' }}>
          {logoUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <img
                src={logoUrl}
                alt="Logo"
                style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', padding: '4px' }}
              />
              <div>
                <p style={{ color: 'var(--text)', fontSize: '0.875rem', marginBottom: '8px' }}>Logo hochgeladen ✓</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => fileRef.current?.click()} style={btnSecondary}>
                    Ersetzen
                  </button>
                  <button onClick={removeLogo} style={{ ...btnSecondary, color: '#ef4444', borderColor: '#ef444444' }}>
                    Entfernen
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                border: '2px dashed var(--border)',
                borderRadius: '10px',
                padding: '32px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🖼️</div>
              <p style={{ color: 'var(--text)', fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>
                {logoUploading ? 'Wird hochgeladen…' : 'Logo hochladen'}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
                PNG, JPG, SVG — empfohlen: quadratisch, min. 200×200px
              </p>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            style={{ display: 'none' }}
          />
        </div>
      </section>

      {/* ── Section 4: Contact & Info ── */}
      <section style={{ marginBottom: '40px' }}>
        <label style={sectionLabel}>Kontakt & Beschreibung</label>
        <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={fieldLabel}>Tagline / Beschreibung</label>
            <textarea
              value={description}
              onChange={e => { setDescription(e.target.value.slice(0, 160)); setSaved(false) }}
              placeholder="z.B. Authentische Pasta & Pizza seit 1998 — mitten im Herzen der Stadt"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '3px', textAlign: 'right' }}>
              {description.length}/160
            </p>
          </div>
          <div className="branding-contact-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={fieldLabel}>E-Mail</label>
              <input
                type="email"
                value={contactEmail}
                onChange={e => { setContactEmail(e.target.value); setSaved(false) }}
                placeholder="info@restaurant.de"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={fieldLabel}>Telefon</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={e => { setContactPhone(e.target.value); setSaved(false) }}
                placeholder="+49 89 123456"
                style={inputStyle}
              />
            </div>
          </div>
          <div>
            <label style={fieldLabel}>Adresse</label>
            <input
              type="text"
              value={contactAddress}
              onChange={e => { setContactAddress(e.target.value); setSaved(false) }}
              placeholder="Musterstraße 1, 80331 München"
              style={inputStyle}
            />
          </div>
        </div>
      </section>

      {/* ── Live Preview ── */}
      <section style={{ marginBottom: '40px' }}>
        <label style={sectionLabel}>Vorschau</label>
        <div style={{
          background: activePreset?.bgColor ?? '#080808',
          borderRadius: '16px',
          padding: '20px',
          border: '1px solid var(--border)',
          maxWidth: '320px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            {logoUrl ? (
              <img src={logoUrl} alt="" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '8px', background: '#fff', padding: '3px' }} />
            ) : (
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                {activePreset?.emoji}
              </div>
            )}
            <div>
              <div style={{ color: '#f0ede8', fontWeight: 700, fontSize: '0.9rem' }}>
                {restaurant?.name ?? 'Dein Restaurant'}
              </div>
              {description && (
                <div style={{ color: '#5a5650', fontSize: '0.7rem', marginTop: '2px' }}>{description}</div>
              )}
            </div>
          </div>
          {/* Mock item card */}
          <div style={{
            background: activePreset?.surfaceColor ?? '#131313',
            borderRadius: '10px',
            padding: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ color: '#f0ede8', fontSize: '0.8rem', fontWeight: 600 }}>Beispiel-Gericht</div>
              <div style={{ color: primaryColor, fontSize: '0.75rem', fontWeight: 700, marginTop: '2px' }}>12,90 €</div>
            </div>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: primaryColor, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#fff', fontSize: '1rem', fontWeight: 700,
            }}>+</div>
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 600px) {
          .branding-contact-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── Save Button ── */}
      <button
        onClick={save}
        disabled={saving}
        style={{
          padding: '14px 32px',
          borderRadius: '10px',
          background: saved ? '#10b981' : primaryColor,
          color: '#fff',
          fontWeight: 700,
          fontSize: '0.9rem',
          border: 'none',
          cursor: saving ? 'wait' : 'pointer',
          transition: 'background 0.3s',
          boxShadow: `0 4px 20px ${primaryColor}44`,
        }}
      >
        {saving ? '...' : saved ? '✓' : t('common.save')}
      </button>
    </div>
  )
}

// ─── Style helpers ──────────────────────────────────────────────────────────
const sectionLabel: React.CSSProperties = {
  display: 'block',
  color: 'var(--text)',
  fontWeight: 700,
  fontSize: '0.9rem',
  marginBottom: '12px',
}

const fieldLabel: React.CSSProperties = {
  display: 'block',
  color: 'var(--text-muted)',
  fontSize: '0.72rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '5px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1.5px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
}

const btnSecondary: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: '7px',
  border: '1.5px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: '0.8rem',
  cursor: 'pointer',
}
