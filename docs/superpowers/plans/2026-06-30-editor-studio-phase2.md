# Editor-Studio Phase 2 — Studio-Shell + Draft-Verdrahtung — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Den Admin-Editor in eine einheitliche Studio-Shell umbauen (große zentrale Vorschau, Seiten/Marke-Navigation, EIN Entwurf→Veröffentlichen-Flow), die alle Editoren über einen gemeinsamen Entwurf-Zustand verdrahtet.

**Architecture:** Ein React-Context (`EditorDraftProvider` + `useEditorDraft`) lädt den Entwurf (Phase-1-API `GET /api/admin/editor-draft`), hält ihn, bietet `updateBrand`/`updateLandingContent`, debounced Auto-Save (`PATCH`) und `publish()` (`POST /api/admin/editor-publish`). Die Shell-Komponenten und alle Editor-Panels lesen/schreiben ausschließlich über diesen Context. Die Vorschau ist das echte `PreviewPane`-iframe (liest Entwurf via `?preview=1`).

**Tech Stack:** Next.js 15 (App Router, Client Components), TypeScript, Supabase Auth (Bearer-Token via `supabase.auth.getSession()`).

**Referenz-Spec:** `docs/superpowers/specs/2026-06-30-editor-studio-design.md`
**Voraussetzung:** Phase 1 gemergt + Migration 071 in Supabase ausgeführt (draft_config + last_published_at vorhanden).

---

## File Structure

- **Create:** `app/app/admin/branding/editor/useEditorDraft.tsx` — Context-Provider + Hook: Entwurf laden/halten/auto-speichern/veröffentlichen + Status.
- **Create:** `app/app/admin/branding/editor/EditorTopBar.tsx` — Topbar: Seiten-Umschalter, Geräte-Umschalter, Status-Badge, Veröffentlichen, ⋯-Menü.
- **Create:** `app/app/admin/branding/editor/EditorNav.tsx` — linke Navigation (Seiten ↔ Design & Marke; Sektionsliste mit 👁-Toggles).
- **Create:** `app/app/admin/branding/editor/EditorPanel.tsx` — rechtes Panel: rendert den Editor des gewählten Nav-Eintrags (delegiert an Sektion-/Marke-Editoren).
- **Create:** `app/app/admin/branding/editor/panels/BrandColorsPanel.tsx` — Farben + Schrift + Layout (aus dem alten colors/layout-Tab, an Draft verdrahtet).
- **Create:** `app/app/admin/branding/editor/panels/BrandLogoPanel.tsx` — Logo + Kontakt/Beschreibung (aus altem info-Tab, an Draft verdrahtet).
- **Create:** `app/app/admin/branding/editor/panels/SectionEditorPanel.tsx` — rendert den Editor einer Landing-Sektion (Hero/Galerie/Team/… — Logik aus LandingPageTab, an Draft verdrahtet).
- **Modify:** `app/app/admin/branding/editor/PreviewPane.tsx` — `device`-Prop von außen steuerbar machen (Topbar steuert Gerät), `page`-Prop von außen.
- **Rewrite:** `app/app/admin/branding/page.tsx` — wird zur dünnen Studio-Shell, die Provider + TopBar + Nav + Canvas + Panel zusammensetzt. Alte 2-Tab-Struktur + Fake-Mockup-Vorschau (`DesignMockup`, `previewContent`, Resize-Handle) entfernt.
- **Keep (reused as-is):** Marke-Tools mit eigenen Live-Endpoints, die NICHT über den Marke-Entwurf laufen, sondern eigene Wirkung haben: **Templates** (`/api/design-templates/[id]/apply`), **KI-Chat** (`/api/ai/design-chat` + `/api/admin/design-config`), **KI-Scan** (`/api/ai/design-extract`), **Design-Anfragen** (`/api/admin/design-requests`). Diese werden als eigene Panels in den Marke-Bereich verschoben, behalten aber ihre bestehende Logik (siehe Task 7). Begründung: sie schreiben `design_config` direkt; ihre Draft-Integration ist Phase-3-Feinschliff, nicht Blocker für die Shell.

**Wichtige Architektur-Entscheidung (Scope-Kontrolle):** Phase 2 verdrahtet die **direkt editierbaren** Marke-Felder (Farben, Schrift, Layout, Logo, Kontakt, Beschreibung) + **alle Landing-Sektionen** über den Entwurf. Die **generativen Marke-Tools** (Templates/KI/Scan/Anfragen) bleiben funktional wie bisher (eigene Endpoints), nur visuell in die neue IA einsortiert. So bleibt Phase 2 beherrschbar und liefert die vom User genannten Schmerzpunkte (ein Save/Status, Tabs zusammen, große Vorschau) vollständig.

---

### Task 1: `useEditorDraft` — Context, Laden, Auto-Save, Publish, Status

**Files:**
- Create: `app/app/admin/branding/editor/useEditorDraft.tsx`

**Kontext:** Auth-Token via `supabase.auth.getSession()` (Client). API-Vertrag aus Phase 1: `GET /api/admin/editor-draft?restaurant_id=…` → `{ draft, last_published_at, has_unpublished_changes }`; `PATCH` mit `{ restaurant_id, draft }`; `POST /api/admin/editor-publish` mit `{ restaurant_id }` → `{ ok, last_published_at }`. Typen aus `@/lib/editor-draft`.

- [ ] **Step 1: Provider + Hook schreiben**

