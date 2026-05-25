# Landing Page — Unified Design Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die bestehende `/admin/branding` Seite bekommt einen zweiten Top-Level-Tab "Landing Page" mit 3-Spalten-Layout (identisch zur Branding Page), der alle 8 Design-Pakete teilt und volle Inhalt-Verwaltung (Galerie, Öffnungszeiten, Kontakt, Badges, Reviews) bietet.

**Architecture:** `LandingPageTab.tsx` wird als eigenständige Komponente extrahiert und in `branding/page.tsx` eingebunden — kein God-File. Alle Felder gehen ins bestehende `content` JSONB der `landing_pages`-Tabelle (keine DB-Migration). Die 8 Design-Pakete aus `lib/design-packages.ts` werden von beiden Tabs geteilt.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind (inline styles wie im Rest der Codebase), Supabase, Anthropic SDK (claude-haiku-4-5-20251001)

---

## File Map

| Datei | Aktion | Zweck |
|-------|--------|-------|
| `app/lib/lp-layouts.ts` | CREATE | LP Layout-Varianten Definitionen |
| `app/app/admin/branding/LandingPageTab.tsx` | CREATE | Kompletter LP-Editor (State, Tabs, Preview) |
| `app/app/admin/branding/page.tsx` | MODIFY | Top-Level Tab-Switcher hinzufügen |
| `app/app/admin/landing-page/page.tsx` | MODIFY | Redirect → /admin/branding |
| `app/app/api/admin/landing-page/upload/route.ts` | MODIFY | `type: 'gallery'` unterstützen |
| `app/app/api/ai/landing-page-content/route.ts` | MODIFY | Mehr Felder generieren (feature_badges) |

---

## Task 1: `lib/lp-layouts.ts` — Layout-Varianten + Extended Types

**Files:**
- Create: `app/lib/lp-layouts.ts`

- [ ] **Step 1: Datei erstellen**

