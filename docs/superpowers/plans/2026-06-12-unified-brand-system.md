# Unified Brand System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle Gast-Flächen (Tisch-Bestellung, Online-Bestellung, öffentliche Landing-Page) lesen ihr Design aus einer einzigen Quelle (`restaurants.design_config`) über einen geteilten `resolveBrand`-Resolver, sodass ein Template-Klick alle Flächen konsistent restylt.

**Architecture:** Ein neuer pure-function-Resolver `resolveBrand(restaurant, surface, overrides?)` kapselt das bereits bewährte Muster aus `OrderV2` (`buildColorsFromRestaurant` + `FONT_PAIRS` + Layout-/Stil-Flags) und ergänzt B-Modell-Overrides mit gesperrten Kern-Feldern. Drei Flächen werden auf diesen Resolver umgestellt; die Landing-Page verliert ihre eigene `THEMES`-Map, die Online-Bestellseite (`BestellenV2`) verliert ihre Insellösung. Eine idempotente Migration bereinigt Altdaten.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Supabase (Postgres jsonb), vitest (neu, nur für die Resolver-Unit-Tests). Bestehende Helfer: `lib/color-utils.ts` (`buildColorsFromRestaurant`), `lib/font-pairs.ts` (`FONT_PAIRS`), `lib/design-packages.ts` (`getDesignPackage`).

---

## Wichtige Codebase-Fakten (für Worker ohne Kontext)

- **Projekt-Root der App:** `c:/Users/David/Desktop/restaurant-system/app` — hier liegen `package.json`, `tsconfig.json`, `lib/`, `types/`, `app/` (App-Router-Routen). Pfad-Alias `@/` zeigt auf dieses App-Verzeichnis (z. B. `@/lib/color-utils`).
- **Golden Pattern** (bereits korrekt), `app/app/order/[token]/_v2/OrderV2.tsx` ~Zeile 283–289:
  ```ts
  const C = restaurant ? buildColorsFromRestaurant(restaurant) : buildColorsFromRestaurant({})
  const cfg = restaurant?.design_config ?? {}
  const fontPairKey = readCfgString(cfg, 'font_pair') ?? restaurant?.font_pair ?? getDesignPackage(restaurant?.design_package).fontPair
  const fontPair = (FONT_PAIRS[fontPairKey ?? ''] ?? FONT_PAIRS['syne-dmsans'])
  ```
- `buildColorsFromRestaurant(restaurant)` liest `design_config` zuerst, fällt auf Einzelspalten + Design-Package zurück, liefert ein vollständiges `ColorSet`.
- `FONT_PAIRS[key]` → `{ heading, body, label }` mit CSS-Font-Variablen.
- `Restaurant.design_config: Record<string, unknown> | null` (`app/types/database.ts:41`).
- **Kein Test-Runner vorhanden** — vitest wird in Task 0 minimal eingeführt, nur für die pure Resolver-Funktion. Seiten-Verkabelung wird über `npm run build` (TypeScript) + manuellen Browser-Parity-Check verifiziert.
- **Default-Versionen** (via `resolveDesignVersion`): Order = `OrderV2`, Online = `BestellenV2`. `*V1` bleiben über `buildColorsFromRestaurant` rückwärtskompatibel und werden nicht angefasst.

---

## File Structure

```
app/
  vitest.config.ts                              ← NEU (Task 0): vitest + @-Alias
  package.json                                  ← Modify (Task 0): devDeps + "test"-Script
  lib/
    resolve-brand.ts                            ← NEU (Task 1): resolveBrand + Typen (der Vertrag)
    __tests__/resolve-brand.test.ts             ← NEU (Task 1): Unit-Tests
    color-utils.ts                              ← UNVERÄNDERT (Quelle für ColorSet)
    font-pairs.ts                               ← UNVERÄNDERT (Quelle für FontPair)
  app/
    order/[token]/_v2/OrderV2.tsx               ← Modify (Task 2): über resolveBrand
    bestellen/[slug]/_v2/BestellenV2.tsx        ← Modify (Task 3): über resolveBrand
    [slug]/info/page.tsx                        ← Modify (Task 4): THEMES-Map → resolveBrand
    admin/branding/LandingPageTab.tsx           ← Modify (Task 5): lp-Farb-/Font-Quelle entfernen
    api/design-templates/[id]/apply/route.ts    ← Modify (Task 6): Default-Layouts setzen
supabase/migrations/
  20260612_064_unify_brand.sql                  ← NEU (Task 7): Altdaten bereinigen + GRANTs
```