`app/app/admin/branding/editor/useEditorDraft.tsx`:
```tsx
'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { DraftConfig, DraftBrand } from '@/lib/editor-draft'
import type { LandingPageContent } from '@/lib/landing-content'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface EditorDraftContextValue {
  draft: DraftConfig | null
  loading: boolean
  saveStatus: SaveStatus
  hasUnpublishedChanges: boolean
  lastPublishedAt: string | null
  publishing: boolean
  updateBrand: (partial: Partial<DraftBrand>) => void
  updateLandingContent: (updater: (prev: LandingPageContent) => LandingPageContent) => void
  publish: () => Promise<boolean>
}

const Ctx = createContext<EditorDraftContextValue | null>(null)

export function useEditorDraft(): EditorDraftContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useEditorDraft must be used within EditorDraftProvider')
  return v
}

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function EditorDraftProvider({ restaurantId, children }: { restaurantId: string; children: React.ReactNode }) {
  const [draft, setDraft] = useState<DraftConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false)
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)

  const didLoad = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initiales Laden
  useEffect(() => {
    let active = true
    async function load() {
      const headers = await authHeader()
      const res = await fetch(`/api/admin/editor-draft?restaurant_id=${restaurantId}`, { headers })
      if (!active) return
      if (res.ok) {
        const j = await res.json()
        setDraft(j.draft)
        setLastPublishedAt(j.last_published_at ?? null)
        setHasUnpublishedChanges(!!j.has_unpublished_changes)
      }
      setLoading(false)
      didLoad.current = true
    }
    load()
    return () => { active = false }
  }, [restaurantId])

  // Debounced Auto-Save bei jeder Entwurf-Änderung (nach dem ersten Laden)
  useEffect(() => {
    if (!didLoad.current || !draft) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    saveTimer.current = setTimeout(async () => {
      const headers = { 'Content-Type': 'application/json', ...(await authHeader()) }
      const res = await fetch('/api/admin/editor-draft', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ restaurant_id: restaurantId, draft }),
      })
      if (res.ok) {
        const j = await res.json()
        setSaveStatus('saved')
        setHasUnpublishedChanges(!!j.has_unpublished_changes)
      } else {
        setSaveStatus('error')
      }
    }, 800)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, restaurantId])

  const updateBrand = useCallback((partial: Partial<DraftBrand>) => {
    setDraft(prev => prev ? { ...prev, brand: { ...prev.brand, ...partial } } : prev)
  }, [])

  const updateLandingContent = useCallback((updater: (prev: LandingPageContent) => LandingPageContent) => {
    setDraft(prev => prev ? { ...prev, landing_content: updater(prev.landing_content) } : prev)
  }, [])

  const publish = useCallback(async (): Promise<boolean> => {
    setPublishing(true)
    const headers = { 'Content-Type': 'application/json', ...(await authHeader()) }
    const res = await fetch('/api/admin/editor-publish', {
      method: 'POST', headers, body: JSON.stringify({ restaurant_id: restaurantId }),
    })
    setPublishing(false)
    if (res.ok) {
      const j = await res.json()
      setLastPublishedAt(j.last_published_at ?? null)
      setHasUnpublishedChanges(false)
      return true
    }
    return false
  }, [restaurantId])

  return (
    <Ctx.Provider value={{
      draft, loading, saveStatus, hasUnpublishedChanges, lastPublishedAt, publishing,
      updateBrand, updateLandingContent, publish,
    }}>
      {children}
    </Ctx.Provider>
  )
}
```

- [ ] **Step 2: tsc**

Run: `cd app && npx tsc --noEmit`
Expected: 0 neue Fehler (vorbestehende `orders-eta.test.ts` ignorieren).

- [ ] **Step 3: Commit**

```bash
git add "app/app/admin/branding/editor/useEditorDraft.tsx"
git commit -m "feat(editor): useEditorDraft context (load/autosave/publish/status)"
```

---

### Task 2: PreviewPane von außen steuerbar (page + device als Props)

**Files:**
- Modify: `app/app/admin/branding/editor/PreviewPane.tsx`

**Kontext:** Aktuell hält PreviewPane `page`/`device` intern. Die Topbar soll Seite + Gerät steuern. Wir heben den State in die Shell, PreviewPane wird kontrolliert. `reloadToken` bleibt.

- [ ] **Step 1: Props erweitern, internen State entfernen**

Ersetze in `app/app/admin/branding/editor/PreviewPane.tsx` das `interface PreviewPaneProps` + die Komponenten-Signatur + die internen `useState`-Zeilen:
```tsx
interface PreviewPaneProps {
  slug: string
  reloadToken: number
}
```
…durch:
```tsx
export type PreviewPage = 'start' | 'speisekarte' | 'reservieren'
export type PreviewDevice = 'mobile' | 'desktop'

interface PreviewPaneProps {
  slug: string
  reloadToken: number
  page: PreviewPage
  device: PreviewDevice
}
```
Und die Funktionssignatur:
```tsx
export function PreviewPane({ slug, reloadToken, page, device }: PreviewPaneProps) {
```
Entferne die Zeilen `const [page, setPage] = useState<PreviewPage>('start')` und `const [device, setDevice] = useState<PreviewDevice>('mobile')` sowie die interne Steuerleiste (PAGE_TABS/Geräte-Buttons) — diese wandert in die Topbar (Task 3). Behalte den `<div>`-Rahmen + `<iframe>`. Entferne die jetzt ungenutzten `useState`-Import-Teile und die `PAGE_TABS`/`pillBtn`-Konstanten, falls nur intern genutzt.