```typescript
// app/lib/lp-layouts.ts

export const LP_LAYOUT_SLUGS = ['classic-hero', 'split-hero', 'minimal', 'bold-fullscreen'] as const
export type LpLayoutSlug = typeof LP_LAYOUT_SLUGS[number]

export interface LpLayout {
  slug: LpLayoutSlug
  label: string
  desc: string
}

export const LP_LAYOUTS: LpLayout[] = [
  { slug: 'classic-hero',    label: 'Classic Hero',    desc: 'Full-width Hero, Sektionen darunter' },
  { slug: 'split-hero',      label: 'Split Hero',      desc: 'Bild links, Text rechts' },
  { slug: 'minimal',         label: 'Minimal',         desc: 'Clean & minimalistisch' },
  { slug: 'bold-fullscreen', label: 'Bold Fullscreen', desc: 'Vollbild-Hero mit Overlay' },
]

export interface OpeningHours {
  mo?: { open: boolean; from: string; to: string }
  di?: { open: boolean; from: string; to: string }
  mi?: { open: boolean; from: string; to: string }
  do?: { open: boolean; from: string; to: string }
  fr?: { open: boolean; from: string; to: string }
  sa?: { open: boolean; from: string; to: string }
  so?: { open: boolean; from: string; to: string }
}

export interface LandingPageContent {
  // Existing
  logo_url?: string
  hero_image_url?: string
  headline?: string
  subheadline?: string
  about_text?: string
  cta_text?: string
  cta_url?: string
  // Design
  lp_design_package?: string
  lp_layout?: LpLayoutSlug
  // Contact
  address?: string
  maps_url?: string
  phone?: string
  email?: string
  instagram?: string
  facebook?: string
  // Gallery
  gallery?: string[]
  // Features
  feature_badges?: string[]
  // Reviews
  review_url?: string
  // Opening hours
  opening_hours?: OpeningHours
}

export interface LandingPageRow {
  id: string
  restaurant_id: string
  template_slug: string
  content: LandingPageContent
  is_published: boolean
  custom_domain: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: TypeScript prüfen**

```bash
cd app && npx tsc --noEmit 2>&1 | head -30
```

Erwartet: Keine Fehler in `lib/lp-layouts.ts`

- [ ] **Step 3: Commit**

```bash
git add app/lib/lp-layouts.ts
git commit -m "feat(lp): add LP layout variants + extended LandingPageContent type"
```

---

## Task 2: `LandingPageTab.tsx` — Skeleton mit Datenladen und Speichern

**Files:**
- Create: `app/app/admin/branding/LandingPageTab.tsx`

- [ ] **Step 1: Skeleton-Datei anlegen**

Erstelle `app/app/admin/branding/LandingPageTab.tsx` mit diesem Inhalt:

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { DESIGN_PACKAGES } from '@/lib/design-packages'
import { LP_LAYOUTS, type LpLayoutSlug, type LandingPageContent, type LandingPageRow, type OpeningHours } from '@/lib/lp-layouts'
import type { Restaurant } from '@/types/database'

// ─── Constants ────────────────────────────────────────────────────────────────
export type LpTab = 'templates' | 'inhalt' | 'farben' | 'layout' | 'ki-chat'

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
const navItem = (active: boolean): React.CSSProperties => ({
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
  padding: '10px 6px', cursor: 'pointer', borderRadius: '8px',
  background: active ? 'var(--surface-2)' : 'transparent',
  color: active ? 'var(--accent)' : 'var(--text-muted)',
  fontSize: '9px', fontWeight: active ? 700 : 500,
  textTransform: 'uppercase', letterSpacing: '0.03em',
  border: 'none', width: '100%', transition: 'all 0.15s',
})

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  restaurant: Restaurant
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LandingPageTab({ restaurant }: Props) {
  const [activeTab, setActiveTab] = useState<LpTab>('templates')
  const [landingPage, setLandingPage] = useState<LandingPageRow | null>(null)
  const [content, setContent] = useState<LandingPageContent>({})
  const [lpDesignPackage, setLpDesignPackage] = useState('modern-classic')
  const [lpLayout, setLpLayout] = useState<LpLayoutSlug>('classic-hero')
  const [isPublished, setIsPublished] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [uploading, setUploading] = useState<Record<string, boolean>>({})

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
      // Bootstrap design package from restaurant branding if LP hasn't set one yet
      const defaultPkg = (restaurant as any).design_config?.design_package ?? 'modern-classic'
      setLpDesignPackage(c.lp_design_package ?? defaultPkg)
      setLpLayout(c.lp_layout ?? 'classic-hero')
      setContent(c)
    }
    load()
  }, [restaurant])

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave(overrides?: Partial<{ is_published: boolean }>) {
    setSaving(true); setSaveError(''); setSaved(false)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setSaving(false); return }

    const fullContent: LandingPageContent = {
      ...content,
      lp_design_package: lpDesignPackage,
      lp_layout: lpLayout,
    }

    const res = await fetch('/api/admin/landing-page', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        restaurant_id: restaurant.id,
        template_slug: lpDesignPackage,
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
    setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  async function handlePublishToggle() {
    const next = !isPublished; setIsPublished(next)
    await handleSave({ is_published: next })
  }

  // ── Active design package colors ────────────────────────────────────────────
  const activePkg = DESIGN_PACKAGES.find(p => p.id === lpDesignPackage) ?? DESIGN_PACKAGES[0]

  // ── Render (placeholder tabs — filled in subsequent tasks) ──────────────────
  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative' }}>

      {/* Save/publish bar */}
      <div style={{
        position: 'absolute', top: 0, right: 0, zIndex: 10,
        display: 'flex', gap: '8px', padding: '12px 16px',
      }}>
        {saveError && <span style={{ color: '#ef4444', fontSize: '0.75rem', alignSelf: 'center' }}>{saveError}</span>}
        <button
          onClick={() => handleSave()}
          disabled={saving}
          style={{
            padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: saved ? '#10b981' : 'var(--accent)', color: '#fff',
            fontWeight: 700, fontSize: '0.8rem', opacity: saving ? 0.7 : 1,
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
        padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: '2px',
        paddingTop: '56px',
      }}>
        {([
          { id: 'templates', icon: '⬛', label: 'Designs' },
          { id: 'inhalt',    icon: '✏️', label: 'Inhalt' },
          { id: 'farben',    icon: '🎨', label: 'Farben' },
          { id: 'layout',    icon: '▦',  label: 'Layout' },
          { id: 'ki-chat',   icon: '✦',  label: 'KI' },
        ] as { id: LpTab; icon: string; label: string }[]).map(item => (
          <button key={item.id} style={navItem(activeTab === item.id)} onClick={() => setActiveTab(item.id)}>
            <span style={{ fontSize: '16px' }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Center content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingTop: '60px' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Aktives Design: <strong style={{ color: 'var(--text)' }}>{activePkg.name}</strong>
        </div>
        {/* Tab content rendered in later tasks */}
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Tab: {activeTab} — wird in nächsten Tasks befüllt
        </div>
      </div>

      {/* Right preview */}
      <div style={{
        width: '280px', flexShrink: 0, borderLeft: '1px solid var(--border)',
        background: 'var(--surface-2)', padding: '16px', overflowY: 'auto',
        paddingTop: '60px',
      }}>
        <div style={{ ...fieldLabel, marginBottom: '8px' }}>Vorschau</div>
        <div style={{ background: activePkg.preview.bgColor, borderRadius: '8px', padding: '12px', minHeight: '200px' }}>
          <div style={{ color: activePkg.preview.primaryColor, fontWeight: 700, fontSize: '0.8rem' }}>
            {content.headline || restaurant.name}
          </div>
          <div style={{ color: activePkg.preview.textColor, fontSize: '0.7rem', opacity: 0.7, marginTop: '4px' }}>
            {content.subheadline || 'Subheadline…'}
          </div>
        </div>
      </div>

    </div>
  )
}
```

- [ ] **Step 2: TypeScript prüfen**

```bash
cd app && npx tsc --noEmit 2>&1 | head -40
```

Erwartet: Keine Fehler in `LandingPageTab.tsx`

- [ ] **Step 3: Commit**

```bash
git add app/app/admin/branding/LandingPageTab.tsx
git commit -m "feat(lp): add LandingPageTab skeleton with data loading and save logic"
```