---

## Task 0: vitest-Setup (nur für Resolver-Unit-Tests)

**Files:**
- Create: `app/vitest.config.ts`
- Modify: `app/package.json` (devDependencies + scripts)

- [ ] **Step 1: vitest installieren**

Run (im Verzeichnis `app/`):
```bash
npm install -D vitest@^2.1.0
```
Expected: `vitest` erscheint in `devDependencies`, kein Build-Fehler.

- [ ] **Step 2: vitest-Config mit `@`-Alias anlegen**

Create `app/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname) },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Test-Script ergänzen**

In `app/package.json` den `"scripts"`-Block erweitern (vorhandene Zeilen behalten):
```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  },
```

- [ ] **Step 4: Leeren Lauf verifizieren**

Run: `npm test`
Expected: vitest startet, „No test files found" ODER Exit 0 (noch keine Tests). Kein Konfig-Fehler.

- [ ] **Step 5: Commit**

```bash
git add app/package.json app/vitest.config.ts app/package-lock.json
git commit -m "chore(test): add minimal vitest setup for brand resolver"
```

---

## Task 1: `resolveBrand`-Resolver (der geteilte Vertrag) — TDD

**Files:**
- Create: `app/lib/resolve-brand.ts`
- Test: `app/lib/__tests__/resolve-brand.test.ts`

- [ ] **Step 1: Failing Tests schreiben**

Create `app/lib/__tests__/resolve-brand.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { resolveBrand, LOCKED_BRAND_KEYS } from '@/lib/resolve-brand'

const baseRestaurant = {
  name: 'Test Bistro',
  logo_url: 'https://example.com/logo.png',
  design_config: {
    primary_color: '#FF6B2C',
    bg_color: '#080808',
    font_pair: 'syne-dmsans',
    layout_variant: 'cards',
    border_radius: 'pill',
  } as Record<string, unknown>,
}

describe('resolveBrand', () => {
  it('liest Farben + Font aus dem Kern (design_config)', () => {
    const b = resolveBrand(baseRestaurant, 'order')
    expect(b.colors.accent).toBe('#FF6B2C')
    expect(b.colors.bg).toBe('#080808')
    expect(b.fontPairKey).toBe('syne-dmsans')
    expect(b.font.heading).toBe('var(--font-syne)')
    expect(b.borderRadius).toBe('pill')
    expect(b.surface).toBe('order')
  })

  it('übernimmt Master-Daten', () => {
    const b = resolveBrand(baseRestaurant, 'landing')
    expect(b.name).toBe('Test Bistro')
    expect(b.logoUrl).toBe('https://example.com/logo.png')
  })

  it('erlaubt Pro-Fläche-Overrides (Landing-Layout, Hero)', () => {
    const b = resolveBrand(baseRestaurant, 'landing', {
      lp_layout: 'split-hero',
      hero_image_url: 'https://example.com/hero.jpg',
    })
    expect(b.layoutVariant).toBe('split-hero')
    expect(b.overrides.hero_image_url).toBe('https://example.com/hero.jpg')
  })

  it('IGNORIERT gesperrte Felder in Overrides (Kern gewinnt aktiv)', () => {
    const b = resolveBrand(baseRestaurant, 'landing', {
      primary_color: '#00FF00',
      font_pair: 'playfair-lato',
    } as Record<string, unknown>)
    expect(b.colors.accent).toBe('#FF6B2C')        // nicht überschrieben
    expect(b.fontPairKey).toBe('syne-dmsans')       // nicht überschrieben
    expect(b.overrides.primary_color).toBeUndefined() // aktiv entfernt
    expect(LOCKED_BRAND_KEYS).toContain('primary_color')
  })

  it('fällt bei leerem design_config auf Default-Look zurück (kein Crash)', () => {
    const b = resolveBrand({}, 'online')
    expect(b.colors.accent).toBeTruthy()
    expect(b.font).toBeTruthy()
    expect(b.layoutVariant).toBe('cards')
  })

  it('Menü-Layout-Override gilt nur für order/online, nicht landing', () => {
    const order = resolveBrand(baseRestaurant, 'order', { layout_variant: 'grid' })
    expect(order.layoutVariant).toBe('grid')
    const landing = resolveBrand(baseRestaurant, 'landing', { layout_variant: 'grid' })
    expect(landing.layoutVariant).toBe('cards') // landing ignoriert Menü-Layout-Key
  })
})
```

- [ ] **Step 2: Tests laufen lassen → müssen fehlschlagen**

Run: `npm test`
Expected: FAIL — `Cannot find module '@/lib/resolve-brand'`.

- [ ] **Step 3: Resolver implementieren**

Create `app/lib/resolve-brand.ts`:
```ts
import { buildColorsFromRestaurant, readCfgString, type ColorSet } from './color-utils'
import { getDesignPackage } from './design-packages'
import { FONT_PAIRS, type FontPair } from './font-pairs'
import type { Restaurant } from '@/types/database'

