# Editor-Studio Phase 1 — Entwurf/Veröffentlichen-Fundament — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Zwei-Zustands-Datenmodell (Entwurf/Veröffentlicht) als Backend-Fundament für das Editor-Studio bauen — ohne sichtbare UI-Änderung.

**Architecture:** Ein `draft_config`-JSONB auf `restaurants` hält den Editor-Entwurf (Marke + Landing-Inhalt). Reine lib-Funktionen bilden Entwurf↔Live ab. Zwei Admin-APIs (Entwurf speichern, Veröffentlichen) + besitzer-geschützte Vorschau der Landing-Seite, die den Entwurf liest. Gäste-Pfade bleiben unverändert (lesen Live; Fallback auf Live, solange kein Entwurf existiert).

**Tech Stack:** Next.js 15 (App Router), TypeScript, Supabase (Postgres, service-role admin client), Vitest.

**Referenz-Spec:** `docs/superpowers/specs/2026-06-30-editor-studio-design.md`

**Scope-Hinweis:** Die Vorschau-liest-Entwurf-Verdrahtung der **Bestellseite** (`/bestellen/[slug]`, Client-Komponente die `/api/restaurant/[slug]` fetcht) gehört in Phase 2, wo der Studio-Canvas sie tatsächlich nutzt/testet. Phase 1 deckt die **Landing-Seite** (Server-Komponente) ab.

---

## File Structure

- **Create:** `supabase/migrations/20260630_071_editor_draft.sql` — fügt `restaurants.draft_config jsonb` + `restaurants.last_published_at timestamptz` hinzu.
- **Create:** `app/lib/editor-draft.ts` — Typen `DraftBrand`/`DraftConfig` + reine Funktionen `initDraftFromLive`, `promoteDraft`, `hasUnpublishedChanges`.
- **Create:** `app/lib/__tests__/editor-draft.test.ts` — Vitest-Unit-Tests dafür.
- **Create:** `app/app/api/admin/editor-draft/route.ts` — GET (Entwurf laden) + PATCH (Entwurf auto-speichern), besitzer-geschützt.
- **Create:** `app/app/api/admin/editor-publish/route.ts` — POST (Entwurf→Live promoten + validieren).
- **Modify:** `app/app/[slug]/info/page.tsx` — im Besitzer-Preview (`?preview=1`) Entwurf lesen statt Live.

---

### Task 1: Migration — draft_config + last_published_at

**Files:**
- Create: `supabase/migrations/20260630_071_editor_draft.sql`

- [ ] **Step 1: Migration schreiben**

```sql
-- Editor-Studio Phase 1: Entwurf/Veröffentlichen-Fundament
-- Entwurf des Editors (Marke + Landing-Inhalt) getrennt vom Live-Zustand.
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS draft_config jsonb,
  ADD COLUMN IF NOT EXISTS last_published_at timestamptz;

COMMENT ON COLUMN restaurants.draft_config IS 'Editor-Entwurf (brand + landing_content + draft_updated_at). NULL = noch kein Entwurf, Editor initialisiert aus Live-Stand.';
COMMENT ON COLUMN restaurants.last_published_at IS 'Zeitpunkt des letzten Veröffentlichens (Entwurf→Live). Vergleich mit draft.draft_updated_at ergibt "nicht veröffentlichte Änderungen".';
```

Hinweis: Reiner Spalten-Add auf bestehender Tabelle → keine neuen GRANTs nötig (anon/authenticated/service_role erben Tabellen-Rechte).

- [ ] **Step 2: Migration im Supabase-Dashboard ausführen**

Diese Migration muss manuell im Supabase SQL-Editor ausgeführt werden (kein Auto-Migrate in diesem Projekt). Nach Ausführung prüfen:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'restaurants' AND column_name IN ('draft_config', 'last_published_at');
```
Erwartet: beide Spalten gelistet.

- [ ] **Step 3: Commit**

```bash
git add "supabase/migrations/20260630_071_editor_draft.sql"
git commit -m "feat(db): add restaurants.draft_config + last_published_at for editor draft/publish"
```

---

### Task 2: editor-draft.ts — Typen + hasUnpublishedChanges (TDD)

**Files:**
- Create: `app/lib/editor-draft.ts`
- Create: `app/lib/__tests__/editor-draft.test.ts`

- [ ] **Step 1: Failing test schreiben**

`app/lib/__tests__/editor-draft.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { hasUnpublishedChanges } from '@/lib/editor-draft'