---

## Task 3: `branding/page.tsx` — Top-Level Tab-Switcher

**Files:**
- Modify: `app/app/admin/branding/page.tsx`

- [ ] **Step 1: Import und State hinzufügen**

Direkt nach dem letzten bestehenden Import in `page.tsx` einfügen:

```tsx
import LandingPageTab from './LandingPageTab'
```

Im Body der Komponente, direkt nach der ersten `useState`-Zeile, hinzufügen:

```tsx
const [designSection, setDesignSection] = useState<'order-page' | 'landing-page'>('order-page')
```

- [ ] **Step 2: Tab-Switcher in die Top-Bar einfügen**

In der bestehenden Top-Bar (`position: sticky, top: 0...`) — direkt nach dem `<div>` mit dem Titel "Branding & Design" und dem Restaurant-Namen — folgenden Tab-Switcher einfügen (vor den bestehenden Speichern-Button):

```tsx
{/* Top-level section switcher */}
<div style={{
  display: 'flex', background: 'var(--surface-2)', borderRadius: '8px',
  padding: '3px', gap: '2px',
}}>
  {([
    { id: 'order-page',   label: 'Bestellseite' },
    { id: 'landing-page', label: 'Landing Page' },
  ] as const).map(s => (
    <button
      key={s.id}
      onClick={() => setDesignSection(s.id)}
      style={{
        padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
        fontSize: '0.78rem', fontWeight: designSection === s.id ? 700 : 500,
        background: designSection === s.id ? 'var(--accent)' : 'transparent',
        color: designSection === s.id ? '#fff' : 'var(--text-muted)',
        transition: 'all 0.15s',
      }}
    >
      {s.label}
    </button>
  ))}
</div>
```

- [ ] **Step 3: Bestellseite-Content einwickeln + LP-Tab hinzufügen**

Den gesamten bestehenden 3-Spalten-Body (der div mit `display: 'flex', gap: 0, minHeight: ...`) in ein `display: designSection === 'order-page' ? 'flex' : 'none'` wrappen:

```tsx
{/* ── Bestellseite (existing branding editor) ── */}
<div style={{ display: designSection === 'order-page' ? 'flex' : 'none', flex: 1 }}>
  {/* HIER: der gesamte bestehende Body-Content (3-Spalten-Layout) */}
</div>

{/* ── Landing Page Tab ── */}
{restaurant && designSection === 'landing-page' && (
  <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
    <LandingPageTab restaurant={restaurant} />
  </div>
)}
```

**Wichtig:** Der bestehende Body-Content wird NICHT gelöscht, nur eingewickelt. `display: none` verhindert Re-Mount beim Tab-Wechsel.

- [ ] **Step 4: Build prüfen**

```bash
cd app && npx tsc --noEmit 2>&1 | head -40
```

Erwartet: Keine Fehler

- [ ] **Step 5: Visuell prüfen**

Dev-Server starten (`npm run dev` im `app/`-Verzeichnis), `/admin/branding` öffnen. Erwartung:
- Zwei Tabs oben: "Bestellseite" (aktiv) + "Landing Page"
- Klick auf "Landing Page" → zeigt LandingPageTab Skeleton
- Klick zurück auf "Bestellseite" → zeigt original Branding Page

- [ ] **Step 6: Commit**

```bash
git add app/app/admin/branding/page.tsx
git commit -m "feat(lp): add top-level Bestellseite/Landing Page tab switcher to branding page"
```

---

## Task 4: `LandingPageTab.tsx` — Templates Tab

**Files:**
- Modify: `app/app/admin/branding/LandingPageTab.tsx`

- [ ] **Step 1: Templates-Tab-Content implementieren**

Im Center-Content-Div von `LandingPageTab.tsx`, den Placeholder-Div ersetzen durch:

```tsx
{/* ── TEMPLATES TAB ── */}
{activeTab === 'templates' && (
  <div>
    <div style={sectionTitle}>Design-Paket wählen</div>
    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
      Dasselbe Paket wie die Bestellseite — Farben & Fonts bleiben konsistent.
    </p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginBottom: '28px' }}>
      {DESIGN_PACKAGES.map(pkg => {
        const isActive = lpDesignPackage === pkg.id
        return (
          <button
            key={pkg.id}
            onClick={() => setLpDesignPackage(pkg.id)}
            style={{
              padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              background: isActive ? `${pkg.preview.primaryColor}18` : 'var(--surface)',
              outline: isActive ? `2px solid ${pkg.preview.primaryColor}` : '2px solid var(--border)',
              textAlign: 'left', transition: 'all 0.15s',
            }}
          >
            {/* Color preview strip */}
            <div style={{
              height: '36px', borderRadius: '6px', marginBottom: '8px',
              background: `linear-gradient(135deg, ${pkg.preview.bgColor} 40%, ${pkg.preview.primaryColor})`,
              border: `1px solid ${pkg.preview.primaryColor}44`,
            }} />
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', marginBottom: '2px' }}>
              {pkg.emoji} {pkg.name}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
              {pkg.description}
            </div>
          </button>
        )
      })}
    </div>

    <div style={sectionTitle}>Landing Page Layout</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
      {LP_LAYOUTS.map(layout => {
        const isActive = lpLayout === layout.slug
        return (
          <button
            key={layout.slug}
            onClick={() => setLpLayout(layout.slug)}
            style={{
              padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: isActive ? `${activePkg.preview.primaryColor}18` : 'var(--surface)',
              outline: isActive ? `2px solid ${activePkg.preview.primaryColor}` : '2px solid var(--border)',
              textAlign: 'left', transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '3px' }}>
              {layout.label}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {layout.desc}
            </div>
          </button>
        )
      })}
    </div>
  </div>
)}

{/* ── Other tabs placeholder ── */}
{activeTab !== 'templates' && (
  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
    Tab: {activeTab} — folgt
  </div>
)}
```