export type BrandSurface = 'order' | 'online' | 'landing'

/** Felder, die zum gesperrten Brand-Kern gehören — Overrides hierfür werden verworfen. */
export const LOCKED_BRAND_KEYS = [
  'primary_color', 'bg_color', 'surface_color', 'header_color',
  'button_color', 'card_color', 'text_color', 'font_pair',
] as const

export interface BrandOverrides {
  // Landing
  hero_image_url?: string
  headline?: string
  subheadline?: string
  lp_layout?: string
  gallery?: string[]
  feature_badges?: string[]
  cta_text?: string
  cta_url?: string
  // Order / Online
  layout_variant?: string
  cover_image_url?: string
  greeting?: string
  [key: string]: unknown
}

export interface ResolvedBrand {
  surface: BrandSurface
  colors: ColorSet
  font: FontPair
  fontPairKey: string
  layoutVariant: string
  borderRadius: string
  hoverEffect: string
  animationStyle: string
  cardStyle: string
  name?: string
  logoUrl?: string
  /** Overrides nach Entfernen der gesperrten Kern-Keys. */
  overrides: BrandOverrides
}

/**
 * Einzige Art, wie Gast-Flächen ihr Design lesen.
 * Kern aus restaurants.design_config; Pro-Fläche-Overrides obendrauf (B-Modell);
 * gesperrte Kern-Felder in Overrides werden aktiv verworfen.
 */
