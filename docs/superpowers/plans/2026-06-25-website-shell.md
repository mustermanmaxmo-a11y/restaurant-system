# Website-Dach (Shared Site Shell) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine geteilte, marken-getriebene Navigationsleiste (`SiteHeader`) + Footer (`SiteFooter`) über Landing-Seite (`/[slug]/info`) und Bestellseite (`/bestellen/[slug]`), damit sich beide wie *eine* Website anfühlen.

**Architecture:** Zwei präsentative Shell-Komponenten unter `app/components/site/`, gespeist von einer reinen Hilfsfunktion `buildSiteNav(slug, active)`. Beide Gast-Seiten nutzen dieselben `ColorSet`-Farben und `FontPair`-Fonts (beide Seiten bauen diese bereits über `buildColorsFromRestaurant`), daher nehmen die Komponenten `colors` + `font` als Props statt des vollen `ResolvedBrand`. Keine DB-Änderung, keine Routen-Umbenennung.

**Tech Stack:** Next.js 15 (App Router), TypeScript, React, Inline-Styles + ein kleiner scoped `<style>`-Block für Responsive, Vitest (node-Umgebung).

---

## Kontext für den Implementierer (unbedingt lesen)

- **Brand-Typen:**
  - `ColorSet` (`app/lib/color-utils.ts`): Felder u.a. `bg, surface, surface2, border, accent, accentSecondary, text, muted, headerBg, headerText, buttonBg, buttonText, cardBg`. **Es gibt KEIN `colors.primary`** — niemals verwenden.
  - `FontPair` (`app/lib/font-pairs.ts`): `{ heading: string; body: string; label: string }`. Werte sind CSS-`var(--font-…)`-Strings.
- **Landing-Seite** (`app/app/[slug]/info/page.tsx`) ist ein **Server-Component** mit `resolveBrand` → `brand.colors` (ColorSet) und `brand.font` (FontPair).
- **Bestellseite** (`app/app/bestellen/[slug]/_v1/BestellenV1.tsx`, 2216 Zeilen, `'use client'`) baut Farben als `const C = restaurant ? buildColorsFromRestaurant(restaurant) : buildColors()` (Zeile ~497) und Font als `brandFp` (Zeile ~1262). Sie hat einen eigenen „Willkommen bei"-Header (ab Zeile ~1290) — der bleibt; `SiteHeader` sitzt als Navi **darüber**. Sie hat bereits einen eigenen Footer (Zeile ~2172, „Powered by RestaurantOS") — der wird durch `SiteFooter` **ersetzt**.
- **Legal-Routen:** Es existieren `/impressum` und `/datenschutz` (NICHT `/legal/...`). Der aktuelle Landing-Footer verlinkt fälschlich auf `/legal/impressum` & `/legal/datenschutz` (tote Links). `SiteFooter` verlinkt korrekt auf `/impressum` & `/datenschutz` → behebt diesen Bug nebenbei.
- **Test-Setup:** Vitest, `environment: 'node'`, `include: ['lib/**/*.test.ts']` (nur `.test.ts` unter `lib/`). Es gibt **kein** Component-Rendering-Test-Setup (kein jsdom). → Reine Logik (`buildSiteNav`) wird per Vitest getestet (echtes TDD); die präsentativen Komponenten werden per `tsc --noEmit` + Build + manueller Sichtprüfung verifiziert. **Kein** jsdom/Testing-Library einführen (KISS, folgt bestehendem Muster).
- **Typecheck-Befehl:** Aus dem `app/`-Verzeichnis: `npx tsc --noEmit`. **Test-Befehl:** `npm test` (= `vitest run`).
- `.env.local` niemals lesen/schreiben.

---

## Dateienübersicht

