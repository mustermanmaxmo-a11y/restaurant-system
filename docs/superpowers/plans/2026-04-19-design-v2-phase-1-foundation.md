# Design V2 — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Baue die Infrastruktur für das V2 Theme-System: Supabase-Schema, Design-Version-Provider, CSS-Tokens für V2, Geist-Font-Loading. Abschließend ein Proof-of-Concept auf `/admin` (Startseite), der die V1/V2-Umschaltung via DB-Wert beweist — ohne dass der Rest der App betroffen ist. V1 bleibt überall Default.

**Architecture:** DB-basiertes Versioning mit Fallback-Chain (Restaurant-Override → Platform-Default → Hardcoded `'v1'`). Server-Component resolvt die Version, passt Klasse `theme-v1`/`theme-v2` an `<html>` an, Client-Component stellt Hook `useDesignVersion()` bereit. CSS-Tokens in `.theme-v2` Scope — V1-Tokens bleiben 1:1 unter `:root, .theme-v1`.

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres), TypeScript, Tailwind 4, CSS Variables, Geist Font via next/font.

**Spec:** `docs/superpowers/specs/2026-04-19-design-v2-theme-system-design.md`

---

## File Structure (Phase 1)

**Neu erstellt:**
- `supabase/migrations/20260419_021_design_versions.sql` — DB-Schema
- `app/lib/design-version.ts` — Server-Side Resolver-Funktion + Types
- `app/components/providers/design-version-provider.tsx` — Client Context + Hook
- `app/app/admin/_v1/ClassicOverview.tsx` — Aktueller `/admin`-Code als Komponente
- `app/app/admin/_v2/BentoOverview.tsx` — V2-Stub (Platzhalter für Phase 2)

**Modifiziert:**
- `app/app/globals.css` — V2 CSS-Tokens hinzugefügt, V1 unverändert
- `app/app/layout.tsx` — Geist-Font geladen, DesignVersionProvider eingehängt, Klasse auf `<html>` via Server-Resolve
- `app/app/admin/page.tsx` — Rendert conditional `<ClassicOverview />` oder `<BentoOverview />`
- `app/types/database.ts` — Types für neue Spalten ergänzt (falls vorhanden)

**Nicht betroffen in Phase 1:** Alle anderen `/admin/*`-Seiten, alle `/platform/*`-Seiten, alle Gast-Seiten, Theme-Switcher-UI (alle in späteren Phasen).

---

## Testing-Strategie

Das Projekt hat **kein automatisiertes Test-Framework** (kein Jest/Vitest/Playwright). Verification erfolgt durch:

1. **TypeScript-Build:** `cd app && npm run build` muss durchlaufen
2. **Lint:** `cd app && npm run lint` muss durchlaufen
3. **Manueller Smoke-Test:** `npm run dev` + Browser-Check, dass V1 unverändert erscheint
4. **Manueller V2-Test:** SQL-Update-Statement via Supabase-SQL-Editor, Reload, V2-Stub sichtbar

Jede Task dokumentiert die exakten Verifikations-Kommandos.

---

## Task 1: DB-Migration — platform_settings + restaurants-Spalten

**Files:**
- Create: `supabase/migrations/20260419_021_design_versions.sql`

- [ ] **Step 1: Migration-Datei anlegen mit exaktem Schema**