export function resolveBrand(
  restaurant: Partial<Restaurant>,
  surface: BrandSurface,
  overrides: BrandOverrides = {},
): ResolvedBrand {
  const cfg = (restaurant.design_config ?? {}) as Record<string, unknown>

  // Gesperrte Keys aus Overrides entfernen (Kern gewinnt aktiv)
  const safeOverrides: BrandOverrides = { ...overrides }
  for (const k of LOCKED_BRAND_KEYS) delete safeOverrides[k]

  const colors = buildColorsFromRestaurant(restaurant)

  const fontPairKey =
    readCfgString(cfg, 'font_pair') ??
    restaurant.font_pair ??
    getDesignPackage(restaurant.design_package ?? undefined).fontPair
  const font = FONT_PAIRS[fontPairKey] ?? FONT_PAIRS['syne-dmsans']

  // Layout: order/online dürfen layout_variant überschreiben, landing nur lp_layout
  const overrideLayout =
    surface === 'landing'
      ? (typeof safeOverrides.lp_layout === 'string' ? safeOverrides.lp_layout : undefined)
      : (typeof safeOverrides.layout_variant === 'string' ? safeOverrides.layout_variant : undefined)

  const layoutVariant =
    overrideLayout ??
    readCfgString(cfg, 'layout_variant') ??
    restaurant.layout_variant ??
    'cards'

  return {
    surface,
    colors,
    font,
    fontPairKey,
    layoutVariant,
    borderRadius: readCfgString(cfg, 'border_radius') ?? 'rounded',
    hoverEffect: readCfgString(cfg, 'hover_effect') ?? 'scale',
    animationStyle: readCfgString(cfg, 'animation_style') ?? 'fade',
    cardStyle: readCfgString(cfg, 'card_style') ?? 'elevated',
    name: restaurant.name ?? undefined,
    logoUrl: restaurant.logo_url ?? undefined,
    overrides: safeOverrides,
  }
}
```

> **Hinweis für Worker:** Falls `Restaurant` keine Felder `font_pair`/`layout_variant`/`design_package` typisiert, sind sie laut `color-utils.ts` faktisch vorhanden; nutze ggf. `(restaurant as Partial<Restaurant> & Record<string, any>)`. Prüfe zuerst `app/types/database.ts`.

- [ ] **Step 4: Tests laufen lassen → müssen bestehen**

Run: `npm test`
Expected: PASS (alle 6 Tests grün).

- [ ] **Step 5: Commit**

```bash
git add app/lib/resolve-brand.ts app/lib/__tests__/resolve-brand.test.ts
git commit -m "feat(brand): add resolveBrand — single source for guest-surface design"
```

---

## Task 2: `OrderV2` auf `resolveBrand` umstellen (risikoarm, beweist das Muster)

**Files:**
- Modify: `app/app/order/[token]/_v2/OrderV2.tsx` (Imports + ~Zeile 283–289)

- [ ] **Step 1: Import ergänzen**

In `OrderV2.tsx` bei den Imports (nach Zeile 8) hinzufügen:
```ts
import { resolveBrand } from '@/lib/resolve-brand'
```

- [ ] **Step 2: Design-Block ersetzen**

Ersetze den Block (~Zeile 283–289):
```ts
  const C = restaurant ? buildColorsFromRestaurant(restaurant) : buildColorsFromRestaurant({})

  const cfg = restaurant?.design_config ?? {}
  const fontPairKey = readCfgString(cfg, 'font_pair') ?? restaurant?.font_pair ?? getDesignPackage(restaurant?.design_package).fontPair
  const fontPair = (FONT_PAIRS[fontPairKey ?? ''] ?? FONT_PAIRS['syne-dmsans'])
```
durch:
```ts
  const brand = resolveBrand(restaurant ?? {}, 'order')
  const C = brand.colors
  const fontPair = brand.font
```

- [ ] **Step 3: Ungenutzte Imports entfernen**

Falls `buildColorsFromRestaurant`, `readCfgString`, `getDesignPackage`, `FONT_PAIRS` jetzt nirgends sonst in der Datei benutzt werden (mit Grep prüfen), die jeweiligen Import-Zeilen entfernen. Werden sie noch woanders genutzt, unverändert lassen.

Run: `grep -nE "buildColorsFromRestaurant|readCfgString|getDesignPackage|FONT_PAIRS" "app/app/order/[token]/_v2/OrderV2.tsx"`
Expected: nur noch der `resolveBrand`-Pfad nutzt sie indirekt; entferne tote Imports entsprechend dem Grep-Ergebnis.

- [ ] **Step 4: Build verifizieren**

Run (in `app/`): `npm run build`
Expected: Build erfolgreich, keine Type-Fehler in `OrderV2.tsx`.

- [ ] **Step 5: Visueller Parity-Check**

Starte Dev (`npm run dev`), öffne eine gültige `/order/<token>`-URL eines Restaurants mit gesetztem `design_config`. Vergleiche Primärfarbe, Hintergrund und Font mit dem Stand vor der Änderung — müssen identisch sein.

- [ ] **Step 6: Commit**

```bash
git add "app/app/order/[token]/_v2/OrderV2.tsx"
git commit -m "refactor(order): OrderV2 reads design via resolveBrand"
```

---

## Task 3: `BestellenV2` mit dem Brand verbinden (war Insellösung)

**Files:**
- Modify: `app/app/bestellen/[slug]/_v2/BestellenV2.tsx`

**Kontext:** `BestellenV2` nutzt aktuell eine lokale Konstante `V2.accent` + nur `restaurant.primary_color` und ignoriert `design_config` (Farben, Font, Hintergrund). Ziel: dieselbe Quelle wie `OrderV2`.

- [ ] **Step 1: Ist-Zustand lokalisieren**

Run: `grep -nE "V2\\.|primary_color|buildColors|FONT_PAIRS|design_config|fontFamily|background:" "app/app/bestellen/[slug]/_v2/BestellenV2.tsx" | head -40`
Notiere, wo `restaurant` verfügbar ist und wo Farb-/Font-Werte gesetzt werden (Top-Level-Render + `V2`-Konstante).

- [ ] **Step 2: Import + Brand-Ableitung ergänzen**

Import oben hinzufügen:
```ts
import { resolveBrand } from '@/lib/resolve-brand'
```
Dort, wo `restaurant` im Render verfügbar ist (analog zu OrderV2, nach dem Laden), einsetzen:
```ts
  const brand = resolveBrand(restaurant ?? {}, 'online')
  const C = brand.colors
  const fontPair = brand.font
