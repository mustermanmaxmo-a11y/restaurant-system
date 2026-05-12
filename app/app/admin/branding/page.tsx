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
import { ImageIcon, Check, Palette, Loader2, Sparkles, ChevronDown, Maximize2, X, Send, LayoutGrid, Layers, Scan, Smartphone, Tablet, Monitor, Star, RotateCw, Eye } from 'lucide-react'
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

// ─── Design Mockup ───────────────────────────────────────────────────────────
function DesignMockup({ cfg, size, onFullscreen }: {
  cfg: Record<string, string>; size: 'mini' | 'full'; onFullscreen?: () => void
}) {
  const bg = cfg.bg_color || '#111111'
  const surface = cfg.surface_color || cfg.card_color || '#1a1a1a'
  const primary = cfg.primary_color || '#e85d26'
  const text = cfg.text_color || '#ffffff'
  const header = cfg.header_color || surface
  const btn = cfg.button_color || primary
  const br = cfg.border_radius === 'sharp' ? '2px' : cfg.border_radius === 'pill' ? '20px' : '8px'

  if (size === 'mini') {
    return (
      <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '10px' }}>
        <div style={{ background: header, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '18px', height: '18px', borderRadius: '4px', background: primary, flexShrink: 0 }} />
          <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: `${text}25` }} />
          <div style={{ width: '36px', height: '14px', borderRadius: br, background: btn }} />
        </div>
        <div style={{ background: bg, padding: '7px', display: 'flex', gap: '5px' }}>
          {[1, 2].map(i => (
            <div key={i} style={{ flex: 1, background: surface, borderRadius: br, padding: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '4px', background: `${text}10`, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: '3px', width: `${40 + i * 8}px`, borderRadius: '2px', background: `${text}35`, marginBottom: '4px' }} />
                <div style={{ height: '3px', width: '28px', borderRadius: '2px', background: primary, opacity: 0.7 }} />
              </div>
              <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: btn, flexShrink: 0 }} />
            </div>
          ))}
        </div>
        {onFullscreen && (
          <button onClick={onFullscreen} style={{ position: 'absolute', top: '6px', right: '6px', width: '22px', height: '22px', borderRadius: '5px', background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Maximize2 size={10} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{ background: header, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: primary, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: '4px', width: '80px', borderRadius: '2px', background: `${text}45`, marginBottom: '4px' }} />
            <div style={{ height: '3px', width: '50px', borderRadius: '2px', background: `${text}20` }} />
          </div>
          <div style={{ width: '60px', height: '24px', borderRadius: br, background: btn }} />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <div style={{ padding: '4px 12px', borderRadius: '20px', background: primary, height: '20px', width: '60px' }} />
          <div style={{ padding: '4px 12px', borderRadius: '20px', background: `${text}12`, height: '20px', width: '70px' }} />
          <div style={{ padding: '4px 12px', borderRadius: '20px', background: `${text}12`, height: '20px', width: '55px' }} />
        </div>
      </div>
      <div style={{ background: bg, padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[60, 75, 50].map((w, i) => (
          <div key={i} style={{ background: surface, borderRadius: br, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '6px', background: `${text}08`, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: '4px', width: `${w}px`, borderRadius: '2px', background: `${text}40`, marginBottom: '6px' }} />
              <div style={{ height: '3px', width: '80px', borderRadius: '2px', background: `${text}20`, marginBottom: '6px' }} />
              <div style={{ height: '4px', width: '40px', borderRadius: '2px', background: primary, opacity: 0.8 }} />
            </div>
            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: btn, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
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
  // Design-Request State
  const [designReqDescription, setDesignReqDescription] = useState('')
  const [designReqScreenshot, setDesignReqScreenshot] = useState<File | null>(null)
  const [designReqSubmitting, setDesignReqSubmitting] = useState(false)
  const [designReqSent, setDesignReqSent] = useState(false)
  const [designReqError, setDesignReqError] = useState<string | null>(null)
  const [existingDesignReqs, setExistingDesignReqs] = useState<{ id: string; status: string; created_at: string; result_template_id: string | null }[]>([])
  // AI Design-Erkennung state
  const [aiTab, setAiTab] = useState<'screenshot' | 'url'>('screenshot')
  const [aiFile, setAiFile] = useState<File | null>(null)
  const [aiUrl, setAiUrl] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<{ design_config: Record<string, unknown>, confidence: number } | null>(null)
  const [aiError, setAiError] = useState('')
  const [aiApplying, setAiApplying] = useState(false)
  const [aiPreviewUrl, setAiPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!aiFile) { setAiPreviewUrl(null); return }
    const url = URL.createObjectURL(aiFile)
    setAiPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [aiFile])

  // Template browser state
  type TemplateRow = {
    id: string
    name: string
    slug: string
    category: string
    style_tags: string[]
    plan_tier: 'basic' | 'pro' | 'premium'
    preview_url: string | null
    config: Record<string, string>
    sort_order: number
    accessible: boolean
    granted: boolean
  }
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateCategory, setTemplateCategory] = useState<string>('all')
  const [templateSearch, setTemplateSearch] = useState('')
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null)
  const [templateApplied, setTemplateApplied] = useState<string | null>(null)
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)

  // AI preview fullscreen + design chat state
  const [aiPreviewFullscreen, setAiPreviewFullscreen] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string; delta?: Record<string, string> }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [liveDesign, setLiveDesign] = useState<Record<string, string> | null>(null)
  const [livePreviewFullscreen, setLivePreviewFullscreen] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<'templates' | 'colors' | 'layout' | 'ai-chat' | 'ai-scan' | 'info' | 'requests'>('templates')
  const [deviceMode, setDeviceMode] = useState<'phone' | 'tablet' | 'desktop'>('phone')
  const [previewWidth, setPreviewWidth] = useState(300)
  const [previewFullscreen, setPreviewFullscreen] = useState(false)
  const [previewOrientation, setPreviewOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(300)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/owner-login'); return }
      const { data: resto } = await supabase
        .from('restaurants').select('*').eq('owner_id', user.id).limit(1).single()
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

      // Alle Design-Anfragen laden
      const { data: allReqs } = await supabase
        .from('design_requests')
        .select('id, status, created_at, result_template_id')
        .eq('restaurant_id', resto.id)
        .order('created_at', { ascending: false })
      if (allReqs && allReqs.length > 0) setExistingDesignReqs(allReqs)

      // Aktives Template aus design_config lesen
      const dc = (resto as { design_config?: Record<string, unknown> }).design_config
      if (dc && typeof dc.template_id === 'string') {
        setActiveTemplateId(dc.template_id)
      }

      setLoading(false)
    }
    load()
  }, [router])

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Templates laden (abhängig von Restaurant + Filter)
  // Category changes fire immediately; search changes are debounced 350ms
  useEffect(() => {
    if (!restaurant) return

    function doFetch() {
      const ctrl = new AbortController()
      async function loadTemplates() {
        setTemplatesLoading(true)
        try {
          const params = new URLSearchParams({ restaurant_id: restaurant!.id })
          if (templateCategory !== 'all') params.set('category', templateCategory)
          if (templateSearch.trim()) params.set('search', templateSearch.trim())
          const res = await fetch(`/api/design-templates?${params.toString()}`, { signal: ctrl.signal })
          if (!res.ok) { setTemplates([]); return }
          const json = await res.json()
          setTemplates(json.templates ?? [])
        } catch {
          // aborted or network
        } finally {
          setTemplatesLoading(false)
        }
      }
      loadTemplates()
      return ctrl
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    let ctrl: AbortController | undefined
    searchTimeoutRef.current = setTimeout(() => {
      ctrl = doFetch()
    }, 350)

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
      ctrl?.abort()
    }
  }, [restaurant, templateCategory, templateSearch])

  async function applyTemplate(tpl: TemplateRow) {
    if (!restaurant || !tpl.accessible) return
    setApplyingTemplateId(tpl.id)
    try {
      const res = await fetch(`/api/design-templates/${tpl.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: restaurant.id }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j.error ?? 'Template konnte nicht angewendet werden.')
        return
      }
      // Reload restaurant
      const { data: resto } = await supabase
        .from('restaurants').select('*').eq('id', restaurant.id).single()
      if (resto) {
        setRestaurant(resto)
        if (resto.design_package) setDesignPackage(resto.design_package)
        if (resto.layout_variant) setLayoutVariant(resto.layout_variant as LayoutVariant)
        if (resto.font_pair) setFontPair(resto.font_pair)
        setPrimaryColor(resto.primary_color)
        setBgColor(resto.bg_color)
        setHeaderColor(resto.header_color)
        setCardColor(resto.card_color)
        setButtonColor(resto.button_color)
        setTextColor(resto.text_color)
        const dc = (resto as { design_config?: Record<string, unknown> }).design_config
        if (dc && typeof dc.template_id === 'string') setActiveTemplateId(dc.template_id)
      }
      setTemplateApplied(tpl.id)
      setTimeout(() => setTemplateApplied(null), 2500)
    } finally {
      setApplyingTemplateId(null)
    }
  }

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
      const { error: logoUpdateErr } = await supabase.from('restaurants').update({ logo_url: publicUrl }).eq('id', restaurant.id)
      if (logoUpdateErr) {
        setDesignReqError('Logo-URL konnte nicht gespeichert werden. Bitte erneut versuchen.')
      } else {
        setSaved(true); setTimeout(() => setSaved(false), 2500)
      }
    }
    setLogoUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function save() {
    if (!restaurant) return
    setSaving(true)
    const pkg = getDesignPackage(designPackage)
    const { error: saveErr } = await supabase.from('restaurants').update({
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
    if (saveErr) {
      setSaving(false)
      setDesignReqError('Speichern fehlgeschlagen. Bitte erneut versuchen.')
      return
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function submitDesignRequest() {
    if (!restaurant) return
    setDesignReqSubmitting(true)
    setDesignReqError(null)

    const { data: { user: authUser } } = await supabase.auth.getUser()
    const { data: { session } } = await supabase.auth.getSession()
    const token = authUser ? session?.access_token : undefined

    const form = new FormData()
    form.append('restaurant_id', restaurant.id)
    if (designReqDescription.trim()) form.append('description', designReqDescription.trim())
    if (designReqScreenshot) form.append('screenshot', designReqScreenshot)

    const res = await fetch('/api/admin/design-requests', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    const json = await res.json()
    setDesignReqSubmitting(false)
    if (!res.ok) {
      setDesignReqError(json.error ?? 'Fehler beim Senden.')
    } else {
      setDesignReqSent(true)
      const newReq = json.data as { id: string; status: string; created_at: string; result_template_id: string | null }
      setExistingDesignReqs(prev => [newReq, ...prev])
      setDesignReqDescription('')
      setDesignReqScreenshot(null)
    }
  }

  async function analyzeDesign() {
    if (!restaurant) return
    setAiLoading(true)
    setAiError('')
    setAiResult(null)

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      const token = authUser ? session?.access_token : undefined

      const form = new FormData()
      form.append('restaurant_id', restaurant.id)

      if (aiTab === 'screenshot' && aiFile) {
        form.append('image', aiFile)
      } else if (aiTab === 'url' && aiUrl) {
        form.append('url', aiUrl)
      } else {
        setAiError('Bitte Screenshot oder URL angeben')
        return
      }

      const res = await fetch('/api/ai/design-extract', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      const data = await res.json()
      if (!res.ok) { setAiError(data.error ?? 'Fehler beim Analysieren'); return }
      setAiResult(data)
    } catch {
      setAiError('Verbindungsfehler')
    } finally {
      setAiLoading(false)
    }
  }

  async function applyAiDesign() {
    if (!restaurant || !aiResult) return
    setAiApplying(true)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      const token = authUser ? session?.access_token : undefined
      const res = await fetch('/api/admin/design-config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ restaurant_id: restaurant.id, design_config: aiResult.design_config }),
      })
      if (res.ok) {
        // Update local restaurant state with the new design_config
        setRestaurant(prev => prev ? { ...prev, design_config: aiResult!.design_config } : null)
        setAiResult(null)
        setAiFile(null)
        setAiUrl('')
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        const d = await res.json()
        setAiError(d.error ?? 'Fehler beim Speichern')
      }
    } finally {
      setAiApplying(false)
    }
  }

  async function sendChatMessage() {
    if (!restaurant || !chatInput.trim() || chatLoading) return
    const userMsg = { role: 'user' as const, content: chatInput.trim() }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      const token = authUser ? session?.access_token : undefined

      const currentPkg = getDesignPackage(designPackage)
      const currentConfig = liveDesign ?? {
        primary_color: primaryColor ?? currentPkg.preview.primaryColor,
        bg_color: bgColor ?? currentPkg.preview.bgColor,
        header_color: headerColor ?? currentPkg.preview.headerColor,
        card_color: cardColor ?? currentPkg.preview.cardColor,
        button_color: buttonColor ?? currentPkg.preview.buttonColor,
        text_color: textColor ?? currentPkg.preview.textColor,
        font_pair: fontPair,
        layout_variant: layoutVariant,
      }

      const res = await fetch('/api/ai/design-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          current_design_config: currentConfig,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.error ?? 'Fehler aufgetreten' }])
        return
      }
      const { message, delta } = data as { message: string; delta?: Record<string, string> }
      setChatMessages(prev => [...prev, { role: 'assistant', content: message, delta }])
      if (delta && Object.keys(delta).length > 0) {
        setLiveDesign(prev => ({ ...(prev ?? {}), ...delta }))
      }
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Verbindungsfehler' }])
    } finally {
      setChatLoading(false)
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
  const pAccent = liveDesign?.primary_color ?? primaryColor ?? pkg.preview.primaryColor
  const pBg = liveDesign?.bg_color ?? bgColor ?? pkg.preview.bgColor
  const pHeader = liveDesign?.header_color ?? headerColor ?? pkg.preview.headerColor
  const pCard = liveDesign?.card_color ?? cardColor ?? pkg.preview.cardColor
  const pButton = liveDesign?.button_color ?? buttonColor ?? pkg.preview.buttonColor
  const pText = liveDesign?.text_color ?? textColor ?? pkg.preview.textColor
  const fp = FONT_PAIRS[fontPair] ?? FONT_PAIRS['syne-dmsans']

  // ── Preview content (shared across device frames) ──────────────────────────
  const previewContent = (
    <div style={{ background: pBg, minHeight: '100%' }}>
      <div style={{ background: pHeader, padding: '14px 14px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          {logoUrl ? (
            <img src={logoUrl} alt="" style={{ width: '30px', height: '30px', objectFit: 'contain', borderRadius: '6px', background: '#fff', padding: '2px' }} />
          ) : (
            <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: pAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>{pkg.emoji}</div>
          )}
          <div>
            <div style={{ color: pText, fontFamily: `${fp.heading}, system-ui`, fontWeight: 700, fontSize: '0.8rem' }}>{restaurant?.name ?? 'Dein Restaurant'}</div>
            {description && <div style={{ color: pText, opacity: 0.5, fontSize: '0.6rem' }}>{description}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '5px' }}>
          <div style={{ padding: '3px 9px', borderRadius: '20px', background: pAccent, color: '#fff', fontSize: '0.6rem', fontWeight: 600 }}>Vorspeisen</div>
          <div style={{ padding: '3px 9px', borderRadius: '20px', background: `${pText}15`, color: pText, opacity: 0.5, fontSize: '0.6rem' }}>Hauptgerichte</div>
          <div style={{ padding: '3px 9px', borderRadius: '20px', background: `${pText}15`, color: pText, opacity: 0.5, fontSize: '0.6rem' }}>Desserts</div>
        </div>
      </div>
      <div style={{ padding: '10px 12px' }}>
        {layoutVariant === 'cards' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {['Bruschetta', 'Caprese', 'Minestrone'].map(name => (
              <div key={name} style={{ background: pCard, borderRadius: '8px', padding: '9px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '6px', background: `${pText}10`, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: pText, fontFamily: `${fp.body}, system-ui`, fontWeight: 600, fontSize: '0.7rem' }}>{name}</div>
                  <div style={{ color: pAccent, fontWeight: 700, fontSize: '0.65rem', marginTop: '2px' }}>8,90 €</div>
                </div>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: pButton, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>+</div>
              </div>
            ))}
          </div>
        )}
        {layoutVariant === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {['Bruschetta', 'Caprese', 'Minestrone', 'Tiramisu'].map(name => (
              <div key={name} style={{ background: pCard, borderRadius: '6px', padding: '7px 9px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: pText, fontSize: '0.68rem', fontWeight: 500 }}>{name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: pAccent, fontWeight: 700, fontSize: '0.65rem' }}>8,90 €</span>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: pButton, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>+</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {layoutVariant === 'large-cards' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            <div style={{ background: pCard, borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ height: '70px', background: `${pText}08` }} />
              <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ color: pText, fontWeight: 600, fontSize: '0.72rem' }}>Bruschetta</div>
                  <div style={{ color: pAccent, fontWeight: 700, fontSize: '0.68rem', marginTop: '2px' }}>8,90 €</div>
                </div>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: pButton, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>+</div>
              </div>
            </div>
          </div>
        )}
        {layoutVariant === 'grid' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {['Bruschetta', 'Caprese'].map(name => (
              <div key={name} style={{ background: pCard, borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ aspectRatio: '1', background: `${pText}08` }} />
                <div style={{ padding: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: pText, fontWeight: 600, fontSize: '0.62rem' }}>{name}</div>
                    <div style={{ color: pAccent, fontWeight: 700, fontSize: '0.6rem' }}>8,90 €</div>
                  </div>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: pButton, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.65rem', fontWeight: 700 }}>+</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── Header Bar ── */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'var(--surface)' }}>
        <div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Branding & Design</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', margin: '2px 0 0' }}>Alle Änderungen sind sofort live sichtbar.</p>
        </div>
        <button onClick={save} disabled={saving} style={{
          padding: '10px 22px', borderRadius: '8px',
          background: saved ? '#10b981' : pAccent, color: '#fff',
          fontWeight: 700, fontSize: '0.85rem', border: 'none',
          cursor: saving ? 'wait' : 'pointer', transition: 'background 0.3s',
          display: 'flex', alignItems: 'center', gap: '6px',
          boxShadow: `0 2px 12px ${pAccent}44`,
        }}>
          {saving ? '…' : saved ? <><Check size={14} />Gespeichert</> : t('common.save')}
        </button>
      </div>

      {/* ── Mobile Tab Bar ── */}
      {isMobile && (
        <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border)', padding: '0 4px', flexShrink: 0, scrollbarWidth: 'none' }}>
          {([
            { key: 'templates', label: 'Templates',       icon: <LayoutGrid size={13} /> },
            { key: 'colors',    label: 'Farben',           icon: <Palette size={13} /> },
            { key: 'layout',    label: 'Layout',           icon: <Layers size={13} /> },
            { key: 'ai-chat',   label: 'KI Chat',          icon: <Sparkles size={13} /> },
            { key: 'ai-scan',   label: 'Erkennen',         icon: <Scan size={13} /> },
            { key: 'info',      label: 'Logo & Infos',     icon: <ImageIcon size={13} /> },
            { key: 'requests',  label: 'Anfragen',         icon: <Star size={13} /> },
          ] as const).map(tab => {
            const active = activeTab === tab.key
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '10px 12px', whiteSpace: 'nowrap', flexShrink: 0,
                border: 'none', borderBottom: active ? `2px solid ${pAccent}` : '2px solid transparent',
                background: 'transparent', cursor: 'pointer',
                color: active ? pAccent : 'var(--text-muted)',
                fontWeight: active ? 700 : 400, fontSize: '0.78rem',
              }}>
                {tab.icon}{tab.label}
              </button>
            )
          })}
        </div>
      )}

      {/* ── 3-Column Layout ── */}
      <div
        style={{ display: 'flex', flex: 1, overflow: 'hidden' }}
        onMouseMove={e => {
          if (!isDragging.current) return
          const delta = dragStartX.current - e.clientX
          const newWidth = Math.min(600, Math.max(220, dragStartWidth.current + delta))
          setPreviewWidth(newWidth)
        }}
        onMouseUp={() => { isDragging.current = false; document.body.style.cursor = '' }}
        onMouseLeave={() => { isDragging.current = false; document.body.style.cursor = '' }}
      >

        {/* Left: Tab Navigation */}
        <nav style={{ width: '188px', borderRight: '1px solid var(--border)', padding: '10px 8px', display: isMobile ? 'none' : 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto', flexShrink: 0 }}>
          {([
            { key: 'templates', label: 'Templates', icon: <LayoutGrid size={14} /> },
            { key: 'colors', label: 'Farben & Schrift', icon: <Palette size={14} /> },
            { key: 'layout', label: 'Layout', icon: <Layers size={14} /> },
            { key: 'ai-chat', label: 'KI Assistent', icon: <Sparkles size={14} /> },
            { key: 'ai-scan', label: 'Design erkennen', icon: <Scan size={14} /> },
            { key: 'info', label: 'Logo & Infos', icon: <ImageIcon size={14} /> },
            { key: 'requests', label: 'Design anfragen', icon: <Star size={14} /> },
          ] as const).map(tab => {
            const isActive = activeTab === tab.key
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '9px 11px', borderRadius: '7px',
                background: isActive ? `${pAccent}18` : 'transparent',
                color: isActive ? pAccent : 'var(--text-muted)',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                fontSize: '0.8rem', fontWeight: isActive ? 700 : 500,
                transition: 'background 0.15s, color 0.15s',
                width: '100%',
              }}>
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Middle: Content Area */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', minWidth: 0 }}>

          {/* ── TEMPLATES TAB ── */}
          {activeTab === 'templates' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={tabHeading}>Template-Bibliothek</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '4px' }}>50+ kuratierte Designs — wähle eines, das zu deinem Restaurant passt.</p>
              </div>
              <label style={sectionLabel}>Design-Paket</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', marginBottom: '28px' }}>
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
              <label style={sectionLabel}>50+ Templates</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {[
                  { id: 'all', label: 'Alle' }, { id: 'fast-food', label: 'Fast Food' }, { id: 'fine-dining', label: 'Fine Dining' },
                  { id: 'casual', label: 'Casual' }, { id: 'bar', label: 'Bar' }, { id: 'cafe', label: 'Café' },
                  { id: 'asian', label: 'Asian' }, { id: 'italian', label: 'Italian' }, { id: 'bavarian', label: 'Bayerisch' },
                  { id: 'street-food', label: 'Street Food' }, { id: 'scandinavian', label: 'Skandinavisch' },
                ].map(cat => {
                  const isCatActive = cat.id === templateCategory
                  return (
                    <button key={cat.id} onClick={() => setTemplateCategory(cat.id)} style={{
                      padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                      background: isCatActive ? 'var(--text)' : 'var(--surface)', color: isCatActive ? 'var(--bg)' : 'var(--text-muted)',
                      border: '1.5px solid var(--border)', transition: 'all 0.15s',
                    }}>{cat.label}</button>
                  )
                })}
              </div>
              <input type="text" value={templateSearch} onChange={e => setTemplateSearch(e.target.value)}
                placeholder="Templates durchsuchen…" style={{ ...inputStyle, marginBottom: '14px' }} />
              {templatesLoading && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '20px 0' }}>Lade Templates…</div>}
              {!templatesLoading && templates.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '20px 0' }}>Keine Templates gefunden.</div>}
              {!templatesLoading && templates.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {templates.map(tpl => {
                    const isTplActive = activeTemplateId === tpl.id
                    const isApplying = applyingTemplateId === tpl.id
                    const justApplied = templateApplied === tpl.id
                    const cfg = tpl.config ?? {}
                    const swatches = [cfg.bg_color, cfg.surface_color, cfg.primary_color, cfg.button_color, cfg.text_color].filter(Boolean)
                    const tierColor = tpl.plan_tier === 'premium' ? '#8B5CF6' : tpl.plan_tier === 'pro' ? '#F59E0B' : '#4B5563'
                    return (
                      <div key={tpl.id} style={{
                        background: 'var(--surface)', border: isTplActive ? `2px solid ${cfg.primary_color}` : '2px solid var(--border)',
                        borderRadius: '12px', padding: '12px', position: 'relative',
                        opacity: tpl.accessible ? 1 : 0.55, transition: 'border-color 0.15s',
                      }}>
                        {isTplActive && (
                          <div style={{ position: 'absolute', top: '8px', right: '8px', padding: '3px 8px', borderRadius: '12px', background: cfg.primary_color, color: '#fff', fontSize: '0.62rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Check size={10} /> Aktiv
                          </div>
                        )}
                        <div style={{ height: '70px', borderRadius: '8px', background: cfg.bg_color, marginBottom: '10px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: '70%', height: '40px', borderRadius: '6px', background: cfg.surface_color || cfg.card_color, display: 'flex', alignItems: 'center', padding: '0 8px', gap: '6px' }}>
                            <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: cfg.primary_color }} />
                            <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: cfg.text_color, opacity: 0.4 }} />
                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: cfg.button_color || cfg.primary_color }} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '3px', marginBottom: '8px' }}>
                          {swatches.map((c, i) => <div key={i} style={{ width: '16px', height: '16px', borderRadius: '50%', background: c, border: '1px solid var(--border)' }} />)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.82rem' }}>{tpl.name}</div>
                          <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 800, background: `${tierColor}22`, color: tierColor, letterSpacing: '0.04em' }}>
                            {tpl.plan_tier === 'premium' ? 'PREMIUM' : tpl.plan_tier === 'pro' ? 'PRO' : 'BASIC'}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.66rem', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{tpl.category}</div>
                        <button onClick={() => applyTemplate(tpl)} disabled={!tpl.accessible || isApplying || isTplActive} style={{
                          width: '100%', padding: '8px', borderRadius: '7px', fontSize: '0.78rem', fontWeight: 700,
                          background: justApplied ? '#10b981' : isTplActive ? 'var(--surface-2)' : tpl.accessible ? cfg.primary_color : 'var(--surface-2)',
                          color: isTplActive ? 'var(--text-muted)' : '#fff', border: 'none',
                          cursor: !tpl.accessible || isApplying || isTplActive ? 'not-allowed' : 'pointer', transition: 'background 0.2s',
                        }}>
                          {isApplying ? 'Wird angewendet…' : justApplied ? '✓ Angewendet' : isTplActive ? 'Aktuell aktiv' : !tpl.accessible ? `Upgrade auf ${tpl.plan_tier}` : 'Anwenden'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── COLORS & FONTS TAB ── */}
          {activeTab === 'colors' && (
            <div>
              <h2 style={tabHeading}>Farben & Schrift</h2>
              <div style={{ marginBottom: '28px' }}>
                <label style={sectionLabel}>Farben anpassen</label>
                <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div><label style={fieldLabel}>Akzentfarbe</label><ColorPickerInput value={pAccent} onChange={v => { setPrimaryColor(v); setSaved(false) }} onReset={() => { setPrimaryColor(null); setSaved(false) }} /></div>
                  <div><label style={fieldLabel}>Hintergrund</label><ColorPickerInput value={pBg} onChange={v => { setBgColor(v); setSaved(false) }} onReset={() => { setBgColor(null); setSaved(false) }} /></div>
                  <div><label style={fieldLabel}>Header</label><ColorPickerInput value={pHeader} onChange={v => { setHeaderColor(v); setSaved(false) }} onReset={() => { setHeaderColor(null); setSaved(false) }} /></div>
                  <div><label style={fieldLabel}>Karten</label><ColorPickerInput value={pCard} onChange={v => { setCardColor(v); setSaved(false) }} onReset={() => { setCardColor(null); setSaved(false) }} /></div>
                  <div><label style={fieldLabel}>Buttons</label><ColorPickerInput value={pButton} onChange={v => { setButtonColor(v); setSaved(false) }} onReset={() => { setButtonColor(null); setSaved(false) }} /></div>
                  <div><label style={fieldLabel}>Text</label><ColorPickerInput value={pText} onChange={v => { setTextColor(v); setSaved(false) }} onReset={() => { setTextColor(null); setSaved(false) }} /></div>
                </div>
              </div>
              <label style={sectionLabel}>Schriftart</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                {Object.entries(FONT_PAIRS).map(([id, pair]) => {
                  const isFontActive = id === fontPair
                  return (
                    <button key={id} onClick={() => { setFontPair(id); setSaved(false) }} style={{
                      background: isFontActive ? `${pAccent}12` : 'var(--surface)', border: isFontActive ? `2px solid ${pAccent}` : '2px solid var(--border)',
                      borderRadius: '10px', padding: '14px 12px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, background 0.15s',
                    }}>
                      <div style={{ fontFamily: `${pair.heading}, system-ui`, fontWeight: 700, fontSize: '1rem', color: 'var(--text)', marginBottom: '4px' }}>Aa</div>
                      <div style={{ fontFamily: `${pair.body}, system-ui`, fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{pair.label}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── LAYOUT TAB ── */}
          {activeTab === 'layout' && (
            <div>
              <h2 style={tabHeading}>Layout</h2>
              <label style={sectionLabel}>Layout-Variante</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                {(['cards', 'list', 'large-cards', 'grid'] as LayoutVariant[]).map(v => {
                  const isLActive = v === layoutVariant
                  const labels: Record<LayoutVariant, string> = { cards: 'Cards', list: 'Liste', 'large-cards': 'Grosse Karten', grid: '2-Spalten' }
                  return (
                    <button key={v} onClick={() => { setLayoutVariant(v); setSaved(false) }} style={{
                      background: isLActive ? `${pAccent}12` : 'var(--surface)', border: isLActive ? `2px solid ${pAccent}` : '2px solid var(--border)',
                      borderRadius: '10px', padding: '12px 8px', cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.15s, background 0.15s',
                    }}>
                      <LayoutIcon variant={v} active={isLActive} accent={pAccent} />
                      <div style={{ color: isLActive ? 'var(--text)' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600, marginTop: '6px' }}>{labels[v]}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── AI CHAT TAB ── */}
          {activeTab === 'ai-chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ marginBottom: '14px' }}>
                <h2 style={tabHeading}>KI Design-Assistent</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '4px' }}>Beschreib dein Wunsch-Design — die KI passt Farben und Layout automatisch an und du siehst die Änderungen sofort in der Vorschau.</p>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px', minHeight: '200px', maxHeight: 'calc(100vh - 380px)', background: 'var(--surface)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border)' }}>
                {chatMessages.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', marginTop: '30px', lineHeight: 1.8 }}>
                    Beschreib wie dein Design aussehen soll.<br />
                    <span style={{ fontSize: '0.73rem', opacity: 0.65 }}>&ldquo;Mach es dunkler&rdquo; · &ldquo;Blaue Akzentfarbe&rdquo; · &ldquo;Runde Ecken&rdquo;<br />&ldquo;Elegantes Gold auf Schwarz&rdquo; · &ldquo;Modernes Flat-Design&rdquo;</span>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '88%', padding: '10px 14px', borderRadius: '12px', background: msg.role === 'user' ? '#8B5CF6' : 'var(--surface-2)', color: msg.role === 'user' ? '#fff' : 'var(--text)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                      {msg.content}
                    </div>
                    {msg.delta && Object.keys(msg.delta).length > 0 && (
                      <div style={{ marginTop: '5px', display: 'flex', gap: '5px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '3px' }}>
                          {Object.values(msg.delta).filter((v): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)).slice(0, 6).map((c, ci) => (
                            <div key={ci} style={{ width: '9px', height: '9px', borderRadius: '50%', background: c, border: '1px solid var(--border)' }} />
                          ))}
                        </div>
                        <button onClick={async () => {
                          if (!restaurant || !msg.delta) return
                          const { data: { user: authUser } } = await supabase.auth.getUser()
                          const { data: { session } } = await supabase.auth.getSession()
                          const token = authUser ? session?.access_token : undefined
                          const merged = { ...(liveDesign ?? {}), ...msg.delta }
                          await fetch('/api/admin/design-config', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                            body: JSON.stringify({ restaurant_id: restaurant.id, design_config: merged }),
                          })
                          setLiveDesign(merged); setSaved(true); setTimeout(() => setSaved(false), 2500)
                        }} style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.25)', cursor: 'pointer' }}>
                          Übernehmen
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ alignSelf: 'flex-start' }}>
                    <div style={{ padding: '9px 14px', borderRadius: '12px', background: 'var(--surface-2)', color: 'var(--text-muted)', fontSize: '1rem', letterSpacing: '0.18em' }}>···</div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }}
                  placeholder="Design beschreiben…"
                  style={{ flex: 1, padding: '11px 14px', borderRadius: '10px', border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }} />
                <button onClick={sendChatMessage} disabled={!chatInput.trim() || chatLoading}
                  style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#8B5CF6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !chatInput.trim() || chatLoading ? 0.45 : 1, flexShrink: 0 }}>
                  <Send size={16} color="#fff" />
                </button>
              </div>
            </div>
          )}

          {/* ── AI SCAN TAB ── */}
          {activeTab === 'ai-scan' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={tabHeading}>Design automatisch erkennen</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '4px' }}>Lade einen Screenshot hoch oder gib die URL ein — die KI erkennt automatisch Farben, Schriften und Stil.</p>
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--surface-2)', borderRadius: 8, padding: 4, maxWidth: '360px' }}>
                {(['screenshot', 'url'] as const).map(tab => (
                  <button key={tab} onClick={() => { setAiTab(tab); setAiResult(null); setAiError('') }}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: aiTab === tab ? 600 : 400, background: aiTab === tab ? 'var(--accent)' : 'transparent', color: aiTab === tab ? '#fff' : 'var(--muted)' }}>
                    {tab === 'screenshot' ? '📸 Screenshot' : '🌐 Website URL'}
                  </button>
                ))}
              </div>
              {aiTab === 'screenshot' && (
                <label style={{ display: 'block', border: '2px dashed var(--border)', borderRadius: 10, padding: '24px', textAlign: 'center', cursor: 'pointer', marginBottom: 12, maxWidth: '480px' }}>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { setAiFile(e.target.files?.[0] ?? null); setAiResult(null) }} />
                  {aiFile ? (
                    <div>
                      {aiPreviewUrl && <img src={aiPreviewUrl} alt="preview" style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 8, marginBottom: 8 }} />}
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{aiFile.name}</div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--muted)' }}>
                      <div style={{ fontSize: '2rem', marginBottom: 8 }}>🖼️</div>
                      <div>Screenshot hier ablegen oder klicken</div>
                      <div style={{ fontSize: '0.75rem', marginTop: 4 }}>PNG, JPG, WebP — max. 8 MB</div>
                    </div>
                  )}
                </label>
              )}
              {aiTab === 'url' && (
                <input type="url" placeholder="https://dein-restaurant.de" value={aiUrl} onChange={e => { setAiUrl(e.target.value); setAiResult(null) }}
                  style={{ ...inputStyle, maxWidth: '480px', marginBottom: 12 }} />
              )}
              {!aiResult && (
                <button onClick={analyzeDesign} disabled={aiLoading || (aiTab === 'screenshot' ? !aiFile : !aiUrl)}
                  style={{ padding: '11px 24px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: (aiLoading || (aiTab === 'screenshot' ? !aiFile : !aiUrl)) ? 0.5 : 1 }}>
                  {aiLoading ? '⏳ KI analysiert Design...' : '✨ Design erkennen'}
                </button>
              )}
              {aiError && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: 8 }}>{aiError}</div>}
              {aiResult && (
                <div style={{ marginTop: 16, maxWidth: '480px' }}>
                  <DesignMockup cfg={aiResult.design_config as Record<string, string>} size="mini" onFullscreen={() => setAiPreviewFullscreen(true)} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: 1 }}>
                      <span style={{ marginRight: 10 }}>Schrift: {aiResult.design_config.font_pair as string}</span>
                      <span>Ecken: {aiResult.design_config.border_radius as string}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{Math.round((aiResult.confidence ?? 0) * 100)}% Konfidenz</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={applyAiDesign} disabled={aiApplying}
                      style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                      {aiApplying ? 'Wird übernommen...' : '✓ Übernehmen'}
                    </button>
                    <button onClick={() => { setAiResult(null); setAiError('') }}
                      style={{ padding: '10px 16px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>
                      Nochmal
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── INFO TAB ── */}
          {activeTab === 'info' && (
            <div>
              <h2 style={tabHeading}>Logo & Infos</h2>
              <section style={{ marginBottom: '28px' }}>
                <label style={sectionLabel}>Logo</label>
                <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', maxWidth: '480px' }}>
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
                    <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: '10px', padding: '32px', textAlign: 'center', cursor: 'pointer' }}>
                      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}><ImageIcon size={32} color="var(--text-muted)" /></div>
                      <p style={{ color: 'var(--text)', fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>{logoUploading ? 'Wird hochgeladen...' : 'Logo hochladen'}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>PNG, JPG, SVG — empfohlen: quadratisch, min. 200x200px</p>
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                </div>
              </section>
              <section>
                <label style={sectionLabel}>Kontakt & Beschreibung</label>
                <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '560px' }}>
                  <div>
                    <label style={fieldLabel}>Tagline / Beschreibung</label>
                    <textarea value={description} onChange={e => { setDescription(e.target.value.slice(0, 160)); setSaved(false) }}
                      placeholder="z.B. Authentische Pasta & Pizza seit 1998" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '3px', textAlign: 'right' }}>{description.length}/160</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div><label style={fieldLabel}>E-Mail</label><input type="email" value={contactEmail} onChange={e => { setContactEmail(e.target.value); setSaved(false) }} placeholder="info@restaurant.de" style={inputStyle} /></div>
                    <div><label style={fieldLabel}>Telefon</label><input type="tel" value={contactPhone} onChange={e => { setContactPhone(e.target.value); setSaved(false) }} placeholder="+49 89 123456" style={inputStyle} /></div>
                  </div>
                  <div>
                    <label style={fieldLabel}>Adresse</label>
                    <input type="text" value={contactAddress} onChange={e => { setContactAddress(e.target.value); setSaved(false) }} placeholder="Musterstr. 1, 80331 Muenchen" style={inputStyle} />
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ── REQUESTS TAB ── */}
          {activeTab === 'requests' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={tabHeading}>Design anfragen</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '4px' }}>Kein passendes Design dabei? Wir erstellen ein individuelles Template für dich.</p>
              </div>
              {existingDesignReqs.length > 0 && (
                <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={sectionLabel}>Bisherige Anfragen</label>
                  {existingDesignReqs.map(req => {
                    const statusMap: Record<string, { label: string; color: string; bg: string }> = {
                      pending:  { label: 'In Bearbeitung', color: '#93c5fd', bg: 'rgba(147,197,253,0.1)' },
                      building: { label: 'Wird gebaut',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                      done:     { label: 'Fertig — Template zugewiesen', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                      rejected: { label: 'Abgelehnt',      color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
                    }
                    const s = statusMap[req.status] ?? statusMap['pending']
                    return (
                      <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', borderRadius: '8px', padding: '10px 14px', gap: '12px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', padding: '2px 7px', borderRadius: '5px', background: s.bg, color: s.color, flexShrink: 0 }}>{s.label}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', flexShrink: 0 }}>{new Date(req.created_at).toLocaleDateString('de-DE')}</span>
                        </div>
                        {req.status === 'done' && req.result_template_id && (
                          <button onClick={async () => {
                            if (!restaurant) return
                            const res = await fetch(`/api/design-templates/${req.result_template_id}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restaurant_id: restaurant.id }) })
                            if (res.ok) {
                              const { data: resto } = await supabase.from('restaurants').select('*').eq('id', restaurant.id).single()
                              if (resto) {
                                setRestaurant(resto)
                                if (resto.design_package) setDesignPackage(resto.design_package)
                                if (resto.layout_variant) setLayoutVariant(resto.layout_variant as LayoutVariant)
                                if (resto.font_pair) setFontPair(resto.font_pair)
                                setPrimaryColor(resto.primary_color); setBgColor(resto.bg_color); setHeaderColor(resto.header_color); setCardColor(resto.card_color); setButtonColor(resto.button_color); setTextColor(resto.text_color)
                              }
                              setSaved(true); setTimeout(() => setSaved(false), 2500)
                            }
                          }} style={{ padding: '6px 12px', borderRadius: '7px', border: 'none', background: '#10b981', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                            Template anwenden
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {!designReqSent ? (
                <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', maxWidth: '540px' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '16px', lineHeight: 1.5 }}>Beschreib uns deinen Stil — wir erstellen ein individuelles Template für dich.</p>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={fieldLabel}>Beschreibung (Optional)</label>
                    <textarea value={designReqDescription} onChange={e => { setDesignReqDescription(e.target.value.slice(0, 1000)); setDesignReqError(null) }}
                      placeholder="z.B. Warmes mediterranes Design mit Olivgrün und Terrakotta, große Produktbilder…" rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', margin: '3px 0 0', textAlign: 'right' }}>{designReqDescription.length}/1000</p>
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={fieldLabel}>Screenshot (Optional)</label>
                    <label style={{ display: 'block', border: '2px dashed var(--border)', borderRadius: '8px', padding: '16px', textAlign: 'center', cursor: 'pointer' }}>
                      <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={e => { setDesignReqScreenshot(e.target.files?.[0] ?? null); setDesignReqError(null) }} />
                      {designReqScreenshot ? (
                        <div style={{ color: 'var(--text)', fontSize: '0.8rem' }}><Check size={14} color="#10b981" style={{ verticalAlign: 'middle', marginRight: '5px' }} />{designReqScreenshot.name}<span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>({(designReqScreenshot.size / 1024 / 1024).toFixed(1)} MB)</span></div>
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Bild hochladen (PNG, JPG, WebP — max. 8 MB)</div>
                      )}
                    </label>
                  </div>
                  {designReqError && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginBottom: '10px' }}>{designReqError}</p>}
                  <button onClick={submitDesignRequest} disabled={designReqSubmitting} style={{
                    padding: '10px 20px', borderRadius: '8px', background: pAccent, color: '#fff', fontWeight: 700, fontSize: '0.82rem', border: 'none',
                    cursor: designReqSubmitting ? 'wait' : 'pointer', opacity: designReqSubmitting ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '7px',
                  }}>
                    {designReqSubmitting ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Senden…</> : <><Palette size={13} /> Anfrage senden</>}
                  </button>
                  <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                </div>
              ) : (
                <div style={{ padding: '20px', background: 'rgba(16,185,129,0.08)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.2)', maxWidth: '480px' }}>
                  <p style={{ color: '#10b981', fontWeight: 700, fontSize: '0.875rem', margin: '0 0 4px' }}><Check size={14} style={{ verticalAlign: 'middle', marginRight: '5px' }} />Anfrage erfolgreich gesendet!</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>Wir melden uns, sobald dein individuelles Template fertig ist.</p>
                  <button onClick={() => setDesignReqSent(false)} style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Weitere Anfrage stellen</button>
                </div>
              )}
            </div>
          )}

        </main>

        {/* Drag Resizer */}
        <div
          onMouseDown={e => {
            isDragging.current = true
            dragStartX.current = e.clientX
            dragStartWidth.current = previewWidth
            document.body.style.cursor = 'col-resize'
            e.preventDefault()
          }}
          style={{
            width: '5px', flexShrink: 0, cursor: 'col-resize',
            background: 'var(--border)',
            position: 'relative',
            transition: 'background 0.15s',
            display: isMobile ? 'none' : 'block',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent)' }}
          onMouseLeave={e => { if (!isDragging.current) (e.currentTarget as HTMLDivElement).style.background = 'var(--border)' }}
          title="Breite anpassen"
        >
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: '3px', height: '32px', borderRadius: '2px',
            background: 'var(--text-muted)', opacity: 0.35,
          }} />
        </div>

        {/* Right: Device Preview */}
        <aside style={{ width: `${previewWidth}px`, borderLeft: 'none', display: isMobile ? 'none' : 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 12px', flexShrink: 0, overflowY: 'auto' }}>

          {/* Device Toggle + Fullscreen */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', width: '100%', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '3px', flex: 1, background: 'var(--surface-2)', borderRadius: '9px', padding: '3px' }}>
              {([
                { mode: 'phone', icon: <Smartphone size={13} />, label: 'Phone' },
                { mode: 'tablet', icon: <Tablet size={13} />, label: 'Tablet' },
                { mode: 'desktop', icon: <Monitor size={13} />, label: 'Desktop' },
              ] as const).map(d => (
                <button key={d.mode} onClick={() => setDeviceMode(d.mode)} title={d.label} style={{
                  flex: 1, padding: '6px 4px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  background: deviceMode === d.mode ? 'var(--surface)' : 'transparent',
                  color: deviceMode === d.mode ? 'var(--text)' : 'var(--text-muted)',
                  boxShadow: deviceMode === d.mode ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  fontSize: '0.68rem', fontWeight: deviceMode === d.mode ? 700 : 400,
                  transition: 'all 0.15s',
                }}>
                  {d.icon}{d.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPreviewFullscreen(true)}
              title="Vorschau vergrößern"
              style={{
                width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <Maximize2 size={14} />
            </button>
          </div>

          {/* Phone Frame */}
          {deviceMode === 'phone' && (
            <div style={{ width: '224px', borderRadius: '36px', border: '7px solid #222', background: '#000', boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 0 0 1px #3a3a3a', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '64px', height: '20px', background: '#000', borderRadius: '0 0 14px 14px', zIndex: 10 }} />
              <div style={{ height: '460px', overflow: 'hidden', paddingTop: '20px' }}>
                {previewContent}
              </div>
              <div style={{ height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                <div style={{ width: '72px', height: '3px', background: '#3a3a3a', borderRadius: '2px' }} />
              </div>
            </div>
          )}

          {/* Tablet Frame */}
          {deviceMode === 'tablet' && (
            <div style={{ width: '256px', borderRadius: '18px', border: '6px solid #222', background: '#000', boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 0 0 1px #3a3a3a', overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ height: '8px', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '28px', height: '3px', background: '#2a2a2a', borderRadius: '2px' }} />
              </div>
              <div style={{ height: '380px', overflow: 'hidden' }}>
                {previewContent}
              </div>
              <div style={{ height: '8px', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #2a2a2a' }} />
              </div>
            </div>
          )}

          {/* Desktop Frame */}
          {deviceMode === 'desktop' && (
            <div style={{ width: '276px', flexShrink: 0 }}>
              <div style={{ background: '#1e1e1e', borderRadius: '8px 8px 0 0', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff5f57' }} />
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffbd2e' }} />
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#28ca41' }} />
                </div>
                <div style={{ flex: 1, background: '#2d2d2d', borderRadius: '4px', padding: '3px 8px', fontSize: '0.58rem', color: '#666' }}>
                  {restaurant?.name ? restaurant.name.toLowerCase().replace(/\s+/g, '-') : 'restaurant'}.app
                </div>
              </div>
              <div style={{ border: '2px solid #1e1e1e', borderTop: 'none', borderRadius: '0 0 6px 6px', height: '320px', overflow: 'hidden' }}>
                {previewContent}
              </div>
              <div style={{ width: '60px', height: '10px', background: '#1e1e1e', borderRadius: '0 0 4px 4px', margin: '0 auto' }} />
            </div>
          )}

          <div style={{ marginTop: '10px', fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Live-Vorschau{liveDesign ? ' · KI aktiv' : ''}
          </div>

        </aside>

      </div>{/* end 3-column */}

      {/* ── Mobile FAB: Vorschau öffnen ── */}
      {isMobile && (
        <button
          onClick={() => setPreviewFullscreen(true)}
          title="Vorschau öffnen"
          style={{
            position: 'fixed', bottom: '20px', right: '20px', zIndex: 50,
            width: '52px', height: '52px', borderRadius: '50%',
            background: pAccent, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: `0 4px 20px ${pAccent}66`,
          }}
        >
          <Eye size={20} />
        </button>
      )}

      {/* ── Fullscreen Device Preview Modal ── */}
      {previewFullscreen && (
        <div
          style={{ position: 'fixed', inset: 0, background: '#0d0d0d', zIndex: 200, display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}
          onKeyDown={e => { if (e.key === 'Escape') setPreviewFullscreen(false) }}
          tabIndex={-1}
        >
          {/* Top bar — always clickable */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            {/* Device switcher */}
            <div style={{ display: 'flex', gap: '3px', background: 'rgba(255,255,255,0.07)', borderRadius: '10px', padding: '4px' }}>
              {([
                { mode: 'phone', icon: <Smartphone size={14} />, label: 'Phone' },
                { mode: 'tablet', icon: <Tablet size={14} />, label: 'Tablet' },
                { mode: 'desktop', icon: <Monitor size={14} />, label: 'Desktop' },
              ] as const).map(d => (
                <button key={d.mode} onClick={() => setDeviceMode(d.mode)} style={{
                  padding: '7px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  background: deviceMode === d.mode ? 'rgba(255,255,255,0.14)' : 'transparent',
                  color: deviceMode === d.mode ? '#fff' : 'rgba(255,255,255,0.4)',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '0.78rem', fontWeight: deviceMode === d.mode ? 700 : 400,
                }}>
                  {d.icon}{d.label}
                </button>
              ))}
            </div>
            {/* Orientation toggle — only for phone + tablet */}
            {(deviceMode === 'phone' || deviceMode === 'tablet') && (
              <button
                onClick={() => setPreviewOrientation(o => o === 'portrait' ? 'landscape' : 'portrait')}
                title={previewOrientation === 'portrait' ? 'Querformat' : 'Hochformat'}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)',
                  fontSize: '0.75rem', fontWeight: 500,
                }}
              >
                <RotateCw size={13} style={{ transform: previewOrientation === 'landscape' ? 'rotate(90deg)' : 'none', transition: 'transform 0.25s' }} />
                {previewOrientation === 'portrait' ? 'Hochformat' : 'Querformat'}
              </button>
            )}
            {liveDesign && <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginLeft: '4px' }}>KI aktiv</div>}
            {/* Spacer + close */}
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setPreviewFullscreen(false)}
              style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', gap: '4px', flexShrink: 0 }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Device frame — centered, scrollable if needed */}
          <div
            style={{ overflow: 'auto', padding: '32px 24px' }}
            onClick={() => setPreviewFullscreen(false)}
          >
            <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()}>
              {deviceMode === 'phone' && previewOrientation === 'portrait' && (
                <div style={{ width: '320px', borderRadius: '44px', border: '9px solid #1a1a1a', background: '#000', boxShadow: '0 40px 100px rgba(0,0,0,0.8), inset 0 0 0 1px #333', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '80px', height: '24px', background: '#000', borderRadius: '0 0 16px 16px', zIndex: 10 }} />
                  <div style={{ height: '640px', overflow: 'hidden', paddingTop: '24px' }}>{previewContent}</div>
                  <div style={{ height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                    <div style={{ width: '90px', height: '3px', background: '#333', borderRadius: '2px' }} />
                  </div>
                </div>
              )}
              {deviceMode === 'phone' && previewOrientation === 'landscape' && (
                <div style={{ height: '300px', borderRadius: '36px', border: '9px solid #1a1a1a', background: '#000', boxShadow: '0 40px 100px rgba(0,0,0,0.8), inset 0 0 0 1px #333', position: 'relative', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '22px', height: '70px', background: '#000', borderRadius: '0 14px 14px 0', zIndex: 10 }} />
                  <div style={{ width: '580px', overflow: 'hidden', paddingLeft: '22px' }}>{previewContent}</div>
                  <div style={{ width: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                    <div style={{ width: '3px', height: '80px', background: '#333', borderRadius: '2px' }} />
                  </div>
                </div>
              )}
              {deviceMode === 'tablet' && previewOrientation === 'portrait' && (
                <div style={{ width: '420px', borderRadius: '22px', border: '8px solid #1a1a1a', background: '#000', boxShadow: '0 40px 100px rgba(0,0,0,0.8), inset 0 0 0 1px #333', overflow: 'hidden' }}>
                  <div style={{ height: '10px', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '32px', height: '3px', background: '#2a2a2a', borderRadius: '2px' }} />
                  </div>
                  <div style={{ height: '560px', overflow: 'hidden' }}>{previewContent}</div>
                  <div style={{ height: '14px', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid #2a2a2a' }} />
                  </div>
                </div>
              )}
              {deviceMode === 'tablet' && previewOrientation === 'landscape' && (
                <div style={{ height: '400px', borderRadius: '22px', border: '8px solid #1a1a1a', background: '#000', boxShadow: '0 40px 100px rgba(0,0,0,0.8), inset 0 0 0 1px #333', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: '14px', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid #2a2a2a' }} />
                  </div>
                  <div style={{ width: '640px', overflow: 'hidden' }}>{previewContent}</div>
                  <div style={{ width: '10px', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '32px', height: '3px', background: '#2a2a2a', borderRadius: '2px', transform: 'rotate(90deg)' }} />
                  </div>
                </div>
              )}
              {deviceMode === 'desktop' && (
                <div style={{ width: '860px' }}>
                  <div style={{ background: '#1a1a1a', borderRadius: '10px 10px 0 0', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#ff5f57' }} />
                      <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#ffbd2e' }} />
                      <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#28ca41' }} />
                    </div>
                    <div style={{ flex: 1, background: '#2a2a2a', borderRadius: '5px', padding: '5px 14px', fontSize: '0.72rem', color: '#555' }}>
                      {restaurant?.name ? restaurant.name.toLowerCase().replace(/\s+/g, '-') : 'restaurant'}.app
                    </div>
                  </div>
                  <div style={{ border: '2px solid #1a1a1a', borderTop: 'none', borderRadius: '0 0 8px 8px', height: '520px', overflow: 'hidden' }}>{previewContent}</div>
                  <div style={{ width: '90px', height: '12px', background: '#1a1a1a', borderRadius: '0 0 5px 5px', margin: '0 auto' }} />
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Fullscreen AI Preview Modal ── */}
      {aiPreviewFullscreen && aiResult && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={() => setAiPreviewFullscreen(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ fontWeight: 700, color: 'var(--text)' }}>Design-Vorschau</div>
              <button onClick={() => setAiPreviewFullscreen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}><X size={18} /></button>
            </div>
            <DesignMockup cfg={aiResult.design_config as Record<string, string>} size="full" />
            <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
              {['bg_color', 'surface_color', 'primary_color', 'button_color', 'header_color', 'text_color'].map(key => {
                const color = aiResult.design_config[key] as string
                if (!color) return null
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '3px', background: color, border: '1px solid var(--border)', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{key.replace('_color', '')}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text)', fontFamily: 'monospace' }}>{color}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: '12px', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span>Schrift: {aiResult.design_config.font_pair as string}</span>
              <span>Ecken: {aiResult.design_config.border_radius as string}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{Math.round((aiResult.confidence ?? 0) * 100)}% Konfidenz</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => { setAiPreviewFullscreen(false); applyAiDesign() }} disabled={aiApplying}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {aiApplying ? 'Wird übernommen...' : '✓ Übernehmen'}
              </button>
              <button onClick={() => setAiPreviewFullscreen(false)}
                style={{ padding: '10px 16px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Style helpers ───────────────────────────────────────────────────────────
const tabHeading: React.CSSProperties = {
  fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 4px',
}
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