```sql
-- 20260419_021_design_versions.sql
-- V2 Theme-System: Platform- und Restaurant-level design version preferences

-- ─────────────────────────────────────────────
-- 1. Tabelle: platform_settings (Singleton — genau eine Row)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id                            int PRIMARY KEY DEFAULT 1,
  platform_design_version       text NOT NULL DEFAULT 'v1'
    CHECK (platform_design_version IN ('v1', 'v2')),
  restaurants_default_version   text NOT NULL DEFAULT 'v1'
    CHECK (restaurants_default_version IN ('v1', 'v2')),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);

-- Genau eine Row seeden
INSERT INTO public.platform_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 2. Restaurants: optional Override für Admin- und Gast-Theme
-- ─────────────────────────────────────────────
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS admin_design_version text
    CHECK (admin_design_version IS NULL OR admin_design_version IN ('v1', 'v2')),
  ADD COLUMN IF NOT EXISTS guest_design_version text
    CHECK (guest_design_version IS NULL OR guest_design_version IN ('v1', 'v2'));

-- ─────────────────────────────────────────────
-- 3. RLS: platform_settings — nur Platform-Team lesend, nur Owner schreibend
-- ─────────────────────────────────────────────
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_settings_read
  ON public.platform_settings
  FOR SELECT
  USING (public.get_platform_role() IS NOT NULL);

CREATE POLICY platform_settings_write_owner
  ON public.platform_settings
  FOR UPDATE
  USING (public.is_platform_owner());

-- Gast-Seiten (anonymer Zugriff) brauchen Lesezugriff auf restaurants.guest_design_version
-- Das ist bereits durch bestehende restaurants-Policies abgedeckt (public.restaurants SELECT)

COMMENT ON TABLE  public.platform_settings              IS 'Globale Platform-Konfiguration (Singleton, id=1)';
COMMENT ON COLUMN public.platform_settings.platform_design_version     IS 'Theme für /platform/* UI';
COMMENT ON COLUMN public.platform_settings.restaurants_default_version IS 'Default-Theme für alle Restaurants, wenn kein Override gesetzt';
COMMENT ON COLUMN public.restaurants.admin_design_version  IS 'NULL = Platform-Default verwenden, sonst v1 | v2';
COMMENT ON COLUMN public.restaurants.guest_design_version  IS 'NULL = Platform-Default verwenden, sonst v1 | v2';
```

- [ ] **Step 2: Migration lokal anwenden (oder Supabase-Dashboard SQL-Editor)**

Das Projekt wendet Migrations typischerweise über das Supabase-Dashboard an. Öffne https://supabase.com/dashboard → Projekt → SQL Editor und führe den Inhalt der Migration aus.

Alternativ mit Supabase CLI (falls konfiguriert):

Run: `cd /c/Users/David/Desktop/restaurant-system && supabase db push`
Expected: Migration ohne Fehler applied.

- [ ] **Step 3: DB-Zustand verifizieren via SQL-Editor**

Führe aus:

```sql
SELECT * FROM platform_settings;
-- Expected: 1 Row, id=1, platform_design_version='v1', restaurants_default_version='v1'

SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'restaurants' AND column_name LIKE '%design_version%';
-- Expected: admin_design_version (text), guest_design_version (text)
```

- [ ] **Step 4: Commit**

```bash
cd /c/Users/David/Desktop/restaurant-system
git add supabase/migrations/20260419_021_design_versions.sql
git commit -m "feat(db): add platform_settings + design_version columns for V2 theme system"
```

---

## Task 2: Server-Side Resolver — `lib/design-version.ts`

**Files:**
- Create: `app/lib/design-version.ts`

- [ ] **Step 1: Types und Resolver-Funktion schreiben**

Erstelle `app/lib/design-version.ts` mit folgendem Inhalt:

```typescript
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export type DesignVersion = 'v1' | 'v2'
export type DesignScope = 'platform' | 'admin' | 'guest'

const DEFAULT_VERSION: DesignVersion = 'v1'

function coerceVersion(value: unknown): DesignVersion | null {
  return value === 'v1' || value === 'v2' ? value : null
}

/**
 * Resolved die aktive Design-Version für einen Scope.
 *
 * Fallback-Chain:
 * - platform: platform_settings.platform_design_version → 'v1'
 * - admin:    restaurants.admin_design_version → platform_settings.restaurants_default_version → 'v1'
 * - guest:    restaurants.guest_design_version → platform_settings.restaurants_default_version → 'v1'
 *
 * @param scope  Welcher Bereich der App fragt
 * @param restaurantId  Nur bei scope='admin' oder 'guest' — sonst ignoriert
 */
export async function resolveDesignVersion(
  scope: DesignScope,
  restaurantId?: string | null
): Promise<DesignVersion> {
  try {
    // Guest-Seiten dürfen anonym zugreifen → admin-client ohne RLS
    // Admin/Platform-Seiten haben authentifizierten SSR-Client
    const supabase = scope === 'guest'
      ? createSupabaseAdmin()
      : await createSupabaseServerSSR()

    const { data: settings } = await supabase
      .from('platform_settings')
      .select('platform_design_version, restaurants_default_version')
      .eq('id', 1)
      .maybeSingle()

    if (scope === 'platform') {
      return coerceVersion(settings?.platform_design_version) ?? DEFAULT_VERSION
    }

    const defaultVersion =
      coerceVersion(settings?.restaurants_default_version) ?? DEFAULT_VERSION

    if (!restaurantId) return defaultVersion

    const column = scope === 'admin' ? 'admin_design_version' : 'guest_design_version'
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select(column)
      .eq('id', restaurantId)
      .maybeSingle()

    const override = coerceVersion(
      (restaurant as Record<string, unknown> | null)?.[column]
    )
    return override ?? defaultVersion
  } catch {
    // Bei jedem Fehler auf V1 fallbacken (bewusst silent für Rendering-Stabilität;
    // Sentry erfasst DB-Fehler automatisch über Supabase-Client)
    return DEFAULT_VERSION
  }
}
```