```

- [ ] **Step 3: Lokale `V2.accent`/`primary_color`-Verwendungen ersetzen**

Ersetze Farb-/Font-Referenzen, die vorher auf `V2.accent`, `restaurant.primary_color ?? V2.accent` oder feste Strings zeigten, durch die `C.*`-Werte bzw. `fontPair`:
- Akzent/Buttons: `restaurant.primary_color ?? V2.accent` → `C.accent`
- Hintergrund-Container: feste Farbe → `C.bg`
- Karten/Flächen: → `C.surface`, `C.cardBg`, `C.border`
- Überschriften-Font: ergänze `fontFamily: \`${fontPair.heading}, system-ui, sans-serif\``, Body-Text `fontPair.body`.

Behalte `LoyaltyButton`/`LoyaltyBanner`-`accentColor`-Props, ersetze deren Wert durch `C.accent`:
```tsx
accentColor={C.accent}
```

- [ ] **Step 4: Build verifizieren**

Run (in `app/`): `npm run build`
Expected: Build erfolgreich.

- [ ] **Step 5: Visueller Parity-Check gegen die Tisch-Seite**

Dev starten, `/bestellen/<slug>` öffnen für ein Restaurant mit gesetztem `design_config`. Primärfarbe + Font müssen jetzt mit `/order/<token>` desselben Restaurants übereinstimmen.

- [ ] **Step 6: Commit**

```bash
git add "app/app/bestellen/[slug]/_v2/BestellenV2.tsx"
git commit -m "feat(online): BestellenV2 inherits brand via resolveBrand"
```

---

## Task 4: Öffentliche Landing-Page an den Brand anschließen (Haupt-Fix)

**Files:**
- Modify: `app/app/[slug]/info/page.tsx`

**Kontext:** Diese Server-Component nutzt eine hartkodierte `THEMES`-Map keyed by `template_slug` (`minimal-dark`, `warm-rustic`, …) und liest `restaurants.design_config` NICHT. Ziel: Farben/Fonts aus dem Brand-Kern; `landing_pages.content` liefert nur Overrides.

- [ ] **Step 1: Restaurant-Designfelder mitladen**

Finde die Supabase-Query, die das Restaurant lädt (Select mit `id, name, slug, description, logo_url`). Erweitere den Select um die Designfelder:
```ts
.select('id, name, slug, description, logo_url, design_config, primary_color, bg_color, surface_color, header_color, button_color, card_color, text_color, font_pair, layout_variant, design_package')
```
und passe das `RestaurantRow`-Interface entsprechend an (ergänze `design_config: Record<string, unknown> | null` und die optionalen Farb-/Font-Felder als `string | null`).

- [ ] **Step 2: `resolveBrand` statt `THEMES` verwenden**

