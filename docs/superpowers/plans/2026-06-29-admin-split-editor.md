# Admin Split-Editor (Teilprojekt 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Landing-Page-Editor (`LandingPageTab.tsx`) zu einem Split-Editor mit echter iframe-Live-Vorschau ausbauen: Auto-Save, Editoren für die 4 neuen Sektionen (Team/Geschichte/Atmosphäre/Auszeichnungen), Sichtbarkeits-Toggles pro Sektion, erweiterter Bild-Upload, Vorschau-Seitentabs + Geräte-Umschalter, ✨ KI-Buttons pro Feld.

**Architecture:** Die rechte Spalte rendert künftig einen `<PreviewPane>` (iframe der ECHTEN Gast-Seiten via `?preview=1`), nicht mehr die hand-gebaute `LpPreview`. Änderungen im linken Editor werden debounced auto-gespeichert; danach lädt der iframe neu (reloadToken). Bilder gehen über eine generische `uploadImage`-Hilfe an die (erweiterte) Upload-Route. Alle neuen Felder liegen im bestehenden `content`-JSON.

**Tech Stack:** Next.js 15 (App Router), TypeScript, React (Client-Component), Inline-Styles, Supabase, Anthropic (per bestehendem AI-Endpoint aus TP2).

---

## Kontext für den Implementierer (unbedingt lesen)

- **Datei im Zentrum:** `app/app/admin/branding/LandingPageTab.tsx` (824 Zeilen, `'use client'`). Sie hat bereits: State (`content`, `lpLayout`, `isPublished`, `uploading`, …), `load()`, `handleSave()`, `handleUpload(file, 'hero'|'logo'|'gallery')`, `handleGenerate()` (KI-Bundle), eine in-file `ImageDropzone`-Komponente (label/previewUrl/uploading/onFile/hint), eine in-file `LpPreview`-Komponente (wird ersetzt), Sub-Tabs (Designs/Inhalt/Farben/Layout/KI) und rechts eine 280px-Vorschau-Spalte mit `<LpPreview>`.
- **CSS-Variablen** im Admin: `--border, --surface, --surface-2, --text, --text-muted, --accent`. Inline-Styles nutzen diese (kein ColorSet hier).
- **Style-Helfer** in der Datei: `inputStyle`, `fieldLabel`, `sectionTitle`, `navItemStyle`, `brandInheritHint`.
- **Typen:** `LandingPageContent` (kanonisch, hat seit TP2 `team`, `story_text`, `story_image_url`, `founded_year`, `ambiance_gallery`, `awards`, `section_visibility`), `SectionKey` aus `@/lib/landing-content`. `TeamMember`/`Award` ebenda.
- **Save-Route** `PATCH /api/admin/landing-page` persistiert seit TP2 das ganze Content-Objekt (via `sanitizeLandingContent`) — neue Felder werden also korrekt gespeichert.
- **Upload-Route** `POST /api/admin/landing-page/upload` akzeptiert aktuell nur `hero|logo|gallery` (wird in Task 1 erweitert). Gibt `{ url }` zurück.
- **KI-Endpoint** (TP2): `POST /api/ai/landing-section` mit `{ restaurant_id, field: 'about'|'story' }` → `{ text }`; ohne API-Key 403 mit deutscher Meldung.
- **Öffentliche Info-Seite** `app/app/[slug]/info/page.tsx` ist Server-Component, ruft `notFound()` wenn `!is_published`. Für die Vorschau unveröffentlichter Entwürfe muss `?preview=1` diesen Check überbrücken (Task 2). Die Bestellseite hat keinen Published-Gate.
- **Test-Setup:** Vitest node-env, lib-only → kein Component-Test-Harness. Verifikation der UI/Routen per `tsc --noEmit` + manuelle Prüfung am laufenden Dev-Server (`http://localhost:3000`). Reine Logik in `lib/` (hier keine neue) per Vitest.
- **Befehle (aus `app/`):** `npx tsc --noEmit`, `npm test`.
- `.env.local` niemals lesen/schreiben. Kein `console.log` (bestehende `console.error` in Routen-Mustern sind ok).

---

## Dateienübersicht