- **Create** `app/lib/site-nav.ts` — reine Funktion `buildSiteNav(slug, active?)` + Typen `SiteNavKey`, `SiteNavItem`. Einzige Quelle der Navi-Links (DRY).
- **Create** `app/lib/__tests__/site-nav.test.ts` — Vitest-Tests für `buildSiteNav`.
- **Create** `app/components/site/SiteHeader.tsx` — sticky Navi (Client-Component wegen Hamburger-State).
- **Create** `app/components/site/SiteFooter.tsx` — geteilter Footer (präsentativ, kein State).
- **Modify** `app/app/[slug]/info/page.tsx` — `SiteHeader` oben, `SiteFooter` unten einhängen.
- **Modify** `app/components/landing/LandingPageSections.tsx` — eigenen Footer entfernen, `restaurantName`-Prop entfernen, `id="kontakt"` an Kontakt-Sektion.
- **Modify** `app/app/bestellen/[slug]/_v1/BestellenV1.tsx` — `SiteHeader` über den Willkommens-Header, bestehenden Footer durch `SiteFooter` ersetzen.

---

### Task 1: `buildSiteNav` — reine Navi-Logik (TDD)

**Files:**
- Create: `app/lib/site-nav.ts`
- Test: `app/lib/__tests__/site-nav.test.ts`

- [ ] **Step 1: Failing Test schreiben**

Datei `app/lib/__tests__/site-nav.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildSiteNav } from '@/lib/site-nav'

describe('buildSiteNav', () => {
  it('baut die vier Navi-Links mit dem slug', () => {
    const nav = buildSiteNav('pizzaroma')
    expect(nav.map(n => n.key)).toEqual(['start', 'speisekarte', 'reservieren', 'kontakt'])
    expect(nav.find(n => n.key === 'start')!.href).toBe('/pizzaroma/info')
    expect(nav.find(n => n.key === 'speisekarte')!.href).toBe('/bestellen/pizzaroma')
    expect(nav.find(n => n.key === 'reservieren')!.href).toBe('/bestellen/pizzaroma?tab=reserve')
    expect(nav.find(n => n.key === 'kontakt')!.href).toBe('/pizzaroma/info#kontakt')
  })

  it('markiert den aktiven Link', () => {
    const nav = buildSiteNav('x', 'speisekarte')
    expect(nav.find(n => n.key === 'speisekarte')!.active).toBe(true)
    expect(nav.find(n => n.key === 'start')!.active).toBe(false)
  })

  it('ohne active-Argument ist nichts aktiv', () => {
    const nav = buildSiteNav('x')
    expect(nav.every(n => n.active === false)).toBe(true)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd app && npm test -- site-nav`
Expected: FAIL — `Failed to resolve import "@/lib/site-nav"` (Datei existiert noch nicht).

- [ ] **Step 3: Implementierung schreiben**

Datei `app/lib/site-nav.ts`:

```ts
export type SiteNavKey = 'start' | 'speisekarte' | 'reservieren' | 'kontakt'

export interface SiteNavItem {
  key: SiteNavKey
  label: string
  href: string
  active: boolean
}

/**
 * Einzige Quelle der seitenübergreifenden Navigation (Website-Dach).
 * `active` markiert den Link der aktuellen Seite.
 */
export function buildSiteNav(slug: string, active?: SiteNavKey): SiteNavItem[] {
  const defs: { key: SiteNavKey; label: string; href: string }[] = [
    { key: 'start', label: 'Start', href: `/${slug}/info` },
    { key: 'speisekarte', label: 'Speisekarte', href: `/bestellen/${slug}` },
    { key: 'reservieren', label: 'Reservieren', href: `/bestellen/${slug}?tab=reserve` },
    { key: 'kontakt', label: 'Kontakt', href: `/${slug}/info#kontakt` },
  ]
  return defs.map(d => ({ ...d, active: d.key === active }))
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `cd app && npm test -- site-nav`
Expected: PASS (3 Tests grün).

- [ ] **Step 5: Commit**

```bash
git add app/lib/site-nav.ts app/lib/__tests__/site-nav.test.ts
git commit -m "feat(site-shell): add buildSiteNav helper with tests"
```

---

### Task 2: `SiteHeader` — sticky Navi-Komponente

**Files:**
- Create: `app/components/site/SiteHeader.tsx`