- [ ] **Step 2: Visuell prüfen**

`/admin/branding` → "Landing Page" Tab → "Designs"-Nav-Item aktiv.  
Erwartung: 8 Design-Paket-Karten sichtbar + 4 Layout-Karten darunter. Klick ändert Auswahl visuell.

- [ ] **Step 3: Commit**

```bash
git add app/app/admin/branding/LandingPageTab.tsx
git commit -m "feat(lp): add Templates tab — 8 design packages + 4 LP layout variants"
```

---

## Task 5: `LandingPageTab.tsx` — Inhalt Tab (Basis-Felder)

**Files:**
- Modify: `app/app/admin/branding/LandingPageTab.tsx`

- [ ] **Step 1: ImageDropzone-Komponente oben in der Datei hinzufügen** (vor dem `export default`)

```tsx
function ImageDropzone({
  label, previewUrl, uploading, onFile, hint,
}: {
  label: string; previewUrl?: string; uploading: boolean
  onFile: (f: File) => void; hint?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
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
```

- [ ] **Step 2: `handleUpload`-Funktion im Component-Body hinzufügen** (nach `handlePublishToggle`)

```tsx
async function handleUpload(file: File, type: 'hero' | 'logo' | 'gallery') {
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
    if (type === 'gallery') {
      setContent(prev => ({ ...prev, gallery: [...(prev.gallery ?? []), j.url].slice(0, 6) }))
    } else if (type === 'hero') {
      setContent(prev => ({ ...prev, hero_image_url: j.url }))
    } else {
      setContent(prev => ({ ...prev, logo_url: j.url }))
    }
  }
}
```

- [ ] **Step 3: Inhalt-Tab Basis-Felder hinzufügen**

Im Center-Content — innerhalb des `{activeTab !== 'templates' && (...)}` Blocks — nach dem "folgt"-Placeholder-Div, ersetzen durch:

```tsx
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
      <label style={fieldLabel}>Über uns <span style={{ opacity: 0.4 }}>(max. 500)</span></label>
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
      <input type="text" value={content.cta_url ?? `/bestellen/${(restaurant as any).slug ?? ''}`}
        onChange={e => setContent(prev => ({ ...prev, cta_url: e.target.value }))}
        placeholder={`/bestellen/${(restaurant as any).slug ?? '...'}`} style={inputStyle} />
    </div>
  </div>
)}

{(activeTab === 'farben' || activeTab === 'layout' || activeTab === 'ki-chat') && (
  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Tab: {activeTab} — folgt</div>
)}
```

- [ ] **Step 4: Visuell prüfen**

"Inhalt"-Tab anklicken → Logo-Dropzone, Hero-Dropzone, 5 Felder sichtbar. Text eingeben → Preview-Panel aktualisiert Headline sofort.

- [ ] **Step 5: Commit**

```bash
git add app/app/admin/branding/LandingPageTab.tsx
git commit -m "feat(lp): add Inhalt tab basic fields (logo, hero, headline, about, CTA)"
```

---

## Task 6: `LandingPageTab.tsx` — Inhalt Tab Erweiterte Felder

**Files:**
- Modify: `app/app/admin/branding/LandingPageTab.tsx`

- [ ] **Step 1: Erweiterte Felder ans Ende des Inhalt-Tab anhängen**

Nach dem letzten `</div>` (CTA Link) im `{activeTab === 'inhalt' && ...}` Block — aber noch vor dem schließenden `</div>` des ganzen Tab-Containers — hinzufügen:

```tsx
{/* ── Kontakt ── */}
<div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
  <div style={sectionTitle}>Kontakt & Adresse</div>
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
  <div style={sectionTitle}>Öffnungszeiten</div>
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
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Offen</span>
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
  <div style={sectionTitle}>Foto-Galerie <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-muted)' }}>(max. 6 Bilder)</span></div>
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
            background: active ? activePkg.preview.primaryColor : 'var(--surface)',
            color: active ? '#fff' : 'var(--text-muted)',
            outline: active ? 'none' : '1.5px solid var(--border)',
          }}
        >{badge}</button>
      )
    })}
  </div>
</div>

{/* ── Review Link ── */}
<div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
  <div style={sectionTitle}>Bewertungen</div>
  <div>
    <label style={fieldLabel}>Google / Tripadvisor Link</label>
    <input type="text" value={content.review_url ?? ''}
      onChange={e => setContent(prev => ({ ...prev, review_url: e.target.value }))}
      placeholder="https://g.page/..." style={inputStyle} />
  </div>
</div>
```