- **Modify** `app/app/api/admin/landing-page/upload/route.ts` — neue Upload-Typen (story/ambiance/team/award).
- **Modify** `app/app/[slug]/info/page.tsx` — `?preview=1` überbrückt den Published-Gate.
- **Create** `app/app/admin/branding/editor/PreviewPane.tsx` — iframe-Vorschau mit Seitentabs + Geräte-Umschalter.
- **Modify** `app/app/admin/branding/LandingPageTab.tsx` — Kern-Umbau (Tasks 4–7): Vorschau-Swap + Auto-Save, Upload-Generalisierung + per-Feld-KI + Visibility-Helfer, neue Sektions-Editoren, Sichtbarkeits-Toggles.

---

### Task 1: Upload-Route um neue Bildtypen erweitern

**Files:**
- Modify: `app/app/api/admin/landing-page/upload/route.ts`

- [ ] **Step 1: Erlaubte Typen erweitern**

Ersetze:
```ts
const ALLOWED_UPLOAD_TYPES = ['hero', 'logo', 'gallery'] as const
```
mit:
```ts
const ALLOWED_UPLOAD_TYPES = ['hero', 'logo', 'gallery', 'story', 'ambiance', 'team', 'award'] as const
const MULTI_TYPES = new Set(['gallery', 'ambiance', 'team', 'award'])
```

- [ ] **Step 2: Fehlermeldung anpassen**

Ersetze:
```ts
    return NextResponse.json({ error: 'type muss "hero", "logo" oder "gallery" sein' }, { status: 400 })
```
mit:
```ts
    return NextResponse.json({ error: 'Ungültiger Upload-Typ' }, { status: 400 })
```

- [ ] **Step 3: Storage-Pfad für Mehrfach-Typen**

Ersetze:
```ts
  const storagePath = uploadType === 'gallery'
  ? `landing-pages/${restaurantId}/gallery/${timestamp}.${ext}`
  : `landing-pages/${restaurantId}/${uploadType}-${timestamp}.${ext}`
```
mit:
```ts
  const storagePath = MULTI_TYPES.has(uploadType)
    ? `landing-pages/${restaurantId}/${uploadType}/${timestamp}.${ext}`
    : `landing-pages/${restaurantId}/${uploadType}-${timestamp}.${ext}`
```

- [ ] **Step 4: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: 0 Fehler.

- [ ] **Step 5: Commit**
```bash
git add "app/app/api/admin/landing-page/upload/route.ts"
git commit -m "feat(admin): allow story/ambiance/team/award image uploads"
```

---

### Task 2: `?preview=1` überbrückt den Published-Gate

**Files:**
- Modify: `app/app/[slug]/info/page.tsx`

- [ ] **Step 1: searchParams in die Page-Signatur aufnehmen + Gate anpassen**

Ersetze:
```tsx
export default async function PublicLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const admin = createSupabaseAdmin()
```
mit:
```tsx
export default async function PublicLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const isPreview = sp.preview === '1'
  const admin = createSupabaseAdmin()
```

- [ ] **Step 2: Published-Check überbrücken**

Ersetze:
```tsx
  if (!lp || !(lp as LandingPageRow).is_published) notFound()
```
mit:
```tsx
  if (!lp || (!(lp as LandingPageRow).is_published && !isPreview)) notFound()
```

- [ ] **Step 3: Typecheck + manuelle Prüfung**

Run: `cd app && npx tsc --noEmit`
Expected: 0 Fehler.

Manuell: `http://localhost:3000/italiener/info?preview=1` lädt (HTTP 200). (Für ein veröffentlichtes Restaurant ohnehin; entscheidend ist, dass der Param nichts kaputt macht.)

- [ ] **Step 4: Commit**
```bash
git add "app/app/[slug]/info/page.tsx"
git commit -m "feat(landing): ?preview=1 bypasses publish gate for editor preview"
```

---

### Task 3: `PreviewPane` Komponente (iframe + Seitentabs + Geräte-Umschalter)

**Files:**
- Create: `app/app/admin/branding/editor/PreviewPane.tsx`

- [ ] **Step 1: Komponente schreiben**