- [ ] **Step 2: TypeScript-Build verifizieren**

Run: `cd /c/Users/David/Desktop/restaurant-system/app && npm run build`
Expected: Build durchläuft ohne Typ-Fehler. Falls `types/database.ts` keine `platform_settings`-Row-Types hat, fügen wir die in Step 3 hinzu.

- [ ] **Step 3: Types in `types/database.ts` ergänzen (falls nötig)**

Prüfe zuerst: `grep -n "platform_settings" app/types/database.ts`

Falls **keine** Treffer, ergänze nach den bestehenden Type-Exports (z.B. nach `Restaurant`):

```typescript
export interface PlatformSettings {
  id: number
  platform_design_version: 'v1' | 'v2'
  restaurants_default_version: 'v1' | 'v2'
  updated_at: string
}
```

Und erweitere das bestehende `Restaurant`-Interface um:

```typescript
admin_design_version: 'v1' | 'v2' | null
guest_design_version: 'v1' | 'v2' | null
```

Falls `types/database.ts` nicht existiert oder andere Struktur hat, überspringe diesen Step — Supabase-Client gibt `any` zurück, der Coerce-Guard schützt uns.

- [ ] **Step 4: Nochmal builden**

Run: `cd /c/Users/David/Desktop/restaurant-system/app && npm run build`
Expected: PASS ohne Typ-Fehler.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/David/Desktop/restaurant-system
git add app/lib/design-version.ts app/types/database.ts
git commit -m "feat: add resolveDesignVersion server-side resolver"
```

---

## Task 3: Client Provider — `components/providers/design-version-provider.tsx`

**Files:**
- Create: `app/components/providers/design-version-provider.tsx`

- [ ] **Step 1: Provider + Hook schreiben**

Erstelle `app/components/providers/design-version-provider.tsx`:

```typescript
'use client'

import { createContext, useContext, useEffect } from 'react'
import type { DesignVersion } from '@/lib/design-version'

interface DesignVersionContext {
  version: DesignVersion
}

const Ctx = createContext<DesignVersionContext | null>(null)

/**
 * Wraps children and (client-side) applies the theme class to <html>.
 * The initial class is also set server-side in the root layout to avoid FOUC.
 */
export function DesignVersionProvider({
  version,
  children,
}: {
  version: DesignVersion
  children: React.ReactNode
}) {
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('theme-v1', 'theme-v2')
    root.classList.add(`theme-${version}`)
  }, [version])

  return <Ctx.Provider value={{ version }}>{children}</Ctx.Provider>
}

export function useDesignVersion(): DesignVersion {
  const ctx = useContext(Ctx)
  if (!ctx) {
    // Im Admin-/Platform-Layout immer gesetzt. Außerhalb (z.B. statische Pages)
    // defaulten wir auf V1 statt zu werfen, damit die App nicht crasht.
    return 'v1'
  }
  return ctx.version
}
```

- [ ] **Step 2: Build verifizieren**

Run: `cd /c/Users/David/Desktop/restaurant-system/app && npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /c/Users/David/Desktop/restaurant-system
git add app/components/providers/design-version-provider.tsx
git commit -m "feat: add DesignVersionProvider + useDesignVersion hook"
```

---

## Task 4: CSS V2 Tokens in `globals.css`

**Files:**
- Modify: `app/app/globals.css`

- [ ] **Step 1: V2-Tokens am Ende des `:root`-Blocks hinzufügen**

Öffne `app/app/globals.css`. Der Anfang der Datei sieht so aus:

```css
@import "tailwindcss";