- [ ] **Step 1: Komponente schreiben**

Datei `app/components/site/SiteHeader.tsx`:

```tsx
'use client'

import { useState } from 'react'
import type { ColorSet } from '@/lib/color-utils'
import type { FontPair } from '@/lib/font-pairs'
import { buildSiteNav, type SiteNavKey } from '@/lib/site-nav'

interface SiteHeaderProps {
  colors: ColorSet
  font: FontPair
  slug: string
  restaurantName: string
  logoUrl?: string
  active?: SiteNavKey
}

export function SiteHeader({ colors, font, slug, restaurantName, logoUrl, active }: SiteHeaderProps) {
  const [open, setOpen] = useState(false)
  const nav = buildSiteNav(slug, active)

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: colors.bg,
      borderBottom: `1px solid ${colors.border}`,
      fontFamily: `${font.body}, system-ui, sans-serif`,
    }}>
      <style>{`
        .sh-desktop { display: flex; }
        .sh-burger { display: none; }
        @media (max-width: 768px) {
          .sh-desktop { display: none; }
          .sh-burger { display: flex; }
        }
      `}</style>

      <div style={{
        maxWidth: '1100px', margin: '0 auto', padding: '12px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
      }}>
        {/* Logo + Name → Start */}
        <a href={`/${slug}/info`} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', minWidth: 0 }}>
          {logoUrl && (
            <img src={logoUrl} alt="" style={{ width: '34px', height: '34px', objectFit: 'contain', borderRadius: '8px', flexShrink: 0 }} />
          )}
          <span style={{
            fontFamily: `${font.heading}, Georgia, serif`,
            fontWeight: 700, fontSize: '1.05rem', color: colors.text,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{restaurantName}</span>
        </a>

        {/* Desktop-Navi */}
        <nav className="sh-desktop" style={{ alignItems: 'center', gap: '24px' }}>
          {nav.map(item => (
            <a key={item.key} href={item.href} style={{
              fontSize: '0.85rem', fontWeight: item.active ? 700 : 500,
              color: item.active ? colors.accent : colors.text, textDecoration: 'none',
            }}>{item.label}</a>
          ))}
        </nav>

        {/* Mobiler Burger-Button */}
        <button
          className="sh-burger"
          onClick={() => setOpen(o => !o)}
          aria-label="Menü"
          aria-expanded={open}
          style={{
            background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: '8px',
            width: '38px', height: '38px', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: colors.text, flexShrink: 0, fontSize: '1.1rem',
          }}
        >☰</button>
      </div>

      {/* Mobiles Dropdown-Panel */}
      {open && (
        <nav className="sh-burger" style={{ flexDirection: 'column', borderTop: `1px solid ${colors.border}`, padding: '8px 20px 16px' }}>
          {nav.map(item => (
            <a key={item.key} href={item.href} onClick={() => setOpen(false)} style={{
              padding: '12px 0', fontSize: '0.95rem', fontWeight: item.active ? 700 : 500,
              color: item.active ? colors.accent : colors.text, textDecoration: 'none',
              borderBottom: `1px solid ${colors.border}`,
            }}>{item.label}</a>
          ))}
        </nav>
      )}
    </header>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: 0 Fehler.

- [ ] **Step 3: Commit**

```bash
git add app/components/site/SiteHeader.tsx
git commit -m "feat(site-shell): add SiteHeader sticky navigation"
```

---

### Task 3: `SiteFooter` — geteilter Footer

**Files:**
- Create: `app/components/site/SiteFooter.tsx`

- [ ] **Step 1: Komponente schreiben**

Datei `app/components/site/SiteFooter.tsx`:

```tsx
import type { ColorSet } from '@/lib/color-utils'
import type { FontPair } from '@/lib/font-pairs'

interface SiteFooterProps {
  colors: ColorSet
  font: FontPair
  restaurantName: string
}