Datei `app/app/admin/branding/editor/PreviewPane.tsx`:
```tsx
'use client'

import { useState } from 'react'

interface PreviewPaneProps {
  slug: string
  /** Bei jeder Änderung wird der iframe neu geladen. */
  reloadToken: number
}

type PreviewPage = 'start' | 'speisekarte' | 'reservieren'
type PreviewDevice = 'mobile' | 'desktop'

const PAGE_TABS: { key: PreviewPage; label: string }[] = [
  { key: 'start', label: 'Start' },
  { key: 'speisekarte', label: 'Speisekarte' },
  { key: 'reservieren', label: 'Reservieren' },
]

function buildSrc(slug: string, page: PreviewPage): string {
  switch (page) {
    case 'speisekarte': return `/bestellen/${slug}?preview=1`
    case 'reservieren': return `/bestellen/${slug}?tab=reserve&preview=1`
    case 'start':
    default: return `/${slug}/info?preview=1`
  }
}

const pillBtn = (active: boolean): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
  fontSize: '0.72rem', fontWeight: 700,
  background: active ? 'var(--accent)' : 'transparent',
  color: active ? '#fff' : 'var(--text-muted)',
})

export function PreviewPane({ slug, reloadToken }: PreviewPaneProps) {
  const [page, setPage] = useState<PreviewPage>('start')
  const [device, setDevice] = useState<PreviewDevice>('mobile')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Steuerleiste */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '2px' }}>
          {PAGE_TABS.map(t => (
            <button key={t.key} style={pillBtn(page === t.key)} onClick={() => setPage(t.key)}>{t.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          <button style={pillBtn(device === 'mobile')} onClick={() => setDevice('mobile')} title="Mobil">📱</button>
          <button style={pillBtn(device === 'desktop')} onClick={() => setDevice('desktop')} title="Desktop">🖥</button>
        </div>
      </div>
      {/* Rahmen */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--surface-2)', display: 'flex', justifyContent: 'center', padding: device === 'mobile' ? '12px' : '0' }}>
        <iframe
          key={`${page}-${reloadToken}`}
          src={buildSrc(slug, page)}
          title="Vorschau"
          style={{
            border: device === 'mobile' ? '1px solid var(--border)' : 'none',
            borderRadius: device === 'mobile' ? '12px' : '0',
            width: device === 'mobile' ? '390px' : '100%',
            maxWidth: '100%',
            height: '100%',
            minHeight: '600px',
            background: '#fff',
          }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: 0 Fehler.

- [ ] **Step 3: Commit**
```bash
git add "app/app/admin/branding/editor/PreviewPane.tsx"
git commit -m "feat(admin): add PreviewPane iframe component (page tabs + device toggle)"
```

---

### Task 4: Vorschau-Swap + Auto-Save + reloadToken in LandingPageTab

**Files:**
- Modify: `app/app/admin/branding/LandingPageTab.tsx`

- [ ] **Step 1: Imports ergänzen**

Nach der Zeile:
```tsx
import type { Restaurant } from '@/types/database'
```
einfügen:
```tsx
import type { SectionKey } from '@/lib/landing-content'
import { PreviewPane } from './editor/PreviewPane'
```

- [ ] **Step 2: State + Refs ergänzen**

Ersetze:
```tsx
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
```
mit:
```tsx
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [reloadToken, setReloadToken] = useState(0)
  const didLoad = useRef(false)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
```

- [ ] **Step 3: Nach dem Laden Auto-Save scharf schalten**

In `load()`, ersetze:
```tsx
      const c = lp.content ?? {}
      setLpLayout(c.lp_layout ?? 'classic-hero')
      setContent(c)
    }
    load()
  }, [restaurant])
```
mit:
```tsx
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
  }, [content, lpLayout])
```

- [ ] **Step 4: Nach erfolgreichem Speichern den iframe neu laden**

In `handleSave`, ersetze:
```tsx
    const j = await res.json()
    setLandingPage(j.data)
    if (overrides?.is_published !== undefined) setIsPublished(overrides.is_published)
    setSaved(true); setTimeout(() => setSaved(false), 2500)
```
mit:
```tsx
    const j = await res.json()
    setLandingPage(j.data)
    if (overrides?.is_published !== undefined) setIsPublished(overrides.is_published)
    setReloadToken(t => t + 1)
    setSaved(true); setTimeout(() => setSaved(false), 2500)