/* Light Mode (Default) */
:root {
  --font-heading: var(--font-syne);
  --font-body: var(--font-dm-sans);
  /* ... bestehende V1 Tokens ... */
}
```

**Ändere** die Zeile `:root {` zu `:root, .theme-v1 {` (damit V1 explizit wird ohne Breaking Change):

```css
/* Light Mode (Default) — V1 Classic */
:root, .theme-v1 {
  --font-heading: var(--font-syne);
  --font-body: var(--font-dm-sans);
  /* ... alle bestehenden Tokens bleiben unverändert ... */
}
```

**Ändere** auch `.dark {` zu `.theme-v1.dark, :root.dark:not(.theme-v2) {` — stellt sicher, dass Dark-Mode nur bei V1 greift:

```css
.theme-v1.dark, :root.dark:not(.theme-v2) {
  /* ... alle bestehenden Dark-Tokens bleiben unverändert ... */
}
```

- [ ] **Step 2: V2-Tokens-Block direkt nach dem Dark-Mode-Block einfügen**

Füge folgenden Block ein (vor der ersten Nicht-Variablen-CSS-Regel, z.B. vor `html {`):

```css
/* V2 Bento Premium — dark-only in this phase */
.theme-v2 {
  --font-heading: var(--font-geist);
  --font-body: var(--font-geist);

  --bg: #0A0A0F;
  --surface: #111118;
  --surface-2: #16213e;
  --surface-elevated: #1a1a2e;

  --accent: #EA580C;
  --accent-hover: #F97316;
  --accent-subtle: #EA580C14;
  --accent-glow: #EA580C40;

  --text: #F5F5F7;
  --text-muted: #8B8B93;

  --border: #1F1F28;
  --border-accent: #EA580C40;

  --btn-bg: linear-gradient(135deg, #EA580C, #F97316);
  --btn-text: #FFFFFF;

  --header-bg: #0A0A0F;
  --header-text: #F5F5F7;

  --sidebar-bg: #0A0A0F;
  --sidebar-text: #8B8B93;
  --sidebar-active-bg: #1a1a2e;
  --sidebar-active-text: #F5F5F7;

  --status-new: #EA580C;
  --status-new-bg: #2A1500;
  --status-cooking: #F59E0B;
  --status-cooking-bg: #1F1400;
  --status-served: #10B981;
  --status-served-bg: #061A0F;

  --card-radius: 16px;
  --card-shadow: 0 8px 32px rgba(0,0,0,0.4);
  --gradient-accent: linear-gradient(135deg, #EA580C, #F97316);
}
```

- [ ] **Step 3: Dev-Server starten, manuell V1 testen**

Run: `cd /c/Users/David/Desktop/restaurant-system/app && npm run dev`

Öffne `http://localhost:3000/admin` im Browser. Expected: Sieht aus wie vorher (V1). Keine Änderung sichtbar.

Prüfe DevTools-Console auf Fehler → keine erwartet.
Prüfe Computed-Styles auf `<html>` → Klasse sollte nicht `theme-v2` haben.

Stop dev-server mit Ctrl+C.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/David/Desktop/restaurant-system
git add app/app/globals.css
git commit -m "feat(css): scope V1 tokens to .theme-v1, add V2 token set"
```

---

## Task 5: Geist-Font in Root-Layout laden + Provider einhängen

**Files:**
- Modify: `app/app/layout.tsx`

- [ ] **Step 1: Geist-Font-Import einbinden**

Öffne `app/app/layout.tsx`. Der aktuelle Inhalt importiert Fonts so:

```typescript
import { Syne, DM_Sans, Playfair_Display, Lato, Inter, Space_Grotesk, Merriweather, Source_Sans_3, Noto_Serif_Display, Noto_Sans } from 'next/font/google'
```

**Ändere** zu (nur `Geist` am Ende hinzufügen):

```typescript
import { Syne, DM_Sans, Playfair_Display, Lato, Inter, Space_Grotesk, Merriweather, Source_Sans_3, Noto_Serif_Display, Noto_Sans, Geist } from 'next/font/google'
```

**Füge** nach den bestehenden `const xxx = FontName(...)` Zeilen hinzu:

```typescript
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  weight: ['300', '400', '500', '600', '700', '800'],
})
```

**Erweitere** `allFontVars`:

```typescript
const allFontVars = [
  syne, dmSans, playfairDisplay, lato, inter, spaceGrotesk,
  merriweather, sourceSans3, notoSerifDisplay, notoSans, geist,
].map(f => f.variable).join(' ')
```

- [ ] **Step 2: `headers()`-Import entfernen und RootLayout anpassen**

**Entferne** den `import { headers } from 'next/headers'` wieder — der wird für Phase 1 nicht gebraucht.

**Ändere** die bestehende `RootLayout`-Funktion. Die aktuelle Definition:

```typescript
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" suppressHydrationWarning>
```

**Ersetze** sie durch:

```typescript
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Root-Layout setzt als konservativen Default theme-v1.
  // Admin/Platform/Guest-Layouts resolven ihre echte Version und überschreiben
  // die <html>-Klasse via DesignVersionProvider (Client-Effekt).
  return (
    <html lang="de" className="theme-v1" suppressHydrationWarning>
```

Alles andere in `RootLayout` (head, body, Provider-Kette) bleibt **unverändert**. Wichtig: KEIN `<DesignVersionProvider>` um `{children}` — der wird pro Scope-Layout (admin/platform/guest) eingehängt, damit die Version dort kontextabhängig resolved werden kann.

**Korrigiere** den Import-Block am Dateianfang — entferne `DesignVersionProvider` und `resolveDesignVersion` aus den Imports, falls sie bei Step 1 dort gelandet sind. Wir brauchen hier nur Geist.

Finale Import-Zeilen:

```typescript
import { Syne, DM_Sans, Playfair_Display, Lato, Inter, Space_Grotesk, Merriweather, Source_Sans_3, Noto_Serif_Display, Noto_Sans, Geist } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { LanguageProvider } from '@/components/providers/language-provider'
import { CookieBanner } from '@/components/CookieBanner'
import './globals.css'
```

- [ ] **Step 3: Build + Dev-Smoke-Test**

```bash
cd /c/Users/David/Desktop/restaurant-system/app
npm run build
```
Expected: PASS

```bash
npm run dev
```

Öffne `http://localhost:3000` → Homepage lädt, keine Console-Errors.
Öffne `http://localhost:3000/admin` → Admin lädt wie vorher.
DevTools: `<html>` hat Klasse `theme-v1`.

Stop dev-server.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/David/Desktop/restaurant-system
git add app/app/layout.tsx
git commit -m "feat: load Geist font and set theme-v1 default class in root layout"
```

---

## Task 6: Admin-Layout resolvt Restaurant-Version

**Files:**
- Modify: `app/app/admin/layout.tsx`

- [ ] **Step 1: Admin-Layout in Server-Wrapper + Client-Inner splitten**

Das bestehende `app/app/admin/layout.tsx` ist eine Client-Component (`'use client'`). Für das Version-Resolve brauchen wir Server-Zugriff. Wir nutzen das Pattern: Server-Wrapper resolvt + rendert Client-Inner mit Version als Prop.

**Aktuellen Inhalt** von `app/app/admin/layout.tsx` **umbenennen** zu `app/app/admin/AdminLayoutInner.tsx`.

```bash
cd /c/Users/David/Desktop/restaurant-system
git mv app/app/admin/layout.tsx app/app/admin/AdminLayoutInner.tsx
```

- [ ] **Step 2: Neue Server-Component `app/app/admin/layout.tsx` anlegen**

Inhalt:

```typescript
import { createSupabaseServerSSR } from '@/lib/supabase-server-ssr'
import { resolveDesignVersion } from '@/lib/design-version'
import { DesignVersionProvider } from '@/components/providers/design-version-provider'
import AdminLayoutInner from './AdminLayoutInner'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerSSR()
  const { data: { user } } = await supabase.auth.getUser()

  let restaurantId: string | null = null
  if (user) {
    const { data } = await supabase
      .from('restaurants')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .maybeSingle()
    restaurantId = data?.id ?? null
  }

  const version = await resolveDesignVersion('admin', restaurantId)

  return (
    <DesignVersionProvider version={version}>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </DesignVersionProvider>
  )
}
```

- [ ] **Step 3: AdminLayoutInner minimal anpassen (Default-Export)**

Öffne `app/app/admin/AdminLayoutInner.tsx`. Stelle sicher, dass die Funktion als `default` exportiert wird. Der bestehende Code hat `export default function AdminLayout(...)` — das funktioniert weiter, nur der Dateiname hat sich geändert.

**Falls der Client-Code** irgendwo den Namen `AdminLayout` verwendet (z.B. in `displayName`), keine Änderung nötig. Sicherheitshalber Funktion-Name auf `AdminLayoutInner` umbenennen:

```typescript
export default function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  // ... bestehender Code unverändert ...
}
```

- [ ] **Step 4: Build + Dev-Smoke-Test**

```bash
cd /c/Users/David/Desktop/restaurant-system/app
npm run build
```
Expected: PASS

```bash
npm run dev
```

Öffne `http://localhost:3000/admin` (eingeloggt als Restaurant-Owner).
Expected: Alles funktioniert wie vorher. DevTools-Elements: `<html>` hat Klasse `theme-v1`.

Stop dev-server.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/David/Desktop/restaurant-system
git add app/app/admin/
git commit -m "refactor(admin): split layout into server resolver + client inner for design version"
```

---

## Task 7: Proof-of-Concept — `/admin` (Dashboard-Startseite) mit V1/V2-Switch

**Files:**
- Create: `app/app/admin/_v1/ClassicOverview.tsx` — Aktueller Dashboard-Code
- Create: `app/app/admin/_v2/BentoOverview.tsx` — V2-Stub
- Modify: `app/app/admin/page.tsx` — Conditional Render

- [ ] **Step 1: Aktuellen Dashboard-Code nach `_v1/ClassicOverview.tsx` extrahieren**

Öffne `app/app/admin/page.tsx` und lies den kompletten Inhalt. Der File exportiert aktuell eine Funktion `AdminContent` + die Default-Page-Komponente (mit `Suspense`-Wrapper).

**Erstelle** `app/app/admin/_v1/ClassicOverview.tsx` und **kopiere** den **gesamten** Inhalt von `app/app/admin/page.tsx` hinein. Ändere dabei nur:
- Default-Export-Name von `AdminPage` (oder wie er heißt) auf `ClassicOverview`
- `AdminContent`-Funktion behält ihren Namen, wird aber kein Default-Export mehr

Beispiel-Ende des neuen Files:

```typescript
export default function ClassicOverview() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}><p style={{ color: 'var(--text-muted)' }}>Lädt...</p></div>}>
      <AdminContent />
    </Suspense>
  )
}
```

- [ ] **Step 2: V2-Stub `_v2/BentoOverview.tsx` anlegen**

Erstelle `app/app/admin/_v2/BentoOverview.tsx`:

```typescript
'use client'