describe('hasUnpublishedChanges', () => {
  it('false, wenn noch kein Entwurf-Zeitstempel existiert', () => {
    expect(hasUnpublishedChanges(null, null)).toBe(false)
    expect(hasUnpublishedChanges(undefined, '2026-06-30T10:00:00.000Z')).toBe(false)
  })

  it('true, wenn Entwurf existiert aber noch nie veröffentlicht wurde', () => {
    expect(hasUnpublishedChanges('2026-06-30T10:00:00.000Z', null)).toBe(true)
  })

  it('true, wenn Entwurf neuer als letzte Veröffentlichung', () => {
    expect(hasUnpublishedChanges('2026-06-30T12:00:00.000Z', '2026-06-30T10:00:00.000Z')).toBe(true)
  })

  it('false, wenn Entwurf älter/gleich der letzten Veröffentlichung', () => {
    expect(hasUnpublishedChanges('2026-06-30T10:00:00.000Z', '2026-06-30T12:00:00.000Z')).toBe(false)
    expect(hasUnpublishedChanges('2026-06-30T10:00:00.000Z', '2026-06-30T10:00:00.000Z')).toBe(false)
  })
})
```

- [ ] **Step 2: Test ausführen → muss fehlschlagen**

Run: `cd app && npx vitest run lib/__tests__/editor-draft.test.ts`
Expected: FAIL ("does not provide an export named 'hasUnpublishedChanges'" / Modul nicht gefunden).

- [ ] **Step 3: editor-draft.ts mit Typen + Funktion anlegen**

`app/lib/editor-draft.ts`:
```ts
import type { LandingPageContent } from './landing-content'

export interface DraftBrand {
  design_package: string
  layout_variant: string
  font_pair: string
  primary_color: string | null
  bg_color: string | null
  header_color: string | null
  card_color: string | null
  button_color: string | null
  text_color: string | null
  design_config: Record<string, unknown> | null
  logo_url: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  description: string | null
}

export interface DraftConfig {
  brand: DraftBrand
  landing_content: LandingPageContent
  draft_updated_at: string
}

/** Gibt es ungespeicherte (= nicht veröffentlichte) Änderungen? */
export function hasUnpublishedChanges(
  draftUpdatedAt: string | null | undefined,
  lastPublishedAt: string | null | undefined,
): boolean {
  if (!draftUpdatedAt) return false
  if (!lastPublishedAt) return true
  return new Date(draftUpdatedAt).getTime() > new Date(lastPublishedAt).getTime()
}
```

- [ ] **Step 4: Test ausführen → muss bestehen**

Run: `cd app && npx vitest run lib/__tests__/editor-draft.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "app/lib/editor-draft.ts" "app/lib/__tests__/editor-draft.test.ts"
git commit -m "feat(editor-draft): DraftConfig types + hasUnpublishedChanges (tested)"
```

---

### Task 3: initDraftFromLive (TDD)

**Files:**
- Modify: `app/lib/editor-draft.ts`
- Modify: `app/lib/__tests__/editor-draft.test.ts`

- [ ] **Step 1: Failing test ergänzen** (am Ende der Testdatei einfügen)

```ts
import { initDraftFromLive } from '@/lib/editor-draft'