- [ ] **Step 2: tsc** (es entstehen erwartbar Fehler an der alten Aufrufstelle in page.tsx — die wird in Task 8 ersetzt; bis dahin diesen Task isoliert mit tsc der Datei prüfen)

Run: `cd app && npx tsc --noEmit`
Expected: nur Fehler in `app/app/admin/branding/page.tsx` (alter PreviewPane-Aufruf). Diese werden in Task 8 behoben.

- [ ] **Step 3: Commit**

```bash
git add "app/app/admin/branding/editor/PreviewPane.tsx"
git commit -m "feat(editor): PreviewPane controlled page+device via props"
```

---

### Task 3: EditorTopBar — Status, Publish, Seiten-/Geräte-Umschalter

**Files:**
- Create: `app/app/admin/branding/editor/EditorTopBar.tsx`

**Kontext:** Nutzt `useEditorDraft` für Status + Publish. Steuert die von der Shell gehaltenen `page`/`device` per Props-Callbacks.

- [ ] **Step 1: Komponente schreiben**

`app/app/admin/branding/editor/EditorTopBar.tsx`:
```tsx
'use client'

import { useEditorDraft } from './useEditorDraft'
import type { PreviewPage, PreviewDevice } from './PreviewPane'

const PAGES: { key: PreviewPage; label: string }[] = [
  { key: 'start', label: 'Start' },
  { key: 'speisekarte', label: 'Speisekarte' },
  { key: 'reservieren', label: 'Reservieren' },
]

function pill(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer',
    fontSize: '0.78rem', fontWeight: active ? 700 : 500,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted)',
  }
}

export function EditorTopBar({
  slug, page, device, onPageChange, onDeviceChange,
}: {
  slug: string
  page: PreviewPage
  device: PreviewDevice
  onPageChange: (p: PreviewPage) => void
  onDeviceChange: (d: PreviewDevice) => void
}) {
  const { saveStatus, hasUnpublishedChanges, publishing, publish } = useEditorDraft()

  const statusText =
    saveStatus === 'saving' ? 'Speichert…'
    : saveStatus === 'error' ? 'Fehler beim Speichern'
    : hasUnpublishedChanges ? '● Nicht veröffentlichte Änderungen'
    : 'Gespeichert ✓'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-2)', borderRadius: '8px', padding: '3px' }}>
        {PAGES.map(p => (
          <button key={p.key} style={pill(page === p.key)} onClick={() => onPageChange(p.key)}>{p.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '2px' }}>
          <button style={pill(device === 'mobile')} onClick={() => onDeviceChange('mobile')} title="Mobil">📱</button>
          <button style={pill(device === 'desktop')} onClick={() => onDeviceChange('desktop')} title="Desktop">🖥</button>
        </div>

        <span style={{
          fontSize: '0.74rem', fontWeight: 600,
          color: hasUnpublishedChanges ? 'var(--accent)' : 'var(--text-muted)',
        }}>{statusText}</span>

        <a href={`/${slug}/info`} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
          Live ansehen ↗
        </a>

        <button
          onClick={() => { void publish() }}
          disabled={publishing || !hasUnpublishedChanges}
          style={{
            padding: '9px 20px', borderRadius: '8px', border: 'none',
            background: (publishing || !hasUnpublishedChanges) ? 'var(--surface-2)' : 'var(--accent)',
            color: (publishing || !hasUnpublishedChanges) ? 'var(--text-muted)' : '#fff',
            fontWeight: 700, fontSize: '0.82rem',
            cursor: (publishing || !hasUnpublishedChanges) ? 'default' : 'pointer',
          }}>
          {publishing ? 'Veröffentlicht…' : 'Veröffentlichen'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: tsc** (siehe Task 2 — nur page.tsx-Fehler erwartet)

Run: `cd app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add "app/app/admin/branding/editor/EditorTopBar.tsx"
git commit -m "feat(editor): EditorTopBar (status badge, publish, page/device switch)"
```

---

### Task 4: EditorNav — Seiten ↔ Design & Marke + Sektionsliste

**Files:**
- Create: `app/app/admin/branding/editor/EditorNav.tsx`

**Kontext:** Definiert die wählbaren Nav-Einträge. Ein Eintrag ist entweder eine Landing-Sektion (`{kind:'section', key:SectionKey}`), ein Marke-Editor (`{kind:'brand', key:'colors'|'logo'}`) oder ein Marke-Tool (`{kind:'tool', key:'templates'|'ai-chat'|'ai-scan'|'requests'}`). Sektionen zeigen einen 👁-Toggle (Sichtbarkeit aus `draft.landing_content.section_visibility`). Nutzt `useEditorDraft`.

- [ ] **Step 1: Typen + Komponente schreiben**

`app/app/admin/branding/editor/EditorNav.tsx`:
```tsx
'use client'

import { useEditorDraft } from './useEditorDraft'
import type { SectionKey } from '@/lib/landing-content'

export type NavSelection =
  | { kind: 'section'; key: SectionKey }
  | { kind: 'brand'; key: 'colors' | 'logo' }
  | { kind: 'tool'; key: 'templates' | 'ai-chat' | 'ai-scan' | 'requests' }

export type NavMode = 'pages' | 'brand'