export default function BentoOverview() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px',
    }}>
      <div style={{
        maxWidth: '600px',
        textAlign: 'center',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--card-radius, 12px)',
        padding: '40px 32px',
        boxShadow: 'var(--card-shadow, none)',
      }}>
        <div style={{
          display: 'inline-block',
          padding: '6px 14px',
          background: 'var(--gradient-accent, var(--accent))',
          color: '#fff',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          marginBottom: '20px',
        }}>V2 · Preview</div>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '32px',
          fontWeight: 700,
          marginBottom: '12px',
        }}>Bento Premium — aktiv</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6 }}>
          Dieser Platzhalter bestätigt, dass die V2-Umschaltung funktioniert.
          Das vollständige Bento-Dashboard wird in Phase 2 implementiert.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `app/admin/page.tsx` auf Conditional Render reduzieren**

**Ersetze** den kompletten Inhalt von `app/app/admin/page.tsx` durch:

```typescript
'use client'

import { useDesignVersion } from '@/components/providers/design-version-provider'
import ClassicOverview from './_v1/ClassicOverview'
import BentoOverview from './_v2/BentoOverview'

export default function AdminPage() {
  const version = useDesignVersion()
  return version === 'v2' ? <BentoOverview /> : <ClassicOverview />
}
```

- [ ] **Step 4: Build + Dev-Smoke-Test (V1-Pfad)**