describe('initDraftFromLive', () => {
  it('übernimmt Marke-Felder aus dem Restaurant und füllt Fallbacks', () => {
    const draft = initDraftFromLive(
      {
        design_package: null, layout_variant: null, font_pair: null,
        primary_color: '#abc123', bg_color: null, header_color: null,
        card_color: null, button_color: null, text_color: null,
        design_config: { foo: 'bar' }, logo_url: 'https://x/logo.png',
        contact_email: 'a@b.de', contact_phone: null, contact_address: null,
        description: 'Beste Pasta',
      },
      { headline: 'Hallo' },
    )
    expect(draft.brand.design_package).toBe('modern-classic') // Fallback
    expect(draft.brand.layout_variant).toBe('cards')          // Fallback
    expect(draft.brand.font_pair).toBe('syne-dmsans')         // Fallback
    expect(draft.brand.primary_color).toBe('#abc123')
    expect(draft.brand.design_config).toEqual({ foo: 'bar' })
    expect(draft.brand.logo_url).toBe('https://x/logo.png')
    expect(draft.brand.description).toBe('Beste Pasta')
    expect(draft.landing_content.headline).toBe('Hallo')
    expect(typeof draft.draft_updated_at).toBe('string')
  })

  it('sanitisiert den Landing-Inhalt (verwirft Müll-Keys)', () => {
    const draft = initDraftFromLive(
      { primary_color: null } as Record<string, unknown>,
      { headline: 'Hi', evil: 'x' } as Record<string, unknown>,
    )
    expect(draft.landing_content.headline).toBe('Hi')
    expect((draft.landing_content as Record<string, unknown>).evil).toBeUndefined()
  })
})
```

- [ ] **Step 2: Test ausführen → muss fehlschlagen**

Run: `cd app && npx vitest run lib/__tests__/editor-draft.test.ts`
Expected: FAIL ("does not provide an export named 'initDraftFromLive'").

- [ ] **Step 3: initDraftFromLive implementieren** (in `app/lib/editor-draft.ts` ergänzen)

Imports oben in der Datei ergänzen:
```ts
import { sanitizeLandingContent } from './landing-content-validate'
import type { Restaurant } from '@/types/database'
```

Funktion ans Dateiende:
```ts
/** Befüllt einen frischen Entwurf aus dem aktuellen Live-Stand (für Restaurants ohne draft_config). */
export function initDraftFromLive(
  restaurant: Partial<Restaurant>,
  landingContent: LandingPageContent | Record<string, unknown> | null | undefined,
): DraftConfig {
  return {
    brand: {
      design_package: restaurant.design_package ?? 'modern-classic',
      layout_variant: (restaurant.layout_variant as string | null) ?? 'cards',
      font_pair: restaurant.font_pair ?? 'syne-dmsans',
      primary_color: restaurant.primary_color ?? null,
      bg_color: restaurant.bg_color ?? null,
      header_color: restaurant.header_color ?? null,
      card_color: restaurant.card_color ?? null,
      button_color: restaurant.button_color ?? null,
      text_color: restaurant.text_color ?? null,
      design_config: (restaurant.design_config ?? null) as Record<string, unknown> | null,
      logo_url: restaurant.logo_url ?? null,
      contact_email: restaurant.contact_email ?? null,
      contact_phone: restaurant.contact_phone ?? null,
      contact_address: restaurant.contact_address ?? null,
      description: restaurant.description ?? null,
    },
    landing_content: sanitizeLandingContent(landingContent),
    draft_updated_at: new Date().toISOString(),
  }
}
```

- [ ] **Step 4: Test ausführen → muss bestehen**

Run: `cd app && npx vitest run lib/__tests__/editor-draft.test.ts`
Expected: PASS (alle bisherigen + 2 neue).

- [ ] **Step 5: Commit**

```bash
git add "app/lib/editor-draft.ts" "app/lib/__tests__/editor-draft.test.ts"
git commit -m "feat(editor-draft): initDraftFromLive from live restaurant + landing content (tested)"
```

---

### Task 4: promoteDraft (TDD)

**Files:**
- Modify: `app/lib/editor-draft.ts`
- Modify: `app/lib/__tests__/editor-draft.test.ts`

**Kontext:** `promoteDraft` bildet den Entwurf auf die Live-Schreibziele ab. Die `surface_color`-Ableitung spiegelt exakt das heutige `save()` in page.tsx: `primary_color ? null : pkg.preview.surfaceColor`. `getDesignPackage(id)` liefert ein Paket mit `.preview.surfaceColor` (siehe `app/lib/design-packages.ts`).

- [ ] **Step 1: Failing test ergänzen** (am Ende der Testdatei)

```ts
import { promoteDraft, type DraftConfig } from '@/lib/editor-draft'