Import ergänzen:
```ts
import { resolveBrand } from '@/lib/resolve-brand'
```
Ersetze die Theme-Auflösung (vorher `const theme = THEMES[landing.template_slug] ?? DEFAULT_THEME`) durch:
```ts
  const brand = resolveBrand(restaurant, 'landing', {
    hero_image_url: landing?.content?.hero_image_url,
    headline: landing?.content?.headline,
    subheadline: landing?.content?.subheadline,
    lp_layout: (landing?.content as Record<string, unknown>)?.lp_layout as string | undefined,
  })
  // Mapping auf die bisher genutzten Theme-Variablen:
  const theme = {
    bg: brand.colors.bg,
    text: brand.colors.text,
    accent: brand.colors.accent,
    muted: brand.colors.muted,
    card: brand.colors.cardBg,
    border: brand.colors.border,
  }
```
So bleiben alle bestehenden `theme.*`-Verwendungen im JSX unverändert funktionsfähig. Setze zusätzlich den Heading-Font, wo Überschriften gerendert werden: `fontFamily: \`${brand.font.heading}, system-ui, sans-serif\``.

- [ ] **Step 3: Tote `THEMES`/`DEFAULT_THEME` entfernen**

Lösche die `THEMES`-Konstante und `DEFAULT_THEME`, sofern nach Step 2 nicht mehr referenziert (mit Grep prüfen).

Run: `grep -nE "THEMES|DEFAULT_THEME" "app/app/[slug]/info/page.tsx"`
Expected: keine Treffer mehr → Block löschen.

- [ ] **Step 4: Build verifizieren**

Run (in `app/`): `npm run build`
Expected: Build erfolgreich.

- [ ] **Step 5: Visueller Parity-Check (3 Flächen identisch)**

Dev starten, für **dasselbe** Restaurant öffnen: `/order/<token>`, `/bestellen/<slug>`, `/<slug>/info`. Primärfarbe, Hintergrund-Grundton und Font müssen auf allen drei übereinstimmen. Das ist der „verbunden"-Beweis.

- [ ] **Step 6: Commit**

```bash
git add "app/app/[slug]/info/page.tsx"
git commit -m "feat(landing): public landing reads brand core via resolveBrand"
```

---

## Task 5: Landing-Editor — doppelte Farb-/Font-Quelle entfernen

**Files:**
- Modify: `app/app/admin/branding/LandingPageTab.tsx`

**Kontext:** Der Editor nutzt `DESIGN_PACKAGES` + ein `lp_design_package`-Feld als eigene Design-Quelle für die Vorschau. Da Farben/Fonts jetzt aus dem Kern kommen, soll der Editor den Kern als „geerbt" anzeigen statt eine zweite Wahl anzubieten.

- [ ] **Step 1: lp-Design-Picker-UI lokalisieren**

Run: `grep -nE "lp_design_package|DESIGN_PACKAGES|Design-Paket|Paket" "app/app/admin/branding/LandingPageTab.tsx"`
Notiere die UI-Stelle, an der ein Design-Paket für die Landing gewählt wird, und wo `lp_design_package` in `content` geschrieben wird.

- [ ] **Step 2: Picker durch Hinweis ersetzen**

Ersetze den Design-Paket-Auswahlblock durch einen statischen Hinweis (kein Schreiben von `lp_design_package` mehr):
```tsx
<div style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
  Farben &amp; Schriftart werden aus deinem <strong>Brand</strong> (Tab „Bestellseite") übernommen — so bleiben Landing- und Bestellseite immer einheitlich. Hier legst du nur Landing-spezifische Inhalte fest (Hero, Headline, Galerie, Layout).
</div>
```
Entferne die `lp_design_package`-Schreiblogik (das Feld wird nicht mehr gesetzt). Layout-Auswahl (`lp_layout`), Hero, Headline, Galerie etc. **bleiben** erhalten.

- [ ] **Step 3: Vorschau auf Kern-Farben umstellen (falls die Editor-Vorschau lokale Paket-Farben nutzt)**

Wenn die Vorschau-Komponente Farben aus dem gewählten `DESIGN_PACKAGES`-Eintrag zog, stelle sie auf die Restaurant-Kernfarben um (die der Editor bereits für den Bestellseiten-Tab kennt — denselben `design_config`-Wert verwenden). Ist das nicht trivial verfügbar, genügt für #1 eine neutrale Vorschau; die exakte Live-Vorschau ist Teil von #2.

- [ ] **Step 4: Tote `DESIGN_PACKAGES`-Imports entfernen (falls ungenutzt)**