- [ ] **Step 2: Visuell prüfen**

Inhalt-Tab scrollen → Kontakt-Felder, Öffnungszeiten-Grid, Galerie-Upload, Feature-Badge-Chips, Review-Link sichtbar. Checkbox "Offen" deaktivieren → Zeitfelder verschwinden.

- [ ] **Step 3: Commit**

```bash
git add app/app/admin/branding/LandingPageTab.tsx
git commit -m "feat(lp): add extended Inhalt fields (contact, hours, gallery, badges, review)"
```

---

## Task 7: `LandingPageTab.tsx` — Farben + Layout + KI-Chat Tabs

**Files:**
- Modify: `app/app/admin/branding/LandingPageTab.tsx`

- [ ] **Step 1: Farben-Tab implementieren**

Den `{activeTab === 'farben' ...}` Placeholder ersetzen:

```tsx
{activeTab === 'farben' && (
  <div>
    <div style={sectionTitle}>Farben</div>
    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
      Die Landing Page übernimmt automatisch die Farben des gewählten Design-Pakets. Wechsle das Paket im "Designs"-Tab.
    </p>
    <div style={{ background: 'var(--surface)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {[
        { label: 'Primärfarbe (Accent)', color: activePkg.preview.primaryColor },
        { label: 'Hintergrund', color: activePkg.preview.bgColor },
        { label: 'Header', color: activePkg.preview.headerColor },
        { label: 'Button', color: activePkg.preview.buttonColor },
        { label: 'Text', color: activePkg.preview.textColor },
      ].map(({ label, color }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text)' }}>{label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: color, border: '1px solid var(--border)' }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{color}</span>
          </div>
        </div>
      ))}
    </div>
    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '12px' }}>
      Eigene Farb-Overrides → Designs-Tab → anderes Paket wählen.
    </p>
  </div>
)}
```

- [ ] **Step 2: Layout-Tab implementieren**

Den `{activeTab === 'layout' ...}` Placeholder ersetzen:

```tsx
{activeTab === 'layout' && (
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
              background: isActive ? `${activePkg.preview.primaryColor}18` : 'var(--surface)',
              outline: isActive ? `2px solid ${activePkg.preview.primaryColor}` : '2px solid var(--border)',
              textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.15s',
            }}
          >
            <div style={{
              width: '48px', height: '36px', borderRadius: '4px', flexShrink: 0,
              background: activePkg.preview.bgColor,
              border: `1px solid ${isActive ? activePkg.preview.primaryColor : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {layout.slug === 'classic-hero' && (
                <svg width="32" height="24" viewBox="0 0 32 24">
                  <rect x="0" y="0" width="32" height="12" fill={activePkg.preview.primaryColor} opacity="0.4" rx="2"/>
                  <rect x="2" y="14" width="28" height="3" fill={activePkg.preview.textColor} opacity="0.4" rx="1"/>
                  <rect x="2" y="19" width="20" height="2" fill={activePkg.preview.textColor} opacity="0.2" rx="1"/>
                </svg>
              )}
              {layout.slug === 'split-hero' && (
                <svg width="32" height="24" viewBox="0 0 32 24">
                  <rect x="0" y="0" width="15" height="24" fill={activePkg.preview.primaryColor} opacity="0.4" rx="2"/>
                  <rect x="17" y="6" width="13" height="3" fill={activePkg.preview.textColor} opacity="0.4" rx="1"/>
                  <rect x="17" y="11" width="10" height="2" fill={activePkg.preview.textColor} opacity="0.2" rx="1"/>
                </svg>
              )}
              {layout.slug === 'minimal' && (
                <svg width="32" height="24" viewBox="0 0 32 24">
                  <rect x="4" y="4" width="24" height="4" fill={activePkg.preview.textColor} opacity="0.6" rx="1"/>
                  <rect x="8" y="10" width="16" height="2" fill={activePkg.preview.textColor} opacity="0.3" rx="1"/>
                  <rect x="10" y="16" width="12" height="5" fill={activePkg.preview.primaryColor} opacity="0.5" rx="2"/>
                </svg>
              )}
              {layout.slug === 'bold-fullscreen' && (
                <svg width="32" height="24" viewBox="0 0 32 24">
                  <rect x="0" y="0" width="32" height="24" fill={activePkg.preview.primaryColor} opacity="0.25" rx="2"/>
                  <rect x="4" y="8" width="24" height="5" fill={activePkg.preview.textColor} opacity="0.7" rx="1"/>
                  <rect x="8" y="15" width="16" height="4" fill={activePkg.preview.primaryColor} opacity="0.6" rx="2"/>
                </svg>
              )}
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: '3px' }}>{layout.label}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{layout.desc}</div>
            </div>
          </button>
        )
      })}
    </div>
  </div>
)}
```

- [ ] **Step 3: KI-Chat-Tab implementieren**

Den `{activeTab === 'ki-chat' ...}` Placeholder ersetzen + `generating`/`generateError` State nutzen:

```tsx
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
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>GENERIERTE TEXTE</div>
        {content.headline && <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>{content.headline}</div>}
        {content.subheadline && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{content.subheadline}</div>}
        {content.about_text && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{content.about_text}</div>}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: `handleGenerate`-Funktion hinzufügen** (nach `handleUpload` im Component-Body)