function makeDraft(overrides: Partial<DraftConfig['brand']> = {}): DraftConfig {
  return {
    brand: {
      design_package: 'modern-classic', layout_variant: 'cards', font_pair: 'syne-dmsans',
      primary_color: null, bg_color: null, header_color: null, card_color: null,
      button_color: null, text_color: null, design_config: null, logo_url: null,
      contact_email: null, contact_phone: null, contact_address: null, description: null,
      ...overrides,
    },
    landing_content: { headline: 'Hallo', evil: 'x' } as Record<string, unknown>,
    draft_updated_at: '2026-06-30T12:00:00.000Z',
  }
}

describe('promoteDraft', () => {
  it('mappt Marke-Felder + sanitisiert den Landing-Inhalt', () => {
    const { restaurantUpdate, landingContent } = promoteDraft(makeDraft({ primary_color: '#ff0000', description: 'X' }))
    expect(restaurantUpdate.primary_color).toBe('#ff0000')
    expect(restaurantUpdate.font_pair).toBe('syne-dmsans')
    expect(restaurantUpdate.description).toBe('X')
    expect(landingContent.headline).toBe('Hallo')
    expect((landingContent as Record<string, unknown>).evil).toBeUndefined()
  })

  it('setzt surface_color = null, wenn primary_color gesetzt ist', () => {
    const { restaurantUpdate } = promoteDraft(makeDraft({ primary_color: '#123456' }))
    expect(restaurantUpdate.surface_color).toBeNull()
  })

  it('leitet surface_color aus dem Paket ab, wenn primary_color null ist', () => {
    const { restaurantUpdate } = promoteDraft(makeDraft({ primary_color: null }))
    expect(typeof restaurantUpdate.surface_color).toBe('string')
  })
})
```

- [ ] **Step 2: Test ausführen → muss fehlschlagen**

Run: `cd app && npx vitest run lib/__tests__/editor-draft.test.ts`
Expected: FAIL ("does not provide an export named 'promoteDraft'").

- [ ] **Step 3: promoteDraft implementieren** (in `app/lib/editor-draft.ts`)

Import oben ergänzen:
```ts
import { getDesignPackage } from './design-packages'
```

Funktion ans Dateiende:
```ts
/** Bildet den Entwurf auf die Live-Schreibziele ab (restaurants-Spalten + landing_pages.content). */
export function promoteDraft(draft: DraftConfig): {
  restaurantUpdate: Record<string, unknown>
  landingContent: LandingPageContent
} {
  const b = draft.brand
  const pkg = getDesignPackage(b.design_package)
  return {
    restaurantUpdate: {
      design_package: b.design_package,
      layout_variant: b.layout_variant,
      font_pair: b.font_pair,
      primary_color: b.primary_color,
      surface_color: b.primary_color ? null : pkg.preview.surfaceColor,
      bg_color: b.bg_color,
      header_color: b.header_color,
      card_color: b.card_color,
      button_color: b.button_color,
      text_color: b.text_color,
      design_config: b.design_config,
      logo_url: b.logo_url,
      contact_email: b.contact_email,
      contact_phone: b.contact_phone,
      contact_address: b.contact_address,
      description: b.description,
    },
    landingContent: sanitizeLandingContent(draft.landing_content),
  }
}
```

- [ ] **Step 4: Test ausführen → muss bestehen**

Run: `cd app && npx vitest run lib/__tests__/editor-draft.test.ts`
Expected: PASS (alle).

- [ ] **Step 5: tsc + Commit**

Run: `cd app && npx tsc --noEmit` → 0 neue Fehler (vorbestehende in `app/api/__tests__/orders-eta.test.ts` ignorieren).
```bash
git add "app/lib/editor-draft.ts" "app/lib/__tests__/editor-draft.test.ts"
git commit -m "feat(editor-draft): promoteDraft maps draft to live writes (tested)"
```

---

### Task 5: API — GET/PATCH /api/admin/editor-draft

**Files:**
- Create: `app/app/api/admin/editor-draft/route.ts`

**Kontext:** Auth-Muster exakt wie `app/app/api/admin/landing-page/route.ts`: `getUser(req)` liest Bearer-Token, `checkOwnership(userId, restaurantId)` prüft `owner_id`. Service-role Client via `createSupabaseAdmin()`.

- [ ] **Step 1: Route schreiben**

`app/app/api/admin/editor-draft/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { initDraftFromLive, hasUnpublishedChanges, type DraftConfig } from '@/lib/editor-draft'
import { sanitizeLandingContent } from '@/lib/landing-content-validate'
import type { LandingPageContent } from '@/lib/landing-content'