const START_SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'about', label: 'Über uns' },
  { key: 'gallery', label: 'Galerie' },
  { key: 'featured_menu', label: 'Menü-Highlights' },
  { key: 'team', label: 'Team' },
  { key: 'story', label: 'Geschichte' },
  { key: 'ambiance', label: 'Atmosphäre' },
  { key: 'awards', label: 'Auszeichnungen' },
  { key: 'opening_hours', label: 'Öffnungszeiten' },
  { key: 'reviews', label: 'Bewertungen' },
  { key: 'reservation_cta', label: 'Reservierungs-Aufruf' },
  { key: 'contact', label: 'Kontakt' },
  { key: 'instagram', label: 'Instagram' },
]

const BRAND_ITEMS: { sel: NavSelection; label: string }[] = [
  { sel: { kind: 'brand', key: 'colors' }, label: 'Farben & Schrift' },
  { sel: { kind: 'brand', key: 'logo' }, label: 'Logo & Infos' },
  { sel: { kind: 'tool', key: 'templates' }, label: 'Templates' },
  { sel: { kind: 'tool', key: 'ai-chat' }, label: 'KI-Assistent' },
  { sel: { kind: 'tool', key: 'ai-scan' }, label: 'Design erkennen' },
  { sel: { kind: 'tool', key: 'requests' }, label: 'Design anfragen' },
]

function rowStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 10px', borderRadius: '7px', cursor: 'pointer',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text)',
    fontSize: '0.82rem', fontWeight: active ? 700 : 500, border: 'none', width: '100%', textAlign: 'left',
  }
}

