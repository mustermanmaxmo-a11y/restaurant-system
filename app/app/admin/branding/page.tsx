'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { darken } from '@/lib/color-utils'
import { DESIGN_PACKAGES, getDesignPackage } from '@/lib/design-packages'
import type { DesignPackage, LayoutVariant } from '@/lib/design-packages'
import { FONT_PAIRS } from '@/lib/font-pairs'
import type { Restaurant, RestaurantPlan } from '@/types/database'
import { useLanguage } from '@/components/providers/language-provider'
import { getPlanLimits } from '@/lib/plan-limits'
import { ImageIcon, Check, Palette, Clock, Loader2 } from 'lucide-react'
import { UpgradeHint } from '@/components/UpgradeHint'

// ─── ShineBorder ─────────────────────────────────────────────────────────────
function ShineBorder({ color = '#FF6B2C', children, style }: {
  color?: string | string[]; children: React.ReactNode; style?: React.CSSProperties
}) {
  const gradientColor = Array.isArray(color) ? color.join(',') : color
  return (
    <div style={{ position: 'relative', borderRadius: '12px', ...style }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '12px', padding: '1.5px',
        background: `radial-gradient(transparent,transparent,${gradientColor},transparent,transparent)`,
        backgroundSize: '300% 300%',
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor', maskComposite: 'exclude',
        animation: 'shinePulse 3s infinite linear', pointerEvents: 'none',
      }} />
      {children}
      <style>{`@keyframes shinePulse { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }`}</style>
    </div>
  )
}