export const dynamic = 'force-dynamic'

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const token = auth?.replace('Bearer ', '').trim()
  if (!token) return { user: null }
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { data: { user } } = await client.auth.getUser(token)
  return { user }
}

async function loadOwnedRestaurant(userId: string, restaurantId: string) {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('restaurants')
    .select('*')
    .eq('id', restaurantId)
    .eq('owner_id', userId)
    .maybeSingle()
  return data
}

// GET — Entwurf laden (falls keiner existiert: aus Live-Stand initialisieren, NICHT persistieren)
export async function GET(req: NextRequest) {
  const { user } = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id erforderlich' }, { status: 400 })

  const resto = await loadOwnedRestaurant(user.id, restaurantId)
  if (!resto) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const admin = createSupabaseAdmin()
  const { data: lp } = await admin
    .from('landing_pages')
    .select('content')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  const existing = (resto as { draft_config?: DraftConfig | null }).draft_config ?? null
  const lastPublishedAt = (resto as { last_published_at?: string | null }).last_published_at ?? null
  const draft = existing ?? initDraftFromLive(resto, (lp?.content ?? {}) as LandingPageContent)

  return NextResponse.json({
    draft,
    last_published_at: lastPublishedAt,
    has_unpublished_changes: hasUnpublishedChanges(draft.draft_updated_at, lastPublishedAt),
  })
}

// PATCH — Entwurf auto-speichern (ganzer Entwurf wird ersetzt)
export async function PATCH(req: NextRequest) {
  const { user } = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  let body: { restaurant_id?: string; draft?: DraftConfig }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { restaurant_id, draft } = body
  if (typeof restaurant_id !== 'string' || !restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id erforderlich' }, { status: 400 })
  }
  if (!draft || typeof draft !== 'object' || !draft.brand || typeof draft.brand !== 'object') {
    return NextResponse.json({ error: 'draft (mit brand) erforderlich' }, { status: 400 })
  }

  const resto = await loadOwnedRestaurant(user.id, restaurant_id)
  if (!resto) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const safeDraft: DraftConfig = {
    brand: draft.brand,
    landing_content: sanitizeLandingContent(draft.landing_content),
    draft_updated_at: new Date().toISOString(),
  }

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('restaurants')
    .update({ draft_config: safeDraft })
    .eq('id', restaurant_id)

  if (error) {
    console.error('editor-draft PATCH error:', error)
    return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
  }

  const lastPublishedAt = (resto as { last_published_at?: string | null }).last_published_at ?? null
  return NextResponse.json({
    draft: safeDraft,
    has_unpublished_changes: hasUnpublishedChanges(safeDraft.draft_updated_at, lastPublishedAt),
  })
}
```

- [ ] **Step 2: tsc prüfen**

Run: `cd app && npx tsc --noEmit`
Expected: 0 neue Fehler (vorbestehende `orders-eta.test.ts`-Fehler ignorieren).

- [ ] **Step 3: Route-Smoke-Test (ohne Auth → 401)**

Dev-Server starten (`cd app && npm run dev`), dann:
Run: `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/admin/editor-draft?restaurant_id=x"`
Expected: `401` (kein Token).

- [ ] **Step 4: Commit**

```bash
git add "app/app/api/admin/editor-draft/route.ts"
git commit -m "feat(api): editor-draft GET/PATCH (owner-gated draft load + autosave)"
```

---

### Task 6: API — POST /api/admin/editor-publish

**Files:**
- Create: `app/app/api/admin/editor-publish/route.ts`

**Kontext:** Promotet den gespeicherten Entwurf → Live: schreibt `restaurants`-Marke-Spalten, upsertet `landing_pages.content` + `is_published=true`, setzt `restaurants.last_published_at = now()`.

- [ ] **Step 1: Route schreiben**