```

- [ ] **Step 5: Rechte Spalte auf PreviewPane umstellen**

Ersetze den kompletten Block:
```tsx
      {/* Right preview */}
      <div style={{
        width: '280px', flexShrink: 0, borderLeft: '1px solid var(--border)',
        background: 'var(--surface-2)', padding: '16px', overflowY: 'auto', paddingTop: '60px',
      }}>
        <div style={{ ...fieldLabel, marginBottom: '8px' }}>Vorschau</div>
        {isPublished && (
          <div style={{ fontSize: '0.68rem', color: '#10b981', marginBottom: '8px', fontWeight: 600 }}>● Live</div>
        )}
        <LpPreview content={content} layout={lpLayout} />
      </div>
```
mit:
```tsx
      {/* Right preview — echte Live-Vorschau via iframe */}
      <div style={{
        width: '440px', flexShrink: 0, borderLeft: '1px solid var(--border)',
        background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', paddingTop: '52px',
      }}>
        <PreviewPane slug={restaurant.slug ?? ''} reloadToken={reloadToken} />
      </div>
```

- [ ] **Step 6: Ungenutzte `LpPreview`-Komponente entfernen**

Lösche die komplette `LpPreview`-Funktion (von der Kommentarzeile `// ─── LpPreview ─...` bis zur schließenden `}` der Funktion, direkt vor `// ─── Main Component ─...`). Das ist der Block, der mit
```tsx
// ─── LpPreview ────────────────────────────────────────────────────────────────
function LpPreview({ content, layout }: {
```
beginnt und mit
```tsx
    </div>
  )
}
```
endet (unmittelbar vor `// ─── Main Component ──`). `DAYS`, `ImageDropzone`, alle Style-Helfer und der Rest bleiben erhalten.

- [ ] **Step 7: Typecheck + manuelle Prüfung**

Run: `cd app && npx tsc --noEmit`
Expected: 0 Fehler (kein „LpPreview is defined but never used"; `LpPreview` ist entfernt).

Manuell: `http://localhost:3000/admin/branding` → Tab „Landing Page" → rechts erscheint der echte iframe (Seitentabs Start/Speisekarte/Reservieren + 📱/🖥). Eine Headline ändern → nach ~1s lädt der iframe neu und zeigt die Änderung.

- [ ] **Step 8: Commit**
```bash
git add "app/app/admin/branding/LandingPageTab.tsx"
git commit -m "feat(admin): live iframe preview + debounced autosave (replaces LpPreview)"
```

---

### Task 5: Upload-Generalisierung + per-Feld-KI + Sichtbarkeits-Helfer

**Files:**
- Modify: `app/app/admin/branding/LandingPageTab.tsx`

- [ ] **Step 1: `VisibilityToggle`-Komponente ergänzen**

Direkt VOR `// ─── Main Component ───...` (dort wo `LpPreview` entfernt wurde) einfügen:
```tsx
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
```

- [ ] **Step 2: Generische `uploadImage`-Hilfe + `handleUpload` darauf umstellen**

Ersetze die gesamte `handleUpload`-Funktion:
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
      let updatedContent: LandingPageContent
      if (type === 'gallery') {
        updatedContent = { ...content, gallery: [...(content.gallery ?? []), j.url].slice(0, 6) }
      } else if (type === 'hero') {
        updatedContent = { ...content, hero_image_url: j.url }
      } else {
        updatedContent = { ...content, logo_url: j.url }
      }
      setContent(updatedContent)
      await handleSave({ contentOverride: updatedContent })
    }
  }
```
mit:
```tsx
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
```

- [ ] **Step 3: per-Feld-KI-Handler + State ergänzen**

Direkt NACH der `handleGenerate`-Funktion (der bestehenden Bundle-KI, endet mit ihrer schließenden `}` vor `// ── Render ──`) einfügen:
```tsx

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
```

- [ ] **Step 4: Sichtbarkeits-Helfer ergänzen**

Direkt NACH dem `handleGenerateField`-Block (aus Step 3) einfügen:
```tsx

  const isVis = (key: SectionKey) => content.section_visibility?.[key] !== false
  const setVisible = (key: SectionKey, visible: boolean) =>
    setContent(prev => ({ ...prev, section_visibility: { ...prev.section_visibility, [key]: visible } }))
```

- [ ] **Step 5: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: 0 Fehler. (`VisibilityToggle`, `uploadImage`, `handleGenerateField`, `generatingField`, `isVis`, `setVisible` sind jetzt definiert — sie werden in Task 6/7 verwendet; ungenutzt zu sein ist für Funktionen/Variablen in einer `'use client'`-Komponente kein tsc-Fehler, aber Task 6/7 nutzen sie alle.)