Run: `grep -nE "DESIGN_PACKAGES" "app/app/admin/branding/LandingPageTab.tsx"`
Expected: bei keinen Treffern den Import entfernen.

- [ ] **Step 5: Build verifizieren**

Run (in `app/`): `npm run build`
Expected: Build erfolgreich.

- [ ] **Step 6: Commit**

```bash
git add "app/app/admin/branding/LandingPageTab.tsx"
git commit -m "refactor(branding): landing editor inherits brand core, drops duplicate design picker"
```

---

## Task 6: Apply-Route — Default-Layouts setzen (ohne Overrides zu zerstören)

**Files:**
- Modify: `app/app/api/design-templates/[id]/apply/route.ts`

**Kontext:** Die Route schreibt `design_config` bereits. Da alle Flächen jetzt live daraus lesen, restylt ein Apply automatisch alles. Einzige Ergänzung: sinnvolle Default-Layouts setzen, falls noch keine existieren — bestehende Overrides nie überschreiben.

- [ ] **Step 1: Landing-Default-Layout sicherstellen**

Direkt vor dem finalen `update(updatePayload)`-Aufruf einfügen: lade die vorhandene Landing-Zeile und setze `lp_layout` nur, falls leer.
```ts
  // Default-Landing-Layout setzen, falls noch keiner existiert (Overrides bleiben erhalten)
  const { data: lp } = await admin
    .from('landing_pages')
    .select('id, content')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  if (lp) {
    const content = (lp.content ?? {}) as Record<string, unknown>
    if (!content.lp_layout) {
      content.lp_layout = 'classic-hero'
      // lp_design_package wird bewusst NICHT mehr gesetzt (Kern liefert Farben/Fonts)
      await admin.from('landing_pages').update({ content }).eq('id', lp.id)
    }
  }
```

- [ ] **Step 2: Menü-Layout-Default**

`design_config.layout_variant` kommt aus der Template-`config` (bereits in `newConfig` enthalten). Kein zusätzlicher Schreibvorgang nötig. Verifiziere per Code-Review, dass `newConfig.layout_variant` aus `template.config` gesetzt ist; falls ein Template keines hat, ergänze Fallback:
```ts
  if (!(newConfig as Record<string, unknown>).layout_variant) {
    (newConfig as Record<string, unknown>).layout_variant = 'cards'
  }
```

- [ ] **Step 3: Build verifizieren**

Run (in `app/`): `npm run build`
Expected: Build erfolgreich.

- [ ] **Step 4: Manueller Funktionstest**

Dev starten, als Owner ein Template anwenden (Branding-Seite). Danach `/order`, `/bestellen`, `/<slug>/info` prüfen: alle zeigen die neuen Template-Farben; eine zuvor gesetzte Hero/Galerie auf der Landing bleibt erhalten.

- [ ] **Step 5: Commit**

```bash
git add "app/app/api/design-templates/[id]/apply/route.ts"
git commit -m "feat(apply): set default landing+menu layout without clobbering overrides"
```

---

## Task 7: Migration bestehender Restaurants (idempotent, mit Rollback-Sicherheit)

**Files:**
- Create: `supabase/migrations/20260612_064_unify_brand.sql`

**Kontext:** Altdaten bereinigen: leere `design_config` mit Default befüllen, `lp_design_package` aus `landing_pages.content` entfernen. Legacy-Spalten (`primary_color` etc.) bleiben als Rollback stehen. Idempotent: zweimaliges Ausführen ändert nichts.

- [ ] **Step 1: Migration schreiben**