`app/app/api/admin/editor-publish/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { promoteDraft, type DraftConfig } from '@/lib/editor-draft'

export const dynamic = 'force-dynamic'

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const token = auth?.replace('Bearer ', '').trim()
  if (!token) return { user: null }
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { data: { user } } = await client.auth.getUser(token)
  return { user }
}

export async function POST(req: NextRequest) {
  const { user } = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  let body: { restaurant_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }
  const { restaurant_id } = body
  if (typeof restaurant_id !== 'string' || !restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id erforderlich' }, { status: 400 })
  }

  const admin = createSupabaseAdmin()
  const { data: resto } = await admin
    .from('restaurants')
    .select('id, draft_config')
    .eq('id', restaurant_id)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!resto) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const draft = (resto as { draft_config?: DraftConfig | null }).draft_config
  if (!draft || !draft.brand) {
    return NextResponse.json({ error: 'Kein Entwurf zum Veröffentlichen' }, { status: 400 })
  }

  const { restaurantUpdate, landingContent } = promoteDraft(draft)
  const publishedAt = new Date().toISOString()

  const { error: restoErr } = await admin
    .from('restaurants')
    .update({ ...restaurantUpdate, last_published_at: publishedAt })
    .eq('id', restaurant_id)
  if (restoErr) {
    console.error('editor-publish restaurants error:', restoErr)
    return NextResponse.json({ error: 'Veröffentlichen fehlgeschlagen (Marke)' }, { status: 500 })
  }

  const { error: lpErr } = await admin
    .from('landing_pages')
    .upsert(
      { restaurant_id, content: landingContent, is_published: true, updated_at: publishedAt },
      { onConflict: 'restaurant_id' },
    )
  if (lpErr) {
    console.error('editor-publish landing_pages error:', lpErr)
    return NextResponse.json({ error: 'Veröffentlichen fehlgeschlagen (Inhalt)' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, last_published_at: publishedAt })
}
```

- [ ] **Step 2: tsc prüfen**

Run: `cd app && npx tsc --noEmit`
Expected: 0 neue Fehler.

- [ ] **Step 3: Route-Smoke-Test (ohne Auth → 401)**

Run: `curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"restaurant_id":"x"}' "http://localhost:3000/api/admin/editor-publish"`
Expected: `401`.

- [ ] **Step 4: Commit**

```bash
git add "app/app/api/admin/editor-publish/route.ts"
git commit -m "feat(api): editor-publish promotes draft to live (brand + landing)"
```

---

### Task 7: Landing-Vorschau liest Entwurf

**Files:**
- Modify: `app/app/[slug]/info/page.tsx`