- [ ] **Step 6: Commit**
```bash
git add "app/app/admin/branding/LandingPageTab.tsx"
git commit -m "feat(admin): generic uploadImage + per-field AI + visibility helpers"
```

---

### Task 6: Editoren für die 4 neuen Sektionen

**Files:**
- Modify: `app/app/admin/branding/LandingPageTab.tsx`

Fügt die Editor-Blöcke für Team, Geschichte, Atmosphäre und Auszeichnungen am Ende des „Inhalt"-Tabs ein (nach der Bewertungen-Sektion).

- [ ] **Step 1: Vier neue Sektions-Editoren einfügen**

Ersetze (das ist das Ende der Bewertungen-Sektion + Ende des Inhalt-Containers, eindeutig durch den folgenden FARBEN-Kommentar):
```tsx
              </div>
            </div>
          </div>
        )}

        {/* ── FARBEN TAB ── */}
```
mit:
```tsx
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
          </div>
        )}

        {/* ── FARBEN TAB ── */}
```

- [ ] **Step 2: Typecheck + manuelle Prüfung**

Run: `cd app && npx tsc --noEmit`
Expected: 0 Fehler.

Manuell: Im Admin „Landing Page" → Inhalt nach unten scrollen → Team/Geschichte/Atmosphäre/Auszeichnungen-Editoren erscheinen. Ein Team-Mitglied hinzufügen + Name/Rolle eintragen → nach ~1s erscheint es im rechten iframe (Sektion Team).

- [ ] **Step 3: Commit**
```bash
git add "app/app/admin/branding/LandingPageTab.tsx"
git commit -m "feat(admin): editors for Team/Story/Ambiance/Awards sections"
```

---

### Task 7: Sichtbarkeits-Toggles für bestehende Sektionen + KI-Button für „Über uns"

**Files:**
- Modify: `app/app/admin/branding/LandingPageTab.tsx`

- [ ] **Step 1: „Über uns" — KI-Button + Sichtbarkeits-Toggle**

Ersetze:
```tsx
            <div>
              <label style={fieldLabel}>Über uns <span style={{ opacity: 0.4 }}>(max. 500)</span></label>
              <textarea value={content.about_text ?? ''} maxLength={500} rows={4}
```
mit:
```tsx
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
```

- [ ] **Step 2: Kontakt-Header mit Toggle**

Ersetze:
```tsx
              <div style={sectionTitle}>Kontakt & Adresse</div>
```
mit:
```tsx
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ ...sectionTitle, marginBottom: 0 }}>Kontakt & Adresse</div>
                <VisibilityToggle visible={isVis('contact')} onChange={v => setVisible('contact', v)} />
              </div>
```

- [ ] **Step 3: Öffnungszeiten-Header mit Toggle**

Ersetze:
```tsx
              <div style={sectionTitle}>Öffnungszeiten</div>
```
mit:
```tsx
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ ...sectionTitle, marginBottom: 0 }}>Öffnungszeiten</div>
                <VisibilityToggle visible={isVis('opening_hours')} onChange={v => setVisible('opening_hours', v)} />
              </div>
```

- [ ] **Step 4: Galerie-Header mit Toggle**

Ersetze:
```tsx
              <div style={sectionTitle}>Foto-Galerie <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-muted)' }}>(max. 6 Bilder)</span></div>
```
mit:
```tsx
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ ...sectionTitle, marginBottom: 0 }}>Foto-Galerie <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-muted)' }}>(max. 6 Bilder)</span></div>
                <VisibilityToggle visible={isVis('gallery')} onChange={v => setVisible('gallery', v)} />
              </div>
```

- [ ] **Step 5: Bewertungen-Header mit Toggle**

Ersetze:
```tsx
              <div style={sectionTitle}>Bewertungen</div>
```
mit:
```tsx
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ ...sectionTitle, marginBottom: 0 }}>Bewertungen</div>
                <VisibilityToggle visible={isVis('reviews')} onChange={v => setVisible('reviews', v)} />
              </div>
```

- [ ] **Step 6: „Weitere Sektionen"-Panel für headerlose Sektionen**

Ersetze (das Ende der Auszeichnungen-Sektion + Container-Ende, eindeutig durch den FARBEN-Kommentar; aus Task 6 stammt der `+ Auszeichnung hinzufügen`-Button davor):
```tsx
                  + Auszeichnung hinzufügen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── FARBEN TAB ── */}
```
mit:
```tsx
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
```