```tsx
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
    headline:     j.headline     ?? prev.headline,
    subheadline:  j.subheadline  ?? prev.subheadline,
    about_text:   j.about_text   ?? prev.about_text,
    cta_text:     j.cta_text     ?? prev.cta_text,
  }))
}
```

- [ ] **Step 5: Visuell prüfen**

Farben-Tab → zeigt Farbpalette des aktiven Pakets. Layout-Tab → 4 Karten mit SVG-Icons. KI-Tab → Button vorhanden.

- [ ] **Step 6: Commit**

```bash
git add app/app/admin/branding/LandingPageTab.tsx
git commit -m "feat(lp): add Farben, Layout, KI-Chat tabs to LandingPageTab"
```

---

## Task 8: `LandingPageTab.tsx` — Vollständige Live-Preview

**Files:**
- Modify: `app/app/admin/branding/LandingPageTab.tsx`

- [ ] **Step 1: `LpPreview`-Komponente vor `export default` hinzufügen**

```tsx
function LpPreview({ content, pkg, layout }: {
  content: LandingPageContent
  pkg: ReturnType<typeof DESIGN_PACKAGES.find> & {}
  layout: LpLayoutSlug
}) {
  const bg = (pkg as any).preview.bgColor as string
  const primary = (pkg as any).preview.primaryColor as string
  const text = (pkg as any).preview.textColor as string
  const isLight = bg === '#FFFFFF' || bg === '#FDF8F0' || bg.startsWith('#f') || bg.startsWith('#F')
  const muted = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.55)'
  const cardBg = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'

  return (
    <div style={{ background: bg, borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', fontFamily: 'system-ui, sans-serif', fontSize: '11px' }}>

      {/* Hero — varies by layout */}
      {layout === 'split-hero' ? (
        <div style={{ display: 'flex', minHeight: '80px' }}>
          <div style={{
            width: '45%', background: content.hero_image_url
              ? `url(${content.hero_image_url}) center/cover`
              : `${primary}33`,
            flexShrink: 0,
          }} />
          <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {content.logo_url && <img src={content.logo_url} alt="" style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '4px', background: '#fff', padding: '2px', marginBottom: '6px' }} />}
            <div style={{ fontWeight: 800, color: text, lineHeight: 1.2, marginBottom: '4px' }}>{content.headline || 'Headline'}</div>
            <div style={{ color: muted, lineHeight: 1.3 }}>{content.subheadline || 'Subheadline'}</div>
          </div>
        </div>
      ) : layout === 'minimal' ? (
        <div style={{ padding: '20px', textAlign: 'center', borderBottom: `1px solid ${primary}22` }}>
          {content.logo_url && <img src={content.logo_url} alt="" style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '6px', background: '#fff', padding: '3px', marginBottom: '8px' }} />}
          <div style={{ fontWeight: 800, fontSize: '13px', color: text }}>{content.headline || 'Headline'}</div>
          <div style={{ color: muted, marginTop: '4px' }}>{content.subheadline}</div>
        </div>
      ) : (
        // classic-hero + bold-fullscreen
        <div style={{
          minHeight: '80px',
          background: content.hero_image_url
            ? `linear-gradient(to bottom, ${layout === 'bold-fullscreen' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)'}, ${bg} 90%), url(${content.hero_image_url}) center/cover`
            : `linear-gradient(135deg, ${primary}33, ${bg})`,
          padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        }}>
          {content.logo_url && <img src={content.logo_url} alt="" style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '6px', background: '#fff', padding: '3px', marginBottom: '6px' }} />}
          <div style={{ fontWeight: 800, color: content.hero_image_url ? '#fff' : text, textShadow: content.hero_image_url ? '0 1px 3px rgba(0,0,0,0.7)' : 'none' }}>{content.headline || 'Headline'}</div>
          {content.subheadline && <div style={{ color: content.hero_image_url ? 'rgba(255,255,255,0.8)' : muted, marginTop: '4px', textShadow: content.hero_image_url ? '0 1px 2px rgba(0,0,0,0.5)' : 'none' }}>{content.subheadline}</div>}
        </div>
      )}

      {/* Feature Badges */}
      {(content.feature_badges ?? []).length > 0 && (
        <div style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {(content.feature_badges ?? []).map(b => (
            <span key={b} style={{ padding: '2px 8px', borderRadius: '10px', background: `${primary}22`, color: primary, fontWeight: 700, fontSize: '9px' }}>{b}</span>
          ))}
        </div>
      )}

      {/* About */}
      {content.about_text && (
        <div style={{ padding: '8px 12px', background: cardBg, color: muted, lineHeight: 1.5 }}>{content.about_text}</div>
      )}

      {/* Gallery */}
      {(content.gallery ?? []).length > 0 && (
        <div style={{ padding: '8px 12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
            {(content.gallery ?? []).slice(0, 3).map((url, i) => (
              <img key={i} src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '4px' }} />
            ))}
          </div>
        </div>
      )}

      {/* Opening Hours */}
      {content.opening_hours && Object.keys(content.opening_hours).length > 0 && (
        <div style={{ padding: '8px 12px', background: cardBg }}>
          <div style={{ fontWeight: 700, color: primary, marginBottom: '4px', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Öffnungszeiten</div>
          {DAYS.filter(d => content.opening_hours?.[d.key]).map(d => {
            const val = content.opening_hours![d.key]!
            return (
              <div key={d.key} style={{ display: 'flex', justifyContent: 'space-between', color: muted, marginBottom: '2px' }}>
                <span>{d.label.slice(0, 2)}.</span>
                <span>{val.open ? `${val.from} – ${val.to}` : 'Geschlossen'}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Contact */}
      {(content.address || content.phone || content.email) && (
        <div style={{ padding: '8px 12px' }}>
          <div style={{ fontWeight: 700, color: primary, marginBottom: '4px', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kontakt</div>
          {content.address && <div style={{ color: muted, marginBottom: '2px' }}>📍 {content.address}</div>}
          {content.phone && <div style={{ color: muted, marginBottom: '2px' }}>📞 {content.phone}</div>}
          {content.email && <div style={{ color: muted, marginBottom: '2px' }}>✉️ {content.email}</div>}
          {(content.instagram || content.facebook) && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              {content.instagram && <span style={{ color: primary }}>@ {content.instagram}</span>}
            </div>
          )}
        </div>
      )}

      {/* Review */}
      {content.review_url && (
        <div style={{ padding: '6px 12px' }}>
          <span style={{ background: cardBg, color: primary, padding: '4px 10px', borderRadius: '6px', fontWeight: 700, fontSize: '9px' }}>⭐ Bewertung lesen</span>
        </div>
      )}

      {/* CTA */}
      <div style={{ padding: '12px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', padding: '8px 20px', borderRadius: '7px', background: primary, color: '#fff', fontWeight: 700 }}>
          {content.cta_text || 'Jetzt bestellen'}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Preview-Panel im Render auf `LpPreview` umschalten**

Das bestehende Preview-Panel im Right-Column (das einfache div mit `activePkg.preview.bgColor`) durch `<LpPreview>` ersetzen:

```tsx
{/* Right preview */}
<div style={{
  width: '280px', flexShrink: 0, borderLeft: '1px solid var(--border)',
  background: 'var(--surface-2)', padding: '16px', overflowY: 'auto',
  paddingTop: '60px',
}}>
  <div style={{ ...fieldLabel, marginBottom: '8px' }}>Vorschau</div>
  {isPublished && (
    <div style={{ fontSize: '0.68rem', color: '#10b981', marginBottom: '8px', fontWeight: 600 }}>● Live</div>
  )}
  <LpPreview content={content} pkg={activePkg!} layout={lpLayout} />
</div>
```

- [ ] **Step 3: Visuell prüfen**

Inhalt-Daten eingeben (Headline, Adresse, ein Feature-Badge) → Preview-Panel zeigt alle Sektionen live. Layout-Tab → "Split Hero" wählen → Preview-Panel zeigt Split-Darstellung.

- [ ] **Step 4: Commit**

```bash
git add app/app/admin/branding/LandingPageTab.tsx
git commit -m "feat(lp): add full LpPreview with all sections (gallery, hours, contact, badges)"
```

---

## Task 9: Upload Route — Gallery Support

**Files:**
- Modify: `app/app/api/admin/landing-page/upload/route.ts`

- [ ] **Step 1: `gallery` zu den erlaubten Upload-Typen hinzufügen**

```typescript
// Zeile 9 — ersetzen:
const ALLOWED_UPLOAD_TYPES = ['hero', 'logo'] as const
// durch:
const ALLOWED_UPLOAD_TYPES = ['hero', 'logo', 'gallery'] as const
```

- [ ] **Step 2: Error-Message anpassen**

```typescript
// Zeile 60 — ersetzen:
return NextResponse.json({ error: 'type muss "hero" oder "logo" sein' }, { status: 400 })
// durch:
return NextResponse.json({ error: 'type muss "hero", "logo" oder "gallery" sein' }, { status: 400 })
```

- [ ] **Step 3: Storage-Pfad für gallery anpassen**

```typescript
// Zeile 76 — ersetzen:
const storagePath = `landing-pages/${restaurantId}/${uploadType}-${timestamp}.${ext}`
// durch:
const storagePath = uploadType === 'gallery'
  ? `landing-pages/${restaurantId}/gallery/${timestamp}.${ext}`
  : `landing-pages/${restaurantId}/${uploadType}-${timestamp}.${ext}`
```

- [ ] **Step 4: TypeScript prüfen**

```bash
cd app && npx tsc --noEmit 2>&1 | grep upload
```

Erwartet: Keine Fehler

- [ ] **Step 5: Commit**

```bash
git add app/app/api/admin/landing-page/upload/route.ts
git commit -m "feat(lp): add gallery upload type to landing-page upload route"
```

---

## Task 10: AI Route — Feature Badges generieren

**Files:**
- Modify: `app/app/api/ai/landing-page-content/route.ts`

- [ ] **Step 1: `AiGeneratedContent` Interface erweitern** (Zeile 34–39)

```typescript
interface AiGeneratedContent {
  headline: string
  subheadline: string
  about_text: string
  cta_text: string
  feature_badges?: string[]
}
```

- [ ] **Step 2: Prompt erweitern** (Zeile 106–108 ersetzen)

```typescript
content: `Write landing page copy for a restaurant named "${name}". Category: ${category}. Description: ${description}. Language: ${lang}.

Available feature badges: Vegetarisch, Vegan, Glutenfrei, Halal, Lieferung, Reservierung, Takeaway, Catering, Wifi, Terrasse, Parkplatz.

Return JSON: { "headline": "...", "subheadline": "...", "about_text": "...", "cta_text": "...", "feature_badges": ["badge1", "badge2"] }
Select 2-4 relevant badges based on the restaurant category.`,
```

- [ ] **Step 3: Response-Parsing erweitern** (Zeile 124–140 ersetzen)

```typescript
const { headline, subheadline, about_text, cta_text, feature_badges } = parsed

if (
  typeof headline !== 'string' || !headline.trim() ||
  typeof subheadline !== 'string' || !subheadline.trim() ||
  typeof about_text !== 'string' || !about_text.trim() ||
  typeof cta_text !== 'string' || !cta_text.trim()
) {
  return NextResponse.json({ error: 'Unvollständige KI-Antwort' }, { status: 500 })
}

const result: AiGeneratedContent = {
  headline: headline.trim(),
  subheadline: subheadline.trim(),
  about_text: about_text.trim(),
  cta_text: cta_text.trim(),
  feature_badges: Array.isArray(feature_badges)
    ? feature_badges.filter((b): b is string => typeof b === 'string').slice(0, 4)
    : undefined,
}
```

- [ ] **Step 4: `handleGenerate` in `LandingPageTab.tsx` für feature_badges erweitern**

```typescript
// Nach `cta_text: j.cta_text ?? prev.cta_text,` hinzufügen:
...(Array.isArray(j.feature_badges) && j.feature_badges.length > 0
  ? { feature_badges: j.feature_badges }
  : {}),
```

- [ ] **Step 5: TypeScript prüfen**

```bash
cd app && npx tsc --noEmit 2>&1 | head -20
```

Erwartet: Keine Fehler

- [ ] **Step 6: Commit**

```bash
git add app/app/api/ai/landing-page-content/route.ts app/app/admin/branding/LandingPageTab.tsx
git commit -m "feat(lp): extend AI route to generate feature_badges alongside text content"
```

---

## Task 11: Redirect + Cleanup

**Files:**
- Modify: `app/app/admin/landing-page/page.tsx`

- [ ] **Step 1: Gesamten Inhalt ersetzen durch Redirect**

```tsx
// app/app/admin/landing-page/page.tsx
import { redirect } from 'next/navigation'

export default function LandingPageRedirect() {
  redirect('/admin/branding')
}
```

- [ ] **Step 2: Build-Prüfung**

```bash
cd app && npx tsc --noEmit 2>&1 | head -20
```

Erwartet: Keine Fehler

- [ ] **Step 3: Visuell prüfen**

`/admin/landing-page` aufrufen → sofortiger Redirect nach `/admin/branding`. "Landing Page"-Tab ist sichtbar.

- [ ] **Step 4: Finaler Commit**

```bash
git add app/app/admin/landing-page/page.tsx
git commit -m "feat(lp): redirect /admin/landing-page to /admin/branding"
```

---

## End-to-End Verifikation

Nach allen Tasks die folgenden Punkte manuell prüfen:

- [ ] `/admin/branding` → zwei Tabs: "Bestellseite" (existing) + "Landing Page"
- [ ] Bestellseite-Tab: kein Unterschied zum ursprünglichen Zustand
- [ ] Landing Page → Designs-Tab: alle 8 Design-Pakete + 4 Layout-Varianten
- [ ] Klick auf Paket → Preview-Panel ändert Farben sofort
- [ ] Inhalt-Tab: alle Felder ausfüllbar, Preview aktualisiert live
- [ ] Öffnungszeiten: Checkbox "Offen" deaktivieren → Zeitfelder verschwinden
- [ ] Galerie: Bild hochladen → erscheint im 3er-Grid + im Preview
- [ ] Feature-Badge klicken → Toggle-Effekt + erscheint im Preview
- [ ] Layout-Tab: "Split Hero" wählen → Preview zeigt Split-Darstellung
- [ ] KI-Tab: Button klicken → Felder werden befüllt (erfordert API Key im .env)
- [ ] Speichern → grüner "✓ Gespeichert" Button, Daten nach Page-Reload noch vorhanden
- [ ] Publizieren → Button ändert sich zu "Depublizieren"
- [ ] `/admin/landing-page` → Redirect nach `/admin/branding`
- [ ] Mobile: Tab-Navigation in der Branding Page weiterhin funktionstüchtig