**Kontext:** Die Seite ist eine Server-Komponente. Sie hat bereits ein besitzer-geschütztes `isPreview` (Cookie-Session, IDOR-Fix aus PR #25). Wenn `isPreview`, soll sie Marke + Inhalt aus `restaurants.draft_config` lesen statt Live. Aktueller Aufbau: `restaurant` wird via `admin.from('restaurants').select(...)` geladen, `lp` via `landing_pages`, dann `resolveBrand(resto, 'landing', {...content})`.

- [ ] **Step 1: Restaurant-Query um draft_config erweitern**

In `app/app/[slug]/info/page.tsx` die `select`-Spaltenliste der `restaurants`-Query (ca. Zeile 80) um `draft_config` ergänzen:
```ts
    .select('id, owner_id, name, slug, description, logo_url, design_config, primary_color, bg_color, surface_color, header_color, button_color, card_color, text_color, font_pair, layout_variant, design_package, draft_config')
```

- [ ] **Step 2: Im Preview-Zweig Entwurf über Restaurant + Content legen**

Direkt **nach** dem Block, der `landingPage`, `resto` und `content` setzt (aktuell ca. Zeile 103-105):
```ts
  const landingPage = lp as LandingPageRow
  const resto = restaurant as RestaurantRow
  const content: LandingPageContent = landingPage.content ?? {}
```
ersetzen durch:
```ts
  const landingPage = lp as LandingPageRow
  let resto = restaurant as RestaurantRow
  let content: LandingPageContent = landingPage.content ?? {}

  // Im Besitzer-Preview Entwurf statt Live lesen (falls vorhanden).
  if (isPreview) {
    const draft = (restaurant as RestaurantRow & { draft_config?: DraftConfig | null }).draft_config
    if (draft && draft.brand) {
      resto = {
        ...resto,
        design_package: draft.brand.design_package ?? resto.design_package,
        layout_variant: draft.brand.layout_variant ?? resto.layout_variant,
        font_pair: draft.brand.font_pair ?? resto.font_pair,
        primary_color: draft.brand.primary_color,
        bg_color: draft.brand.bg_color,
        header_color: draft.brand.header_color,
        card_color: draft.brand.card_color,
        button_color: draft.brand.button_color,
        text_color: draft.brand.text_color,
        design_config: draft.brand.design_config as Record<string, unknown> | null,
        logo_url: draft.brand.logo_url,
      }
      content = draft.landing_content ?? content
    }
  }
```

- [ ] **Step 3: DraftConfig-Import + RestaurantRow-Typ ergänzen**

Import oben in der Datei ergänzen:
```ts
import type { DraftConfig } from '@/lib/editor-draft'
```
Im `interface RestaurantRow` das Feld ergänzen (am Ende vor der schließenden Klammer):
```ts
  draft_config?: DraftConfig | null
```

- [ ] **Step 4: tsc prüfen**

Run: `cd app && npx tsc --noEmit`
Expected: 0 neue Fehler.

- [ ] **Step 5: Manuelle Prüfung**

Da noch keine UI in den Entwurf schreibt, ist `draft_config` für alle Restaurants `null` → Vorschau zeigt unverändert den Live-Stand (Fallback). Verifizieren:
Run: `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/italiener/info"`
Expected: `200` (öffentliche, veröffentlichte Seite unverändert).

(Echter Entwurf-Preview wird in Phase 2 testbar, sobald die Studio-UI den Entwurf schreibt.)

- [ ] **Step 6: Commit**

```bash
git add "app/app/[slug]/info/page.tsx"
git commit -m "feat(landing): owner preview reads draft_config when present (fallback live)"
```

---

## Final Verification (nach allen Tasks)

- [ ] **Typecheck:** `cd app && npx tsc --noEmit` → 0 neue Fehler (nur vorbestehende `app/api/__tests__/orders-eta.test.ts`).
- [ ] **Tests:** `cd app && npm test` → alle grün inkl. neuer `editor-draft.test.ts`.
- [ ] **Routen-Smoke:** `/api/admin/editor-draft` ohne Token → 401; `/api/admin/editor-publish` ohne Token → 401; `/italiener/info` → 200.
- [ ] **Migration im Supabase-Dashboard ausgeführt** (Task 1 Step 2) — sonst geben editor-draft/publish 500 zurück (Spalte fehlt).

---

## Self-Review

**1. Spec-Abdeckung (Phase 1):**
- Migration draft_config + last_published_at → Task 1 ✓
- editor-draft.ts (initDraftFromLive/promoteDraft/hasUnpublishedChanges) + Tests → Tasks 2-4 ✓
- GET/PATCH /api/admin/editor-draft → Task 5 ✓
- POST /api/admin/editor-publish → Task 6 ✓
- Vorschau liest Entwurf (Landing) → Task 7 ✓
- Vorschau Bestellseite → bewusst Phase 2 (Scope-Hinweis oben) ✓

**2. Placeholder-Scan:** Kein TBD/TODO; jeder Code-Schritt zeigt vollständigen Code; jede Funktion/Typ ist definiert bevor sie genutzt wird (`DraftConfig`/`DraftBrand` in Task 2; `initDraftFromLive` Task 3; `promoteDraft` Task 4; alle in Tasks 5-7 importiert).

**3. Typ-/Symbol-Konsistenz:** `DraftConfig` { brand, landing_content, draft_updated_at } konsistent in allen Tasks. `promoteDraft` Rückgabe `{ restaurantUpdate, landingContent }` wird in Task 6 genau so destrukturiert. `hasUnpublishedChanges(draftUpdatedAt, lastPublishedAt)` Signatur konsistent in Task 5. `initDraftFromLive(restaurant, landingContent)` konsistent in Task 5.