Create `supabase/migrations/20260612_064_unify_brand.sql`:
```sql
-- Unify Brand (#1): Altdaten bereinigen.
-- Idempotent. Legacy-Spalten bleiben als Rollback erhalten.

-- 1. Leeres design_config mit Default-Look (modern-classic) befüllen.
UPDATE public.restaurants
SET design_config = jsonb_build_object(
  'primary_color',  '#FF6B2C',
  'bg_color',       '#080808',
  'surface_color',  '#131313',
  'header_color',   '#080808',
  'button_color',   '#FF6B2C',
  'card_color',     '#131313',
  'text_color',     '#f0ede8',
  'font_pair',      'syne-dmsans',
  'layout_variant', 'cards',
  'border_radius',  'rounded',
  'hover_effect',   'scale',
  'animation_style','fade',
  'card_style',     'elevated',
  'design_package', 'modern-classic'
)
WHERE design_config IS NULL OR design_config = '{}'::jsonb;

-- 2. lp_design_package aus landing_pages.content entfernen
--    (Farben/Fonts kommen jetzt aus dem Brand-Kern). Nur dieser Key.
UPDATE public.landing_pages
SET content = content - 'lp_design_package'
WHERE content ? 'lp_design_package';

-- 3. Default lp_layout setzen, falls keiner existiert (Overrides bleiben).
UPDATE public.landing_pages
SET content = jsonb_set(content, '{lp_layout}', '"classic-hero"', true)
WHERE NOT (content ? 'lp_layout');

-- 4. GRANTs (keine neuen Tabellen, daher nur zur Sicherheit no-op-Kommentar):
--    restaurants & landing_pages haben bereits GRANTs (Migration 047). Nichts zu tun.
```

- [ ] **Step 2: Idempotenz-Prüfung (lokal/Staging gegen Prod-Kopie)**

Wende die Migration auf eine **Kopie** der Produktionsdaten an, dann ein zweites Mal. Vergleiche `restaurants.design_config` und `landing_pages.content` zwischen Lauf 1 und Lauf 2 — müssen identisch sein.
```sql
-- Nach zweitem Lauf: keine Zeile darf lp_design_package mehr enthalten
SELECT count(*) FROM public.landing_pages WHERE content ? 'lp_design_package';  -- erwartet: 0
-- Kein Restaurant mit leerem design_config
SELECT count(*) FROM public.restaurants WHERE design_config IS NULL OR design_config = '{}'::jsonb;  -- erwartet: 0
```

- [ ] **Step 3: Visuelle Stichprobe nach Migration**

Auf der Prod-Kopie 2–3 Restaurants öffnen (`/order`, `/bestellen`, `/<slug>/info`). Keines darf „kaputt"/ungestylt aussehen; Landing erbt jetzt die Kernfarben.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260612_064_unify_brand.sql
git commit -m "feat(db): migrate restaurants to unified brand (idempotent, rollback-safe)"
```

---

## Self-Review (vom Plan-Autor durchgeführt)

**Spec-Coverage:**
- `resolveBrand`-Vertrag → Task 1 ✅
- Online + Landing erben Kern → Tasks 3, 4 ✅
- Tisch-Refactor (Muster) → Task 2 ✅
- Apply restylt alle Flächen → Tasks 2–4 (live-read) + Task 6 (Default-Layouts) ✅
- Landing-Editor verliert Doppel-Picker → Task 5 ✅
- `lp_design_package` als Farb-/Font-Quelle eliminiert → Tasks 4, 5, 7 ✅
- Idempotente Migration, Legacy-Spalten als Rollback → Task 7 ✅
- Tests: Resolver-Unit-Tests (Task 1) + Build/Parity-Checks (Tasks 2–4) ✅
- B-Modell mit gesperrten Feldern → Task 1 (`LOCKED_BRAND_KEYS`, Tests) ✅

**Placeholder-Scan:** Keine „TBD/TODO". Seiten-Refactors (Tasks 3–5) nennen exakte Dateien + konkrete Ersetzungen; wo Zeilennummern variieren, ist ein Grep-Lokalisierungs-Step vorangestellt (bewusst, da Dateien groß und versioniert sind).

**Typ-Konsistenz:** `ResolvedBrand` (Task 1) wird in Tasks 2–4 konsistent als `brand.colors` (ColorSet), `brand.font` (FontPair), `brand.layoutVariant` verwendet. `LOCKED_BRAND_KEYS` und `BrandSurface` einheitlich benannt.

**Out-of-Scope bestätigt:** Keine neuen Templates, kein Mobile-Redesign, keine Editor-Politik über das Entfernen des Doppel-Pickers hinaus, kein Löschen der Legacy-Spalten.