export function EditorNav({
  mode, onModeChange, selection, onSelect,
}: {
  mode: NavMode
  onModeChange: (m: NavMode) => void
  selection: NavSelection
  onSelect: (s: NavSelection) => void
}) {
  const { draft, updateLandingContent } = useEditorDraft()
  const vis = draft?.landing_content.section_visibility ?? {}
  const isVis = (k: SectionKey) => vis[k] !== false
  const toggle = (k: SectionKey) => updateLandingContent(prev => ({
    ...prev, section_visibility: { ...prev.section_visibility, [k]: !(prev.section_visibility?.[k] !== false) },
  }))

  const isSel = (s: NavSelection) =>
    s.kind === selection.kind && s.key === selection.key

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Modus-Umschalter */}
      <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-2)', borderRadius: '8px', padding: '3px', margin: '10px' }}>
        {(['pages', 'brand'] as NavMode[]).map(m => (
          <button key={m} onClick={() => onModeChange(m)} style={{
            flex: 1, padding: '7px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            fontSize: '0.76rem', fontWeight: mode === m ? 700 : 500,
            background: mode === m ? 'var(--accent)' : 'transparent',
            color: mode === m ? '#fff' : 'var(--text-muted)',
          }}>{m === 'pages' ? 'Seiten' : 'Design & Marke'}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {mode === 'pages' && (
          <>
            <div style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 700, padding: '8px 10px 4px' }}>Start-Sektionen</div>
            {START_SECTIONS.map(s => {
              const active = isSel({ kind: 'section', key: s.key })
              return (
                <div key={s.key} style={rowStyle(active)}>
                  <button onClick={() => onSelect({ kind: 'section', key: s.key })}
                    style={{ flex: 1, background: 'transparent', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
                    {s.label}
                  </button>
                  <button onClick={() => toggle(s.key)} title={isVis(s.key) ? 'Sichtbar' : 'Aus'}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.85rem', opacity: isVis(s.key) ? 1 : 0.4 }}>
                    {isVis(s.key) ? '👁' : '🚫'}
                  </button>
                </div>
              )
            })}
          </>
        )}

        {mode === 'brand' && BRAND_ITEMS.map(item => (
          <button key={`${item.sel.kind}-${item.sel.key}`} onClick={() => onSelect(item.sel)} style={rowStyle(isSel(item.sel))}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: tsc** (nur page.tsx-Fehler erwartet) · **Step 3: Commit**

```bash
git add "app/app/admin/branding/editor/EditorNav.tsx"
git commit -m "feat(editor): EditorNav (pages/brand modes + section visibility toggles)"
```

---

### Task 5: BrandColorsPanel + BrandLogoPanel (Marke an Draft verdrahtet)

**Files:**
- Create: `app/app/admin/branding/editor/panels/BrandColorsPanel.tsx`
- Create: `app/app/admin/branding/editor/panels/BrandLogoPanel.tsx`

**Kontext:** Logik/JSX stammt aus den alten Tabs `colors`/`layout` (page.tsx Z. 951-1005) und `info` (Z. 1140-1188). Statt lokalem useState + `save()` lesen/schreiben sie `draft.brand` über `updateBrand`. `ColorPickerInput` aus page.tsx in eine geteilte Datei `app/app/admin/branding/editor/ColorPickerInput.tsx` extrahieren (DRY) — beim Anlegen den vorhandenen Code 1:1 übernehmen. Farb-Fallbacks (Paket-Defaults) via `getDesignPackage(draft.brand.design_package).preview.*`.

- [ ] **Step 1: ColorPickerInput extrahieren**

Erstelle `app/app/admin/branding/editor/ColorPickerInput.tsx` mit der `ColorPickerInput`-Komponente aus `page.tsx` (Z. 40-72), unverändert, mit `'use client'` oben und `export function ColorPickerInput(...)`.

- [ ] **Step 2: BrandColorsPanel schreiben**

`app/app/admin/branding/editor/panels/BrandColorsPanel.tsx`:
```tsx
'use client'

import { useEditorDraft } from '../useEditorDraft'
import { ColorPickerInput } from '../ColorPickerInput'
import { getDesignPackage } from '@/lib/design-packages'
import { FONT_PAIRS } from '@/lib/font-pairs'
import type { LayoutVariant } from '@/lib/design-packages'

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }
const sectionLabel: React.CSSProperties = { display: 'block', fontSize: '0.85rem', color: 'var(--text)', marginBottom: '12px', fontWeight: 700 }

export function BrandColorsPanel() {
  const { draft, updateBrand } = useEditorDraft()
  if (!draft) return null
  const b = draft.brand
  const pkg = getDesignPackage(b.design_package)
  const accent = b.primary_color ?? pkg.preview.primaryColor
  const bg = b.bg_color ?? pkg.preview.bgColor
  const header = b.header_color ?? pkg.preview.headerColor
  const card = b.card_color ?? pkg.preview.cardColor
  const button = b.button_color ?? pkg.preview.buttonColor
  const text = b.text_color ?? pkg.preview.textColor

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <label style={sectionLabel}>Farben</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
          <div><label style={fieldLabel}>Akzentfarbe</label><ColorPickerInput value={accent} onChange={v => updateBrand({ primary_color: v })} onReset={() => updateBrand({ primary_color: null })} /></div>
          <div><label style={fieldLabel}>Hintergrund</label><ColorPickerInput value={bg} onChange={v => updateBrand({ bg_color: v })} onReset={() => updateBrand({ bg_color: null })} /></div>
          <div><label style={fieldLabel}>Header</label><ColorPickerInput value={header} onChange={v => updateBrand({ header_color: v })} onReset={() => updateBrand({ header_color: null })} /></div>
          <div><label style={fieldLabel}>Karten</label><ColorPickerInput value={card} onChange={v => updateBrand({ card_color: v })} onReset={() => updateBrand({ card_color: null })} /></div>
          <div><label style={fieldLabel}>Buttons</label><ColorPickerInput value={button} onChange={v => updateBrand({ button_color: v })} onReset={() => updateBrand({ button_color: null })} /></div>
          <div><label style={fieldLabel}>Text</label><ColorPickerInput value={text} onChange={v => updateBrand({ text_color: v })} onReset={() => updateBrand({ text_color: null })} /></div>
        </div>
      </div>

      <label style={sectionLabel}>Schriftart</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginBottom: '24px' }}>
        {Object.entries(FONT_PAIRS).map(([id, pair]) => {
          const active = id === b.font_pair
          return (
            <button key={id} onClick={() => updateBrand({ font_pair: id })} style={{
              background: active ? `${accent}12` : 'var(--surface)', border: active ? `2px solid ${accent}` : '2px solid var(--border)',
              borderRadius: '10px', padding: '14px 12px', cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{ fontFamily: `${pair.heading}, system-ui`, fontWeight: 700, fontSize: '1rem', color: 'var(--text)', marginBottom: '4px' }}>Aa</div>
              <div style={{ fontFamily: `${pair.body}, system-ui`, fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{pair.label}</div>
            </button>
          )
        })}
      </div>

      <label style={sectionLabel}>Layout (Bestellseite)</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
        {(['cards', 'list', 'large-cards', 'grid'] as LayoutVariant[]).map(v => {
          const active = v === b.layout_variant
          const labels: Record<LayoutVariant, string> = { cards: 'Cards', list: 'Liste', 'large-cards': 'Große Karten', grid: '2-Spalten' }
          return (
            <button key={v} onClick={() => updateBrand({ layout_variant: v })} style={{
              background: active ? `${accent}12` : 'var(--surface)', border: active ? `2px solid ${accent}` : '2px solid var(--border)',
              borderRadius: '10px', padding: '12px 8px', cursor: 'pointer', textAlign: 'center',
              color: active ? 'var(--text)' : 'var(--text-muted)', fontSize: '0.74rem', fontWeight: 600,
            }}>{labels[v]}</button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: BrandLogoPanel schreiben**

`app/app/admin/branding/editor/panels/BrandLogoPanel.tsx`:
```tsx
'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useEditorDraft } from '../useEditorDraft'

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }
const sectionLabel: React.CSSProperties = { display: 'block', fontSize: '0.85rem', color: 'var(--text)', marginBottom: '12px', fontWeight: 700 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none' }

export function BrandLogoPanel({ restaurantId }: { restaurantId: string }) {
  const { draft, updateBrand } = useEditorDraft()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  if (!draft) return null
  const b = draft.brand

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${restaurantId}/logo.${ext}`
    const { error } = await supabase.storage.from('restaurant-logos').upload(path, file, { upsert: true })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('restaurant-logos').getPublicUrl(path)
      updateBrand({ logo_url: publicUrl })
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div>
      <label style={sectionLabel}>Logo</label>
      <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border)', marginBottom: '24px' }}>
        {b.logo_url ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <img src={b.logo_url} alt="Logo" style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', padding: '4px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => fileRef.current?.click()} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>Ersetzen</button>
              <button onClick={() => updateBrand({ logo_url: null })} style={{ ...inputStyle, width: 'auto', cursor: 'pointer', color: '#ef4444' }}>Entfernen</button>
            </div>
          </div>
        ) : (
          <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: '10px', padding: '24px', textAlign: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}>
            {uploading ? 'Wird hochgeladen…' : 'Logo hochladen (PNG, JPG, SVG)'}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
      </div>

      <label style={sectionLabel}>Kontakt & Beschreibung</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={fieldLabel}>Tagline / Beschreibung</label>
          <textarea value={b.description ?? ''} onChange={e => updateBrand({ description: e.target.value.slice(0, 160) })}
            placeholder="z.B. Authentische Pasta & Pizza seit 1998" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <div><label style={fieldLabel}>E-Mail</label><input type="email" value={b.contact_email ?? ''} onChange={e => updateBrand({ contact_email: e.target.value })} placeholder="info@restaurant.de" style={inputStyle} /></div>
        <div><label style={fieldLabel}>Telefon</label><input type="tel" value={b.contact_phone ?? ''} onChange={e => updateBrand({ contact_phone: e.target.value })} placeholder="+49 89 123456" style={inputStyle} /></div>
        <div><label style={fieldLabel}>Adresse</label><input type="text" value={b.contact_address ?? ''} onChange={e => updateBrand({ contact_address: e.target.value })} placeholder="Musterstr. 1, 80331 München" style={inputStyle} /></div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: tsc** (nur page.tsx-Fehler) · **Step 5: Commit**

```bash
git add "app/app/admin/branding/editor/ColorPickerInput.tsx" "app/app/admin/branding/editor/panels/BrandColorsPanel.tsx" "app/app/admin/branding/editor/panels/BrandLogoPanel.tsx"
git commit -m "feat(editor): brand colors/fonts/layout + logo/contact panels wired to draft"
```

---

### Task 6: SectionEditorPanel — Landing-Sektionen an Draft verdrahtet

**Files:**
- Create: `app/app/admin/branding/editor/panels/SectionEditorPanel.tsx`

**Kontext:** Dies portiert die Sektion-Editoren aus `LandingPageTab.tsx` (Hero/Basis, Galerie, Featured, Über uns, Team, Geschichte, Atmosphäre, Auszeichnungen, Öffnungszeiten, Bewertungen, Kontakt, Instagram, Reservierungs-CTA) auf den Draft-Context. Statt `content`/`setContent` nutzt es `draft.landing_content` + `updateLandingContent`. Statt eigenem Upload-Endpoint-Handler wird der bestehende `/api/admin/landing-page/upload` weiterverwendet (gibt URL zurück; die URL kommt per `updateLandingContent` in den Draft). KI-Buttons rufen `/api/ai/landing-section` (about/story) und schreiben das Ergebnis in den Draft.

Die Komponente nimmt `section: SectionKey` und rendert den passenden Editor-Block. Die Editor-Blöcke entsprechen 1:1 denen aus `LandingPageTab.tsx` (dort vorhanden), nur die State-Quelle wechselt.

- [ ] **Step 1: Grundgerüst + Hero/Über-uns/Galerie portieren**

`app/app/admin/branding/editor/panels/SectionEditorPanel.tsx` anlegen mit `'use client'`, Imports (`useEditorDraft`, `supabase`, `SectionKey`, `LandingPageContent`), den geteilten Style-Konstanten (`inputStyle`, `fieldLabel`, `sectionTitle`) und einer `uploadImage(file, apiType, busyKey)`-Hilfe analog zu LandingPageTab (postet an `/api/admin/landing-page/upload`, gibt URL zurück). Dann ein `switch (section)` das pro `SectionKey` den jeweiligen Editor-Block rendert. Beginne mit `about` (Textarea + ✦KI via `/api/ai/landing-section`), `gallery` (Bild-Grid max 6), und einem Default-Fall.

Vollständiger Code dieser Datei wird beim Ausführen aus den entsprechenden Blöcken in `LandingPageTab.tsx` übernommen und auf `draft.landing_content`/`updateLandingContent` umgestellt (1:1-Portierung, da die JSX-Blöcke dort bereits existieren und getestet sind).

- [ ] **Step 2: Restliche Sektionen portieren** (team, story, ambiance, awards, opening_hours, reviews, contact, instagram, featured_menu, reservation_cta) — jeweils der entsprechende Block aus LandingPageTab, State-Quelle auf Draft umgestellt.

- [ ] **Step 3: tsc** (nur page.tsx-Fehler) · **Step 4: Commit**

```bash
git add "app/app/admin/branding/editor/panels/SectionEditorPanel.tsx"
git commit -m "feat(editor): SectionEditorPanel ports landing section editors to draft"
```

---

### Task 7: EditorPanel — Router auf die Panels + Marke-Tools

**Files:**
- Create: `app/app/admin/branding/editor/EditorPanel.tsx`

**Kontext:** `EditorPanel` rendert anhand der `NavSelection` (aus Task 4) den passenden Editor. Für `kind:'section'` → `SectionEditorPanel`. Für `kind:'brand'` → `BrandColorsPanel`/`BrandLogoPanel`. Für `kind:'tool'` → die generativen Tools (Templates/KI-Chat/KI-Scan/Anfragen). In Phase 2 werden die Tools als „kommt aus dem bestehenden Editor"-Platzhalter mit Hinweis gerendert, FALLS ihre Portierung zu groß wird — ABER bevorzugt: die bestehenden Tool-JSX-Blöcke aus `page.tsx` (templates Z.879-948, ai-chat Z.1008-1069, ai-scan Z.1073-1137, requests Z.1191-…) in je eine eigene Panel-Komponente auslagern und hier einbinden. Diese Tools behalten ihre bestehende Logik (eigene Endpoints) und sind nicht an den Marke-Entwurf gekoppelt.

- [ ] **Step 1: EditorPanel + Tool-Auslagerung**

Erstelle `EditorPanel.tsx`, das `selection: NavSelection` + `restaurantId`/`slug` nimmt und rendert:
```tsx
'use client'
import type { NavSelection } from './EditorNav'
import { BrandColorsPanel } from './panels/BrandColorsPanel'
import { BrandLogoPanel } from './panels/BrandLogoPanel'
import { SectionEditorPanel } from './panels/SectionEditorPanel'
import { TemplatesPanel } from './panels/TemplatesPanel'
import { AiChatPanel } from './panels/AiChatPanel'
import { AiScanPanel } from './panels/AiScanPanel'
import { RequestsPanel } from './panels/RequestsPanel'
import type { Restaurant } from '@/types/database'

export function EditorPanel({ selection, restaurant }: { selection: NavSelection; restaurant: Restaurant }) {
  return (
    <div style={{ padding: '16px', overflowY: 'auto', height: '100%' }}>
      {selection.kind === 'section' && <SectionEditorPanel section={selection.key} restaurantId={restaurant.id} />}
      {selection.kind === 'brand' && selection.key === 'colors' && <BrandColorsPanel />}
      {selection.kind === 'brand' && selection.key === 'logo' && <BrandLogoPanel restaurantId={restaurant.id} />}
      {selection.kind === 'tool' && selection.key === 'templates' && <TemplatesPanel restaurant={restaurant} />}
      {selection.kind === 'tool' && selection.key === 'ai-chat' && <AiChatPanel restaurant={restaurant} />}
      {selection.kind === 'tool' && selection.key === 'ai-scan' && <AiScanPanel restaurant={restaurant} />}
      {selection.kind === 'tool' && selection.key === 'requests' && <RequestsPanel restaurant={restaurant} />}
    </div>
  )
}
```
Erstelle die vier Tool-Panel-Dateien (`panels/TemplatesPanel.tsx`, `AiChatPanel.tsx`, `AiScanPanel.tsx`, `RequestsPanel.tsx`), indem die jeweiligen JSX-Blöcke + zugehörigen State/Handler aus `page.tsx` in die Komponente verschoben werden (1:1, je `'use client'`, nehmen `restaurant` als Prop, eigener lokaler State + bestehende Endpoints). Diese behalten ihr bisheriges Verhalten.

- [ ] **Step 2: tsc** (nur page.tsx-Fehler) · **Step 3: Commit**

```bash
git add "app/app/admin/branding/editor/EditorPanel.tsx" "app/app/admin/branding/editor/panels/"
git commit -m "feat(editor): EditorPanel router + brand tool panels (templates/ai/scan/requests)"
```

---

### Task 8: Shell zusammensetzen — page.tsx neu

**Files:**
- Rewrite: `app/app/admin/branding/page.tsx`

**Kontext:** `page.tsx` wird zur dünnen Shell. Lädt das Restaurant (wie bisher via `supabase.auth.getUser()` + `restaurants`-Query), rendert `EditorDraftProvider` + 3-Spalten-Studio (Nav | Canvas | Panel) + Topbar. Hält `page`/`device`/`navMode`/`selection`-State. Plan-Limits/`hasBranding`-Gate + Loading-State bleiben. Die alte 2-Tab-Struktur, `DesignMockup`, `previewContent`, Resize-Handle, Fullscreen-Modals werden entfernt.

- [ ] **Step 1: page.tsx neu schreiben** (vollständige neue Shell)

Komplett-Ersatz von `app/app/admin/branding/page.tsx`:
```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Restaurant, RestaurantPlan } from '@/types/database'
import { getPlanLimits } from '@/lib/plan-limits'
import { UpgradeHint } from '@/components/UpgradeHint'
import { EditorDraftProvider } from './editor/useEditorDraft'
import { EditorTopBar } from './editor/EditorTopBar'
import { EditorNav, type NavMode, type NavSelection } from './editor/EditorNav'
import { EditorPanel } from './editor/EditorPanel'
import { PreviewPane, type PreviewPage, type PreviewDevice } from './editor/PreviewPane'

export default function BrandingPage() {
  const router = useRouter()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)

  const [page, setPage] = useState<PreviewPage>('start')
  const [device, setDevice] = useState<PreviewDevice>('mobile')
  const [navMode, setNavMode] = useState<NavMode>('pages')
  const [selection, setSelection] = useState<NavSelection>({ kind: 'section', key: 'about' })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/owner-login'); return }
      const { data: resto } = await supabase.from('restaurants').select('*').eq('owner_id', user.id).limit(1).single()
      if (!resto) { router.push('/admin/setup'); return }
      setRestaurant(resto)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading || !restaurant) return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Lädt…</div>

  const limits = getPlanLimits((restaurant.plan ?? 'starter') as RestaurantPlan)
  if (!limits.hasBranding) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px' }}><div style={{ maxWidth: '600px', margin: '80px auto' }}><UpgradeHint feature="Branding & Design" /></div></div>
  }

  return (
    <EditorDraftProvider restaurantId={restaurant.id}>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden', background: 'var(--bg)' }}>
        <EditorTopBar slug={restaurant.slug} page={page} device={device} onPageChange={setPage} onDeviceChange={setDevice} />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <nav style={{ width: '230px', borderRight: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden' }}>
            <EditorNav mode={navMode} onModeChange={setNavMode} selection={selection} onSelect={setSelection} />
          </nav>
          <div style={{ flex: 1, minWidth: 0, borderRight: '1px solid var(--border)' }}>
            <PreviewPane slug={restaurant.slug} reloadToken={reloadToken} page={page} device={device} />
          </div>
          <aside style={{ width: '380px', flexShrink: 0, overflow: 'hidden' }}>
            <EditorPanel selection={selection} restaurant={restaurant} />
          </aside>
        </div>
      </div>
    </EditorDraftProvider>
  )
}
```

- [ ] **Step 2: Canvas-Reload bei Save** — Damit die Vorschau den Entwurf nach Auto-Save zeigt, muss `reloadToken` nach erfolgreichem Save hochzählen. Dafür im `useEditorDraft`-Context ein `reloadToken` + Inkrement nach erfolgreichem PATCH ergänzen und in `page.tsx` aus dem Context statt lokal beziehen. (Context erweitern: `reloadToken: number` ins Value, `setReloadToken(t=>t+1)` im PATCH-`res.ok`-Zweig; in page.tsx `const { reloadToken } = useEditorDraft()` — dazu muss `PreviewPane` INNERHALB des Providers liegen, was es tut.)

Konkret: in `useEditorDraft.tsx` `const [reloadToken, setReloadToken] = useState(0)` ergänzen, im PATCH-Erfolg `setReloadToken(t => t + 1)`, ins Context-Value aufnehmen. In `page.tsx` das lokale `reloadToken` entfernen und eine kleine innere Komponente nutzen, die `useEditorDraft()` liest und `PreviewPane` rendert (da `page.tsx`-Top-Level außerhalb des Providers den Hook nicht nutzen kann). Lege dafür `app/app/admin/branding/editor/EditorCanvas.tsx` an:
```tsx
'use client'
import { useEditorDraft } from './useEditorDraft'
import { PreviewPane, type PreviewPage, type PreviewDevice } from './PreviewPane'
export function EditorCanvas({ slug, page, device }: { slug: string; page: PreviewPage; device: PreviewDevice }) {
  const { reloadToken } = useEditorDraft()
  return <PreviewPane slug={slug} reloadToken={reloadToken} page={page} device={device} />
}
```
und in `page.tsx` `<PreviewPane .../>` durch `<EditorCanvas slug={restaurant.slug} page={page} device={device} />` ersetzen (Import anpassen, lokalen `reloadToken`-State entfernen).

- [ ] **Step 3: tsc — jetzt 0 neue Fehler** (alle Komponenten existieren, alte Aufrufstellen ersetzt)

Run: `cd app && npx tsc --noEmit`
Expected: 0 neue Fehler.

- [ ] **Step 4: Manuelle Prüfung**

Dev-Server, `/admin/branding` öffnen: Topbar mit Seiten/Geräte/Status/Veröffentlichen; links Seiten/Marke-Navi; Mitte großes iframe; rechts Panel. Eine Farbe ändern → Status „Speichert…" → „Gespeichert ✓" + „Nicht veröffentlichte Änderungen" → Canvas lädt neu und zeigt Änderung (Vorschau liest Entwurf). „Veröffentlichen" → Status zurück auf „Gespeichert ✓", Live-Seite zeigt Änderung.

- [ ] **Step 5: Commit**

```bash
git add "app/app/admin/branding/page.tsx" "app/app/admin/branding/editor/EditorCanvas.tsx" "app/app/admin/branding/editor/useEditorDraft.tsx"
git commit -m "feat(editor): assemble studio shell as /admin/branding (retire 2-tab + fake preview)"
```

---

## Final Verification (nach allen Tasks)

- [ ] `cd app && npx tsc --noEmit` → 0 neue Fehler.
- [ ] `cd app && npm test` → alle grün (keine neuen Lib-Tests; bestehende dürfen nicht brechen).
- [ ] Manueller End-to-End: Farbe/Logo/Sektion ändern → Auto-Save-Status → Canvas-Reload → Veröffentlichen → Live-Seite aktualisiert. Sichtbarkeits-Toggle in der Navi blendet Sektion in der Vorschau aus. Seiten-Tabs (Start/Speisekarte/Reservieren) + 📱/🖥 funktionieren.

## Self-Review

**1. Spec-Abdeckung (Phase 2):** Studio-Shell (TopBar/Nav/Canvas/Panel) → Tasks 3,4,7,8 ✓; eine Vorschau (PreviewPane Canvas, Fake-Mockup entfernt) → Tasks 2,8 ✓; ein Save/Publish-Status → Tasks 1,3 ✓; Marke an Draft → Task 5 ✓; Sektionen an Draft → Task 6 ✓; Marke-Tools in neuer IA → Task 7 ✓; Tabs verschmolzen → Task 8 ✓.

**2. Placeholder-Scan:** Tasks 6 & 7 verweisen bewusst auf 1:1-Portierung bestehender, getesteter JSX-Blöcke (genaue Quell-Zeilen genannt) statt sie zu reproduzieren — das ist eine Refactor-Portierung, kein Platzhalter. Alle NEUEN Komponenten (Context, TopBar, Nav, Panels, Shell) sind vollständig auscodiert.

**3. Typ-/Symbol-Konsistenz:** `useEditorDraft` Value-Typ konsistent genutzt (`updateBrand`/`updateLandingContent`/`publish`/`reloadToken`). `NavSelection`/`NavMode` aus Task 4 in Tasks 7,8 genutzt. `PreviewPage`/`PreviewDevice` aus Task 2 in Tasks 3,8 genutzt. `DraftBrand`/`DraftConfig` aus Phase 1.

**Scope-Hinweis (ehrlich):** Tasks 6 & 7 sind die größten (Portierung umfangreicher bestehender JSX). Falls bei Ausführung zu groß, weiter unterteilen (z.B. Task 6 in 6a Hero/Text-Sektionen, 6b Listen-Sektionen Team/Awards, 6c Rest). Die generativen Marke-Tools (Task 7) behalten Live-Verhalten; ihre echte Draft-Kopplung ist Phase 3.