```bash
cd /c/Users/David/Desktop/restaurant-system/app
npm run build
```
Expected: PASS

```bash
npm run dev
```

Öffne `http://localhost:3000/admin` (eingeloggt als Restaurant-Owner).
Expected: **Sieht exakt aus wie vorher** (V1 Classic Dashboard).

Stop dev-server.

- [ ] **Step 5: V2-Pfad manuell via DB-Update testen**

Öffne Supabase SQL Editor und führe aus (ersetze `<deine-restaurant-id>` durch die echte ID deines Test-Restaurants):

```sql
-- Option A: Nur dieses Restaurant auf V2
UPDATE restaurants SET admin_design_version = 'v2' WHERE id = '<deine-restaurant-id>';

-- Option B (alternativ): Alle Restaurants auf V2 via Default
UPDATE platform_settings SET restaurants_default_version = 'v2' WHERE id = 1;
```

Starte dev-server neu: `npm run dev` (Server-Component cached nicht über Reloads hinaus, aber `force-dynamic` im Layout stellt Re-Resolve sicher).

Öffne `http://localhost:3000/admin` → erwartet: **BentoOverview-Stub mit "V2 Preview"-Badge und Orange-Gradient** sichtbar.

DevTools Elements: `<html>` hat Klasse `theme-v2`.