// ─── Color Picker ────────────────────────────────────────────────────────────
function ColorPickerInput({ value, onChange, onReset, resetLabel }: {
  value: string; onChange: (hex: string) => void; onReset?: () => void; resetLabel?: string
}) {
  const [hexInput, setHexInput] = useState(value)
  useEffect(() => { setHexInput(value) }, [value])
  function handleHexChange(raw: string) {
    setHexInput(raw)
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) onChange(raw)
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label style={{ position: 'relative', cursor: 'pointer' }}>
          <input type="color" value={value} onChange={e => { onChange(e.target.value); setHexInput(e.target.value) }}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
          <div style={{
            width: '40px', height: '40px', borderRadius: '8px', background: value,
            border: '2px solid var(--border)', boxShadow: `0 0 0 3px ${value}22`, cursor: 'pointer',
          }} />
        </label>
        <input type="text" value={hexInput} onChange={e => handleHexChange(e.target.value)} maxLength={7}
          style={{ flex: 1, padding: '8px 10px', borderRadius: '7px', border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '0.82rem', fontFamily: 'monospace', outline: 'none' }}
          placeholder="#FF6B2C" />
        <div style={{ height: '40px', width: '60px', borderRadius: '7px', background: `linear-gradient(135deg, ${value}, ${darken(value, 40)})`, border: '1px solid var(--border)', flexShrink: 0 }} />
      </div>
      {onReset && (
        <button onClick={onReset} style={{ marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          ↺ {resetLabel ?? 'Paket-Standard'}
        </button>
      )}
    </div>
  )
}

// ─── Layout Wireframe Icons ──────────────────────────────────────────────────
function LayoutIcon({ variant, active, accent }: { variant: LayoutVariant; active: boolean; accent: string }) {
  const w = 64; const h = 48
  const fill = active ? accent : 'var(--text-muted)'
  const opacity = active ? 1 : 0.4
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" style={{ opacity }}>
      {variant === 'cards' && (
        <>
          <rect x="2" y="4" width="60" height="16" rx="3" fill={fill} fillOpacity={0.2} stroke={fill} strokeWidth="1" />
          <rect x="4" y="8" width="10" height="8" rx="2" fill={fill} fillOpacity={0.5} />
          <rect x="18" y="8" width="24" height="3" rx="1" fill={fill} fillOpacity={0.6} />
          <rect x="18" y="13" width="14" height="2" rx="1" fill={fill} fillOpacity={0.3} />
          <rect x="2" y="24" width="60" height="16" rx="3" fill={fill} fillOpacity={0.15} stroke={fill} strokeWidth="1" />
          <rect x="4" y="28" width="10" height="8" rx="2" fill={fill} fillOpacity={0.35} />
          <rect x="18" y="28" width="20" height="3" rx="1" fill={fill} fillOpacity={0.45} />
          <rect x="18" y="33" width="12" height="2" rx="1" fill={fill} fillOpacity={0.2} />
        </>
      )}
      {variant === 'list' && (
        <>
          <rect x="2" y="4" width="60" height="10" rx="2" fill={fill} fillOpacity={0.2} stroke={fill} strokeWidth="1" />
          <rect x="6" y="7" width="28" height="3" rx="1" fill={fill} fillOpacity={0.6} />
          <rect x="48" y="7" width="10" height="3" rx="1" fill={fill} fillOpacity={0.4} />
          <rect x="2" y="17" width="60" height="10" rx="2" fill={fill} fillOpacity={0.15} stroke={fill} strokeWidth="1" />
          <rect x="6" y="20" width="24" height="3" rx="1" fill={fill} fillOpacity={0.45} />
          <rect x="48" y="20" width="10" height="3" rx="1" fill={fill} fillOpacity={0.3} />
          <rect x="2" y="30" width="60" height="10" rx="2" fill={fill} fillOpacity={0.1} stroke={fill} strokeWidth="1" />
          <rect x="6" y="33" width="22" height="3" rx="1" fill={fill} fillOpacity={0.35} />
          <rect x="48" y="33" width="10" height="3" rx="1" fill={fill} fillOpacity={0.2} />
        </>
      )}
      {variant === 'large-cards' && (
        <>
          <rect x="2" y="2" width="60" height="20" rx="3" fill={fill} fillOpacity={0.25} />
          <rect x="4" y="24" width="30" height="3" rx="1" fill={fill} fillOpacity={0.6} />
          <rect x="4" y="29" width="18" height="2" rx="1" fill={fill} fillOpacity={0.3} />
          <rect x="2" y="36" width="60" height="10" rx="2" fill={fill} fillOpacity={0.12} stroke={fill} strokeWidth="1" />
        </>
      )}
      {variant === 'grid' && (
        <>
          <rect x="2" y="2" width="28" height="20" rx="3" fill={fill} fillOpacity={0.2} stroke={fill} strokeWidth="1" />
          <rect x="34" y="2" width="28" height="20" rx="3" fill={fill} fillOpacity={0.2} stroke={fill} strokeWidth="1" />
          <rect x="4" y="24" width="18" height="2" rx="1" fill={fill} fillOpacity={0.5} />
          <rect x="36" y="24" width="16" height="2" rx="1" fill={fill} fillOpacity={0.5} />
          <rect x="2" y="30" width="28" height="16" rx="3" fill={fill} fillOpacity={0.12} stroke={fill} strokeWidth="1" />
          <rect x="34" y="30" width="28" height="16" rx="3" fill={fill} fillOpacity={0.12} stroke={fill} strokeWidth="1" />
        </>
      )}
    </svg>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function BrandingPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const { t } = useLanguage()

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Design state
  const [designPackage, setDesignPackage] = useState('modern-classic')
  const [layoutVariant, setLayoutVariant] = useState<LayoutVariant>('cards')
  const [fontPair, setFontPair] = useState('syne-dmsans')
  // Color overrides (null = use package default)
  const [primaryColor, setPrimaryColor] = useState<string | null>(null)
  const [bgColor, setBgColor] = useState<string | null>(null)
  const [headerColor, setHeaderColor] = useState<string | null>(null)
  const [cardColor, setCardColor] = useState<string | null>(null)
  const [buttonColor, setButtonColor] = useState<string | null>(null)
  const [textColor, setTextColor] = useState<string | null>(null)
  // Other
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactAddress, setContactAddress] = useState('')
  const [description, setDescription] = useState('')
  const [showColorSection, setShowColorSection] = useState(false)

  // Design-Request State
  const [designReqMessage, setDesignReqMessage] = useState('')
  const [designReqSubmitting, setDesignReqSubmitting] = useState(false)
  const [designReqSent, setDesignReqSent] = useState(false)
  const [designReqError, setDesignReqError] = useState<string | null>(null)
  const [existingDesignReq, setExistingDesignReq] = useState<{ status: string; created_at: string } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/owner-login'); return }
      const { data: resto } = await supabase
        .from('restaurants').select('*').eq('owner_id', session.user.id).limit(1).single()
      if (!resto) { router.push('/admin/setup'); return }
      setRestaurant(resto)
      // Load existing values
      if (resto.design_package) setDesignPackage(resto.design_package)
      if (resto.layout_variant) setLayoutVariant(resto.layout_variant as LayoutVariant)
      if (resto.font_pair) setFontPair(resto.font_pair)
      setPrimaryColor(resto.primary_color)
      setBgColor(resto.bg_color)
      setHeaderColor(resto.header_color)
      setCardColor(resto.card_color)
      setButtonColor(resto.button_color)
      setTextColor(resto.text_color)
      if (resto.logo_url) setLogoUrl(resto.logo_url)
      if (resto.contact_email) setContactEmail(resto.contact_email)
      if (resto.contact_phone) setContactPhone(resto.contact_phone)
      if (resto.contact_address) setContactAddress(resto.contact_address)
      if (resto.description) setDescription(resto.description)

      // Offene Design-Anfrage laden
      const { data: openReq } = await supabase
        .from('design_requests')
        .select('status, created_at')
        .eq('restaurant_id', resto.id)
        .in('status', ['pending', 'in_progress'])
        .maybeSingle()
      if (openReq) setExistingDesignReq(openReq)

      setLoading(false)
    }
    load()
  }, [router])

  function applyPackage(pkg: DesignPackage) {
    setDesignPackage(pkg.id)
    setLayoutVariant(pkg.layoutVariant)
    setFontPair(pkg.fontPair)
    // Clear color overrides so package defaults are used
    setPrimaryColor(null)
    setBgColor(null)
    setHeaderColor(null)
    setCardColor(null)
    setButtonColor(null)
    setTextColor(null)
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
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    }
    setLogoUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function save() {
    if (!restaurant) return
    setSaving(true)
    const pkg = getDesignPackage(designPackage)
    await supabase.from('restaurants').update({
      design_package: designPackage,
      layout_variant: layoutVariant,
      font_pair: fontPair,
      primary_color: primaryColor,
      surface_color: primaryColor ? null : pkg.preview.surfaceColor,
      bg_color: bgColor,
      header_color: headerColor,
      card_color: cardColor,
      button_color: buttonColor,
      text_color: textColor,
      brand_preset: null,
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

  async function submitDesignRequest() {
    if (!restaurant || designReqMessage.trim().length < 10) return
    setDesignReqSubmitting(true)
    setDesignReqError(null)
    const res = await fetch('/api/platform/design-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: designReqMessage, restaurant_id: restaurant.id }),
    })
    const json = await res.json()
    setDesignReqSubmitting(false)
    if (!res.ok) {
      setDesignReqError(json.error ?? 'Fehler beim Senden.')
    } else {
      setDesignReqSent(true)
      setExistingDesignReq({ status: 'pending', created_at: new Date().toISOString() })
      setDesignReqMessage('')
    }
  }

  if (loading) return (
    <div style={{ padding: '40px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('common.loading')}</div>
  )

  const limits = getPlanLimits((restaurant?.plan ?? 'starter') as RestaurantPlan)

  if (!limits.hasBranding) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px' }}>
        <div style={{ maxWidth: '600px', margin: '80px auto' }}>
          <UpgradeHint feature="Branding & Design" />
        </div>
      </div>
    )
  }

  const pkg = getDesignPackage(designPackage)
  const pAccent = primaryColor ?? pkg.preview.primaryColor
  const pBg = bgColor ?? pkg.preview.bgColor
  const pHeader = headerColor ?? pkg.preview.headerColor
  const pCard = cardColor ?? pkg.preview.cardColor
  const pButton = buttonColor ?? pkg.preview.buttonColor
  const pText = textColor ?? pkg.preview.textColor
  const fp = FONT_PAIRS[fontPair] ?? FONT_PAIRS['syne-dmsans']

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          Branding & Design
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>
          Gestalte deine Bestell-Seite individuell — alle Aenderungen sind sofort live.
        </p>
      </div>

      <div className="branding-layout" style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
      {/* ── LEFT COLUMN: alle Einstellungen ── */}
      <div style={{ flex: 1, minWidth: 0 }}>

      {/* ── Section 1: Design-Pakete ── */}
      <section style={{ marginBottom: '36px' }}>
        <label style={sectionLabel}>Design-Paket</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px' }}>
          {DESIGN_PACKAGES.map(p => {
            const isActive = p.id === designPackage
            const card = (
              <button key={p.id} onClick={() => applyPackage(p)} style={{
                width: '100%', background: isActive ? `${p.preview.primaryColor}12` : 'var(--surface)',
                border: isActive ? `2px solid ${p.preview.primaryColor}` : '2px solid var(--border)',
                borderRadius: '12px', padding: '14px 12px', cursor: 'pointer', textAlign: 'left',
                position: 'relative', transition: 'border-color 0.15s, background 0.15s',
              }}>
                {isActive && (
                  <div style={{ position: 'absolute', top: '8px', right: '8px', width: '18px', height: '18px', borderRadius: '50%', background: p.preview.primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Check size={11} /></div>
                )}
                {/* Mini preview stripe */}
                <div style={{ display: 'flex', gap: '3px', marginBottom: '10px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: `linear-gradient(135deg, ${p.preview.primaryColor}, ${darken(p.preview.primaryColor, 40)})` }} />
                  <div style={{ flex: 1, height: '20px', borderRadius: '4px', background: p.preview.bgColor, border: '1px solid var(--border)' }}>
                    <div style={{ width: '40%', height: '6px', borderRadius: '3px', background: p.preview.primaryColor, margin: '7px 4px', opacity: 0.7 }} />
                  </div>
                </div>
                <div style={{ fontSize: '1.1rem', marginBottom: '3px' }}>{p.emoji}</div>
                <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.78rem', lineHeight: 1.2 }}>{p.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginTop: '4px', lineHeight: 1.3 }}>{p.description}</div>
              </button>
            )
            return isActive ? (
              <ShineBorder key={p.id} color={[p.preview.primaryColor, darken(p.preview.primaryColor, 30), '#ffffff22']}>{card}</ShineBorder>
            ) : card
          })}
        </div>
      </section>

      {/* ── Section 2: Layout ── */}
      <section style={{ marginBottom: '36px' }}>
        <label style={sectionLabel}>Layout-Variante</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {(['cards', 'list', 'large-cards', 'grid'] as LayoutVariant[]).map(v => {
            const isActive = v === layoutVariant
            const labels: Record<LayoutVariant, string> = { cards: 'Cards', list: 'Liste', 'large-cards': 'Grosse Karten', grid: '2-Spalten' }
            return (
              <button key={v} onClick={() => { setLayoutVariant(v); setSaved(false) }} style={{
                background: isActive ? `${pAccent}12` : 'var(--surface)',
                border: isActive ? `2px solid ${pAccent}` : '2px solid var(--border)',
                borderRadius: '10px', padding: '12px 8px', cursor: 'pointer', textAlign: 'center',
                transition: 'border-color 0.15s, background 0.15s',
              }}>
                <LayoutIcon variant={v} active={isActive} accent={pAccent} />
                <div style={{ color: isActive ? 'var(--text)' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600, marginTop: '6px' }}>{labels[v]}</div>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Section 3: Schriftart ── */}
      <section style={{ marginBottom: '36px' }}>
        <label style={sectionLabel}>Schriftart</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
          {Object.entries(FONT_PAIRS).map(([id, pair]) => {
            const isActive = id === fontPair
            return (
              <button key={id} onClick={() => { setFontPair(id); setSaved(false) }} style={{
                background: isActive ? `${pAccent}12` : 'var(--surface)',
                border: isActive ? `2px solid ${pAccent}` : '2px solid var(--border)',
                borderRadius: '10px', padding: '14px 12px', cursor: 'pointer', textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
              }}>
                <div style={{ fontFamily: `${pair.heading}, system-ui`, fontWeight: 700, fontSize: '1rem', color: 'var(--text)', marginBottom: '4px' }}>Aa</div>
                <div style={{ fontFamily: `${pair.body}, system-ui`, fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{pair.label}</div>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Section 4: Farben anpassen (collapsible) ── */}
      <section style={{ marginBottom: '36px' }}>
        <button onClick={() => setShowColorSection(!showColorSection)} style={{
          ...sectionLabel, cursor: 'pointer', background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          Farben anpassen
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', transform: showColorSection ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
        </button>
        {showColorSection && (
          <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '12px' }}>
            <div>
              <label style={fieldLabel}>Akzentfarbe</label>
              <ColorPickerInput value={pAccent} onChange={v => { setPrimaryColor(v); setSaved(false) }}
                onReset={() => { setPrimaryColor(null); setSaved(false) }} />
            </div>
            <div>
              <label style={fieldLabel}>Hintergrund</label>
              <ColorPickerInput value={pBg} onChange={v => { setBgColor(v); setSaved(false) }}
                onReset={() => { setBgColor(null); setSaved(false) }} />
            </div>
            <div>
              <label style={fieldLabel}>Header</label>
              <ColorPickerInput value={pHeader} onChange={v => { setHeaderColor(v); setSaved(false) }}
                onReset={() => { setHeaderColor(null); setSaved(false) }} />
            </div>
            <div>
              <label style={fieldLabel}>Karten</label>
              <ColorPickerInput value={pCard} onChange={v => { setCardColor(v); setSaved(false) }}
                onReset={() => { setCardColor(null); setSaved(false) }} />
            </div>
            <div>
              <label style={fieldLabel}>Buttons</label>
              <ColorPickerInput value={pButton} onChange={v => { setButtonColor(v); setSaved(false) }}
                onReset={() => { setButtonColor(null); setSaved(false) }} />
            </div>
            <div>
              <label style={fieldLabel}>Text</label>
              <ColorPickerInput value={pText} onChange={v => { setTextColor(v); setSaved(false) }}
                onReset={() => { setTextColor(null); setSaved(false) }} />
            </div>
          </div>
        )}
      </section>

      {/* ── Section 5: Logo ── */}
      <section style={{ marginBottom: '36px' }}>
        <label style={sectionLabel}>Logo</label>
        <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)' }}>
          {logoUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <img src={logoUrl} alt="Logo" style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', padding: '4px' }} />
              <div>
                <p style={{ color: 'var(--text)', fontSize: '0.875rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>Logo hochgeladen <Check size={14} color="#10b981" /></p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => fileRef.current?.click()} style={btnSecondary}>Ersetzen</button>
                  <button onClick={() => { setLogoUrl(null); setSaved(false) }} style={{ ...btnSecondary, color: '#ef4444', borderColor: '#ef444444' }}>Entfernen</button>
                </div>
              </div>
            </div>
          ) : (
            <div onClick={() => fileRef.current?.click()} style={{
              border: '2px dashed var(--border)', borderRadius: '10px', padding: '32px',
              textAlign: 'center', cursor: 'pointer',
            }}>
              <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}><ImageIcon size={32} color="var(--text-muted)" /></div>
              <p style={{ color: 'var(--text)', fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>
                {logoUploading ? 'Wird hochgeladen...' : 'Logo hochladen'}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
                PNG, JPG, SVG — empfohlen: quadratisch, min. 200x200px
              </p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
        </div>
      </section>

      {/* ── Section 6: Kontakt ── */}
      <section style={{ marginBottom: '36px' }}>
        <label style={sectionLabel}>Kontakt & Beschreibung</label>
        <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={fieldLabel}>Tagline / Beschreibung</label>
            <textarea value={description} onChange={e => { setDescription(e.target.value.slice(0, 160)); setSaved(false) }}
              placeholder="z.B. Authentische Pasta & Pizza seit 1998" rows={2}
              style={{ ...inputStyle, resize: 'vertical' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '3px', textAlign: 'right' }}>{description.length}/160</p>
          </div>
          <div className="branding-contact-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={fieldLabel}>E-Mail</label>
              <input type="email" value={contactEmail} onChange={e => { setContactEmail(e.target.value); setSaved(false) }}
                placeholder="info@restaurant.de" style={inputStyle} />
            </div>
            <div>
              <label style={fieldLabel}>Telefon</label>
              <input type="tel" value={contactPhone} onChange={e => { setContactPhone(e.target.value); setSaved(false) }}
                placeholder="+49 89 123456" style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={fieldLabel}>Adresse</label>
            <input type="text" value={contactAddress} onChange={e => { setContactAddress(e.target.value); setSaved(false) }}
              placeholder="Musterstr. 1, 80331 Muenchen" style={inputStyle} />
          </div>
        </div>
      </section>

      {/* ── Section 8: Custom Design anfragen ── */}
      <section style={{ marginBottom: '36px' }}>
        <label style={sectionLabel}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Palette size={16} />
            Custom Design anfragen
          </span>
        </label>
        <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)' }}>
          {existingDesignReq ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                background: existingDesignReq.status === 'in_progress' ? '#f59e0b22' : existingDesignReq.status === 'done' ? '#10b98122' : `${pAccent}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {existingDesignReq.status === 'done'
                  ? <Check size={16} color="#10b981" />
                  : <Clock size={16} color={existingDesignReq.status === 'in_progress' ? '#f59e0b' : pAccent} />
                }
              </div>
              <div>
                <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.875rem', margin: '0 0 4px' }}>
                  {existingDesignReq.status === 'pending' && 'Anfrage eingegangen — wir melden uns bald.'}
                  {existingDesignReq.status === 'in_progress' && 'Dein Design wird gerade umgesetzt!'}
                  {existingDesignReq.status === 'done' && 'Design-Anfrage abgeschlossen.'}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>
                  Gesendet am {new Date(existingDesignReq.created_at).toLocaleDateString('de-DE')}
                </p>
              </div>
            </div>
          ) : (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '14px', lineHeight: 1.5 }}>
                Du möchtest ein individuelles Design, das perfekt zu deinem Restaurant passt?
                Beschreibe deinen Stil, deine Farben oder Wünsche — wir setzen es für dich um.
              </p>
              <textarea
                value={designReqMessage}
                onChange={e => {
                  setDesignReqMessage(e.target.value.slice(0, 1000))
                  setDesignReqError(null)
                }}
                placeholder="z.B. Wir möchten ein warmes, mediterranes Design mit Olivgrün und Terrakotta. Am liebsten große Produktbilder…"
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', marginBottom: '8px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', margin: 0 }}>
                  {designReqMessage.length}/1000
                  {designReqMessage.trim().length > 0 && designReqMessage.trim().length < 10 && (
                    <span style={{ color: '#ef4444', marginLeft: '8px' }}>Min. 10 Zeichen</span>
                  )}
                </p>
                {designReqError && (
                  <p style={{ color: '#ef4444', fontSize: '0.75rem', margin: 0 }}>{designReqError}</p>
                )}
                <button
                  onClick={submitDesignRequest}
                  disabled={designReqSubmitting || designReqMessage.trim().length < 10}
                  style={{
                    padding: '10px 20px', borderRadius: '8px',
                    background: designReqSent ? '#10b981' : pAccent, color: '#fff',
                    fontWeight: 700, fontSize: '0.82rem', border: 'none',
                    cursor: (designReqSubmitting || designReqMessage.trim().length < 10) ? 'not-allowed' : 'pointer',
                    opacity: (designReqSubmitting || designReqMessage.trim().length < 10) ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: '7px', transition: 'background 0.3s',
                  }}
                >
                  {designReqSubmitting
                    ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Senden…</>
                    : designReqSent
                    ? <><Check size={13} /> Gesendet</>
                    : <><Palette size={13} /> Design anfragen</>
                  }
                </button>
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </>
          )}
        </div>
      </section>

      <style>{`
        @media (max-width: 600px) { .branding-contact-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 900px) { .branding-layout { flex-direction: column !important; } .branding-preview-col { width: 100% !important; position: static !important; } }
      `}</style>

      {/* ── Save Button ── */}
      <button onClick={save} disabled={saving} style={{
        padding: '14px 32px', borderRadius: '10px',
        background: saved ? '#10b981' : pAccent, color: '#fff',
        fontWeight: 700, fontSize: '0.9rem', border: 'none',
        cursor: saving ? 'wait' : 'pointer', transition: 'background 0.3s',
        boxShadow: `0 4px 20px ${pAccent}44`,
      }}>
        {saving ? '...' : saved ? <><Check size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />Gespeichert</> : t('common.save')}
      </button>
      </div>{/* end left column */}

      {/* ── RIGHT COLUMN: Sticky Live Preview ── */}
      <div className="branding-preview-col" style={{ width: '340px', flexShrink: 0, position: 'sticky', top: '24px' }}>
        <label style={sectionLabel}>Vorschau</label>
        <div style={{
          background: pBg, borderRadius: '16px', padding: '0', border: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          {/* Preview Header */}
          <div style={{ background: pHeader, padding: '16px 16px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {logoUrl ? (
                <img src={logoUrl} alt="" style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '7px', background: '#fff', padding: '2px' }} />
              ) : (
                <div style={{ width: '36px', height: '36px', borderRadius: '7px', background: pAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>{pkg.emoji}</div>
              )}
              <div>
                <div style={{ color: pText, fontFamily: `${fp.heading}, system-ui`, fontWeight: 700, fontSize: '0.85rem' }}>{restaurant?.name ?? 'Dein Restaurant'}</div>
                {description && <div style={{ color: pText, opacity: 0.5, fontSize: '0.65rem', marginTop: '1px' }}>{description}</div>}
              </div>
            </div>
            {/* Category pills */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
              <div style={{ padding: '4px 10px', borderRadius: '20px', background: pAccent, color: '#fff', fontSize: '0.65rem', fontWeight: 600 }}>Vorspeisen</div>
              <div style={{ padding: '4px 10px', borderRadius: '20px', background: `${pText}15`, color: pText, opacity: 0.5, fontSize: '0.65rem', fontWeight: 500 }}>Hauptgerichte</div>
              <div style={{ padding: '4px 10px', borderRadius: '20px', background: `${pText}15`, color: pText, opacity: 0.5, fontSize: '0.65rem', fontWeight: 500 }}>Desserts</div>
            </div>
          </div>
          {/* Preview Items */}
          <div style={{ padding: '12px 16px 16px' }}>
            {layoutVariant === 'cards' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['Bruschetta', 'Caprese Salat'].map(name => (
                  <div key={name} style={{ background: pCard, borderRadius: '10px', padding: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '7px', background: `${pText}10`, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: pText, fontFamily: `${fp.body}, system-ui`, fontWeight: 600, fontSize: '0.75rem' }}>{name}</div>
                      <div style={{ color: pAccent, fontWeight: 700, fontSize: '0.72rem', marginTop: '3px' }}>8,90 €</div>
                    </div>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: pButton, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}>+</div>
                  </div>
                ))}
              </div>
            )}
            {layoutVariant === 'list' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {['Bruschetta', 'Caprese Salat', 'Minestrone'].map(name => (
                  <div key={name} style={{ background: pCard, borderRadius: '8px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: pText, fontFamily: `${fp.body}, system-ui`, fontSize: '0.72rem', fontWeight: 500 }}>{name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: pAccent, fontWeight: 700, fontSize: '0.72rem' }}>8,90 €</span>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: pButton, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>+</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {layoutVariant === 'large-cards' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ background: pCard, borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ height: '80px', background: `${pText}08` }} />
                  <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ color: pText, fontFamily: `${fp.body}, system-ui`, fontWeight: 600, fontSize: '0.78rem' }}>Bruschetta</div>
                      <div style={{ color: pAccent, fontWeight: 700, fontSize: '0.75rem', marginTop: '3px' }}>8,90 €</div>
                    </div>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: pButton, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}>+</div>
                  </div>
                </div>
              </div>
            )}
            {layoutVariant === 'grid' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {['Bruschetta', 'Caprese'].map(name => (
                  <div key={name} style={{ background: pCard, borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ aspectRatio: '1', background: `${pText}08` }} />
                    <div style={{ padding: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ color: pText, fontFamily: `${fp.body}, system-ui`, fontWeight: 600, fontSize: '0.68rem' }}>{name}</div>
                        <div style={{ color: pAccent, fontWeight: 700, fontSize: '0.68rem' }}>8,90 €</div>
                      </div>
                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: pButton, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>+</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>{/* end right column */}

      </div>{/* end two-column layout */}
    </div>
  )
}

// ─── Style helpers ───────────────────────────────────────────────────────────
const sectionLabel: React.CSSProperties = {
  display: 'block', color: 'var(--text)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '12px',
}
const fieldLabel: React.CSSProperties = {
  display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1.5px solid var(--border)', background: 'var(--surface-2)',
  color: 'var(--text)', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
}
const btnSecondary: React.CSSProperties = {
  padding: '7px 14px', borderRadius: '7px', border: '1.5px solid var(--border)',
  background: 'transparent', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer',
}