- [ ] **Step 7: Typecheck + manuelle Prüfung**

Run: `cd app && npx tsc --noEmit`
Expected: 0 Fehler.

Manuell: Im Admin „Landing Page" hat jede Sektion (Über uns, Kontakt, Öffnungszeiten, Galerie, Bewertungen, Team, Geschichte, Atmosphäre, Auszeichnungen) einen „👁 Sichtbar / 🚫 Aus"-Schalter; unten das „Weitere Sektionen"-Panel. Eine Sektion ausschalten → nach ~1s verschwindet sie im rechten iframe. „Über uns" ✦KI ohne API-Key → zeigt dezente Fehlermeldung (kein Absturz).

- [ ] **Step 8: Commit**
```bash
git add "app/app/admin/branding/LandingPageTab.tsx"
git commit -m "feat(admin): per-section visibility toggles + about AI button"
```

---

## Final Verification (nach allen Tasks)

- [ ] **Typecheck:** `cd app && npx tsc --noEmit` → 0 Fehler.
- [ ] **Tests:** `cd app && npm test` → alle grün (keine neuen Lib-Tests, bestehende dürfen nicht brechen).
- [ ] **Routen kompilieren:** `curl` auf `/admin/branding`, `/italiener/info?preview=1`, `/bestellen/italiener?preview=1` → jeweils sinnvolle Antwort (200 bzw. Login-Redirect für Admin).
- [ ] **Manueller End-to-End-Durchlauf:** Im Admin Inhalte ändern → Auto-Save → iframe aktualisiert sich; Bild-Uploads (Team/Story/Atmosphäre/Award) erscheinen in der Vorschau; Sichtbarkeits-Toggles wirken in der Vorschau; Vorschau-Seitentabs (Start/Speisekarte/Reservieren) + 📱/🖥 funktionieren.

---

## Self-Review (durchgeführt)

**1. Spec-Abdeckung (Teilprojekt 3):**
- Split-Editor mit iframe-Live-Vorschau → Task 3 + Task 4 ✓
- Vorschau-Seitentabs (Start/Speisekarte/Reservieren) + Geräte-Umschalter (Mobil/Desktop) → Task 3 ✓
- `?preview=1` → Task 2 ✓
- Debounced Autosave + Reload → Task 4 ✓
- Bild-Zonen mit Label/Hilfetext/Thumbnail (bestehende `ImageDropzone` wiederverwendet) + neue Upload-Typen → Task 1 + Task 5/6 ✓
- Editoren für die 4 neuen Sektionen → Task 6 ✓
- Sichtbarkeits-Toggle pro Sektion (neue inline + bestehende Header + Panel für headerlose) → Task 6 + Task 7 ✓
- ✨ KI-Buttons (about/story) → Task 5 (Handler) + Task 6 (story) + Task 7 (about) ✓

**2. Placeholder-Scan:** Keine TBD/TODO; jeder Schritt zeigt vollständigen Code bzw. exakte old→new-Blöcke.

**3. Typ-/Symbol-Konsistenz & Reihenfolge:** `VisibilityToggle`, `uploadImage`, `handleGenerateField`, `generatingField`, `isVis`, `setVisible` werden in **Task 5** definiert, BEVOR Task 6/7 sie nutzen → keine Vorwärts-Referenz, tsc bleibt nach jeder Task grün. `PreviewPane`-Props `{ slug, reloadToken }` stimmen mit dem Aufruf in Task 4 überein. `SectionKey` wird importiert (Task 4) und in isVis/setVisible (Task 5) + Panel (Task 7) genutzt. Die in Task 6/7 verwendeten Felder (`team`, `story_text`, `story_image_url`, `founded_year`, `ambiance_gallery`, `awards`, `section_visibility`) existieren seit TP2 in `LandingPageContent`. Die Anker `{/* ── FARBEN TAB ── */}` wird in Task 6 (Einfügen vor) und Task 7 Step 6 (erneut, nach dem in Task 6 ergänzten Awards-Block) genutzt — die Reihenfolge stimmt, weil Task 7 nach Task 6 läuft und auf den dann vorhandenen `+ Auszeichnung hinzufügen`-Button ankert.