- [ ] **Step 6: V2 zurück auf V1 setzen (für sauberen Zustand)**

```sql
UPDATE restaurants SET admin_design_version = NULL WHERE id = '<deine-restaurant-id>';
UPDATE platform_settings SET restaurants_default_version = 'v1' WHERE id = 1;
```

Reload → erwartet: V1 wieder sichtbar.

Stop dev-server.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/David/Desktop/restaurant-system
git add app/app/admin/page.tsx app/app/admin/_v1/ app/app/admin/_v2/
git commit -m "feat(admin): add V1/V2 conditional render with BentoOverview stub"
```

---

## Task 8: Lint-Cleanup + Final-Build

**Files:** n/a

- [ ] **Step 1: Lint ausführen**

Run: `cd /c/Users/David/Desktop/restaurant-system/app && npm run lint`

Expected: 0 Errors. Falls Warnings zu neuen Files → nur fixen, wenn sie auf tatsächliche Bugs hindeuten (unused imports/vars), ansonsten belassen.

- [ ] **Step 2: Final-Build**

Run: `cd /c/Users/David/Desktop/restaurant-system/app && npm run build`
Expected: PASS ohne Errors.

- [ ] **Step 3: Git-Status verifizieren**

Run: `cd /c/Users/David/Desktop/restaurant-system && git status`
Expected: Working tree clean — alle Änderungen committed.

- [ ] **Step 4: Git-Log kurz überprüfen**

Run: `cd /c/Users/David/Desktop/restaurant-system && git log --oneline -8`

Expected (ungefähr):
```
xxxxxxx feat(admin): add V1/V2 conditional render with BentoOverview stub
xxxxxxx refactor(admin): split layout into server resolver + client inner for design version
xxxxxxx feat: load Geist font and set theme-v1 default class in root layout
xxxxxxx feat(css): scope V1 tokens to .theme-v1, add V2 token set
xxxxxxx feat: add DesignVersionProvider + useDesignVersion hook
xxxxxxx feat: add resolveDesignVersion server-side resolver
xxxxxxx feat(db): add platform_settings + design_version columns for V2 theme system
xxxxxxx docs: add V2 theme-system design spec
```

---

## Definition of Done für Phase 1

- [x] Supabase hat `platform_settings` Singleton + Spalten `admin_design_version` / `guest_design_version` auf `restaurants`
- [x] `resolveDesignVersion()` existiert und hat die richtige Fallback-Chain
- [x] `DesignVersionProvider` + `useDesignVersion()` exportiert und funktioniert
- [x] `globals.css` hat V2-Token-Set unter `.theme-v2` (V1 unverändert funktionierend)
- [x] Geist-Font geladen
- [x] `/admin` rendert conditional V1 oder V2 basierend auf DB
- [x] Alle anderen Seiten unverändert in V1
- [x] `npm run build` grün
- [x] `npm run lint` grün

**Phase 2 kann jetzt beginnen:** Echten Bento-Dashboard-Code in `BentoOverview` schreiben + V2-Layout bauen + alle weiteren `/admin/*`-Seiten nach demselben Pattern ausbauen.