export function SiteFooter({ colors, font, restaurantName }: SiteFooterProps) {
  return (
    <footer style={{ padding: '28px 24px', borderTop: `1px solid ${colors.border}`, textAlign: 'center', background: colors.bg }}>
      <div style={{ color: colors.muted, fontFamily: `${font.heading}, Georgia, serif`, fontStyle: 'italic', fontSize: '0.9rem', marginBottom: '10px' }}>
        {restaurantName}
      </div>
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <a href="/impressum" style={{ color: colors.muted, fontSize: '0.72rem', textDecoration: 'none' }}>Impressum</a>
        <a href="/datenschutz" style={{ color: colors.muted, fontSize: '0.72rem', textDecoration: 'none' }}>Datenschutz</a>
        <span style={{ color: colors.muted, fontSize: '0.72rem' }}>© {new Date().getFullYear()}</span>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: 0 Fehler.

- [ ] **Step 3: Commit**

```bash
git add app/components/site/SiteFooter.tsx
git commit -m "feat(site-shell): add shared SiteFooter (fixes dead /legal links)"
```

---

### Task 4: Shell in die Landing-Seite einhängen + LandingPageSections verschlanken

**Files:**
- Modify: `app/app/[slug]/info/page.tsx`
- Modify: `app/components/landing/LandingPageSections.tsx`

- [ ] **Step 1: Imports in `page.tsx` ergänzen**

In `app/app/[slug]/info/page.tsx`, direkt nach der Zeile
```tsx
import { LandingPageSections } from '@/components/landing/LandingPageSections'
```
einfügen:
```tsx
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
```

- [ ] **Step 2: Return-Block in `page.tsx` ersetzen**

Ersetze den gesamten `return ( … )`-Block (aktuell der `<div>` mit `LandingHero` + `LandingPageSections`) durch:

```tsx
  return (
    <div style={{
      fontFamily: `${brand.font.body}, system-ui, sans-serif`,
      background: brand.colors.bg,
      color: brand.colors.text,
    }}>
      <SiteHeader
        colors={brand.colors}
        font={brand.font}
        slug={resto.slug}
        restaurantName={resto.name}
        logoUrl={content.logo_url ?? resto.logo_url ?? undefined}
        active="start"
      />
      <LandingHero
        brand={brand}
        content={content}
        ctaHref={content.cta_url || `/bestellen/${resto.slug}`}
        restaurantName={resto.name}
        featuredItems={featuredItems}
      />
      <LandingPageSections
        brand={brand}
        content={content}
        slug={resto.slug}
        featuredItems={featuredItems}
      />
      <SiteFooter
        colors={brand.colors}
        font={brand.font}
        restaurantName={resto.name}
      />
    </div>
  )
```

(Beachte: `restaurantName` wird NICHT mehr an `LandingPageSections` übergeben — das wird in Step 3–5 entfernt.)

- [ ] **Step 3: `restaurantName` aus den Props von `LandingPageSections` entfernen**

In `app/components/landing/LandingPageSections.tsx`, im `interface Props`, die Zeile
```tsx
  restaurantName: string
```
löschen.

Und in der Funktionssignatur
```tsx
export function LandingPageSections({ brand, content, restaurantName, slug, featuredItems }: Props) {
```
ändern zu:
```tsx
export function LandingPageSections({ brand, content, slug, featuredItems }: Props) {
```

- [ ] **Step 4: `id="kontakt"` an die Kontakt-Sektion + Footer-Block entfernen**

In `app/components/landing/LandingPageSections.tsx`:

(a) Kontakt-Anker setzen. Ersetze
```tsx
      {(content.address || content.phone || content.email) && (
        <section style={sectionStyle}>
          <div style={innerStyle}>
            <div style={sectionLabel}>Kontakt & Anfahrt</div>
```
durch
```tsx
      {(content.address || content.phone || content.email) && (
        <section id="kontakt" style={sectionStyle}>
          <div style={innerStyle}>
            <div style={sectionLabel}>Kontakt & Anfahrt</div>
```

(b) Den kompletten Footer-Block entfernen. Lösche exakt:
```tsx
      {/* ── 10. Footer ── */}
      <footer style={{ padding: '28px 24px', borderTop: `1px solid ${colors.border}`, textAlign: 'center' }}>
        <div style={{ color: colors.muted, fontFamily: `${font.heading}, Georgia, serif`, fontStyle: 'italic', fontSize: '0.9rem', marginBottom: '10px' }}>
          {restaurantName}
        </div>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/legal/impressum" style={{ color: colors.muted, fontSize: '0.72rem', textDecoration: 'none' }}>Impressum</a>
          <a href="/legal/datenschutz" style={{ color: colors.muted, fontSize: '0.72rem', textDecoration: 'none' }}>Datenschutz</a>
          <span style={{ color: colors.muted, fontSize: '0.72rem' }}>© {new Date().getFullYear()}</span>
        </div>
      </footer>
```
Die abschließende `</>`-Fragment-Klammer und der `)` bleiben erhalten.

- [ ] **Step 5: Typecheck + bestehende Tests**

Run: `cd app && npx tsc --noEmit`
Expected: 0 Fehler (insbesondere KEIN „restaurantName is declared but never read" mehr und kein fehlendes-Prop-Fehler am Aufrufort).

Run: `cd app && npm test`
Expected: alle Tests grün (resolve-brand + site-nav).

- [ ] **Step 6: Manuelle Sichtprüfung**

Run: `cd app && npm run dev` (falls nicht schon laufend), dann im Browser `http://localhost:3000/<slug>/info` öffnen (ein vorhandenes, veröffentlichtes Restaurant, z.B. `italiener`).
Erwartet: Oben sticky Navi (Logo/Name links, Start·Speisekarte·Reservieren·Kontakt rechts; „Start" hervorgehoben). Unten der neue geteilte Footer mit funktionierenden `/impressum` & `/datenschutz`-Links. Klick auf „Kontakt" scrollt zur Kontakt-Sektion. Fenster schmal ziehen (<768px) → Navi-Links weichen einem ☰-Button, der ein Dropdown öffnet.

- [ ] **Step 7: Commit**

```bash
git add "app/app/[slug]/info/page.tsx" app/components/landing/LandingPageSections.tsx
git commit -m "feat(site-shell): wire SiteHeader/SiteFooter into landing page"
```

---

### Task 5: Shell in die Bestellseite einhängen

**Files:**
- Modify: `app/app/bestellen/[slug]/_v1/BestellenV1.tsx`

Die Komponente baut Farben als `C` (ColorSet, ~Zeile 497) und Font als `brandFp` (~Zeile 1262); beide sind im Scope des Haupt-`return` (ab ~Zeile 1286) verfügbar.

- [ ] **Step 1: Imports ergänzen**

In `app/app/bestellen/[slug]/_v1/BestellenV1.tsx`, nach der Zeile
```tsx
import SmartFilter from '../_components/SmartFilter'
```
einfügen:
```tsx
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
```

- [ ] **Step 2: `SiteHeader` über den bestehenden Willkommens-Header setzen**

Im Haupt-`return` (Menü-Ansicht). Ersetze
```tsx
    <div style={{ minHeight: '100vh', paddingBottom: pageTab === 'order' ? '100px' : '0', width: '100%', overflowX: 'hidden', ...brandVars, background: 'var(--bg)' }}>
      {/* Brand-Variablen jetzt inline oben am Wurzel-Div (siehe Kommentar) */}
      {/* Header */}
```
durch
```tsx
    <div style={{ minHeight: '100vh', paddingBottom: pageTab === 'order' ? '100px' : '0', width: '100%', overflowX: 'hidden', ...brandVars, background: 'var(--bg)' }}>
      {/* Brand-Variablen jetzt inline oben am Wurzel-Div (siehe Kommentar) */}
      <SiteHeader
        colors={C}
        font={brandFp}
        slug={slug}
        restaurantName={restaurant?.name ?? ''}
        logoUrl={restaurant?.logo_url ?? undefined}
        active={pageTab === 'reserve' ? 'reservieren' : 'speisekarte'}
      />
      {/* Header */}
```

- [ ] **Step 3: Bestehenden Footer durch `SiteFooter` ersetzen**

Ersetze den bestehenden Footer-Block
```tsx
      {/* Footer */}
      <div style={{ padding: '32px 24px 24px', textAlign: 'center', borderTop: '1px solid var(--border)', marginTop: '40px' }}>
        <p style={{ color: '#bbb', fontSize: '0.72rem', marginBottom: '8px', letterSpacing: '0.05em' }}>Powered by RestaurantOS</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
          <a href="/impressum" style={{ color: '#aaa', fontSize: '0.75rem', textDecoration: 'none' }}>Impressum</a>
          <a href="/datenschutz" style={{ color: '#aaa', fontSize: '0.75rem', textDecoration: 'none' }}>Datenschutz</a>
        </div>
      </div>
```
durch
```tsx
      {/* Footer (geteiltes Website-Dach) */}
      <SiteFooter colors={C} font={brandFp} restaurantName={restaurant?.name ?? ''} />
```

- [ ] **Step 4: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: 0 Fehler.

- [ ] **Step 5: Manuelle Sichtprüfung**

Im Browser `http://localhost:3000/bestellen/<slug>` öffnen.
Erwartet: Dieselbe sticky Navi oben (jetzt „Speisekarte" hervorgehoben), darunter der bekannte „Willkommen bei"-Header. Unten derselbe geteilte Footer wie auf der Landing-Seite. Über die Navi nach „Start" und zurück navigieren — durchgehend gleiches Dach. Mit `?tab=reserve` ist „Reservieren" hervorgehoben.

- [ ] **Step 6: Commit**

```bash
git add "app/app/bestellen/[slug]/_v1/BestellenV1.tsx"
git commit -m "feat(site-shell): wire SiteHeader/SiteFooter into ordering page"
```

---

## Final Verification (nach allen Tasks)

- [ ] **Typecheck:** `cd app && npx tsc --noEmit` → 0 Fehler.
- [ ] **Tests:** `cd app && npm test` → alle grün.
- [ ] **Build:** `cd app && npm run build` → erfolgreich.
- [ ] **Manuell:** Landing ↔ Bestellen über die Navi wechseln; Mobil-Hamburger auf beiden Seiten; Footer-Links `/impressum` & `/datenschutz` erreichbar; „Kontakt" scrollt/navigiert zur Kontakt-Sektion der Landing-Seite.

---

## Self-Review (durchgeführt)

**1. Spec-Abdeckung (Teilprojekt 1):**
- „SiteHeader.tsx (sticky, marken-getrieben, Navi: Start·Speisekarte·Reservieren·Kontakt, mobil Hamburger)" → Task 2 ✓
- „SiteFooter.tsx (heutigen Footer herauslösen → geteilt)" → Task 3 + Task 4 Step 4(b) ✓
- „Beide Gast-Seiten bekommen dasselbe Header/Footer" → Task 4 (Landing) + Task 5 (Bestellen) ✓
- „Footer aus LandingPageSections entfernen" → Task 4 Step 4(b) ✓
- „Routen werden NICHT umbenannt" → nur Komponenten hinzugefügt, keine Route geändert ✓
- Kontakt-Anker (`#kontakt`) nötig für Navi-Link → Task 4 Step 4(a) ✓

**2. Placeholder-Scan:** Keine TBD/TODO; alle Code-Schritte zeigen vollständigen Code; exakte Match-/Ersetz-Strings angegeben.

**3. Typ-Konsistenz:** `SiteNavKey` (Task 1) wird in `SiteHeader` (Task 2) und in den `active`-Props (Task 4/5) identisch verwendet. `colors: ColorSet` + `font: FontPair` einheitlich in Task 2/3 definiert und in Task 4/5 mit `brand.colors`/`brand.font` (Landing) bzw. `C`/`brandFp` (Bestellen) befüllt. `restaurantName`-Entfernung aus `LandingPageSections` ist in Props (Step 3), Aufrufort (Step 2) und Footer-Nutzung (Step 4b) konsistent erledigt.
