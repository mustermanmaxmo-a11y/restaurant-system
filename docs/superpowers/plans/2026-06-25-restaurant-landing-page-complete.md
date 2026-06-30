# Restaurant Landing Page — Vollständige Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle 5 Premium-Templates auf `/[slug]/info` zu vollständigen Restaurant-Websites ausbauen — mit Galerie, Featured Menu, Öffnungszeiten, Bewertungen, Reservierungs-CTA, Kontakt, Instagram und Footer.

**Architecture:** Hero-Komponenten rendern künftig nur noch ihren visuellen Block. Alle gemeinsamen Sektionen landen in `LandingPageSections.tsx`. Ein kanonischer `LandingPageContent`-Typ in `app/lib/landing-content.ts` ersetzt drei lokale Interface-Definitionen.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase Admin Client, Inline-Styles für brand-dynamische Werte.

---

## File Map

| Datei | Aktion | Zweck |
|-------|--------|-------|
| `app/lib/landing-content.ts` | **Erstellen** | Kanonischer Typ mit Review-Feldern |
| `app/lib/lp-layouts.ts` | **Ändern** | Re-export aus landing-content, LandingPageContent entfernen |
| `app/components/landing/types.ts` | **Ändern** | HeroContent → LandingPageContent aus landing-content |
| `app/components/landing/HeroClassicOverlay.tsx` | **Ändern** | Nur `<header>` hero block behalten |
| `app/components/landing/HeroBoldStatement.tsx` | **Ändern** | Nur header bar + statement + featured strip |
| `app/components/landing/HeroSplit.tsx` | **Ändern** | Nur split hero block |
| `app/components/landing/HeroCenteredMinimal.tsx` | **Ändern** | Nur centered hero header |
| `app/components/landing/HeroGradientGlow.tsx` | **Ändern** | Nur glows + header + statement + chips |
| `app/components/landing/LandingPageSections.tsx` | **Erstellen** | Alle 10 gemeinsamen Sektionen |
| `app/app/[slug]/info/page.tsx` | **Ändern** | Daten-Fetching erweitern + beide Komponenten rendern |
| `app/app/admin/branding/LandingPageTab.tsx` | **Ändern** | Review-Felder (Rating, Count, Maps-URL, 3 Zitate) ergänzen |

---

## Task 1: Kanonischen Typ erstellen

**Files:**
- Create: `app/lib/landing-content.ts`

- [ ] **Step 1: Datei erstellen**

```ts
// app/lib/landing-content.ts

export interface ReviewQuote {
  text: string
  author: string
  stars?: number
}

export interface OpeningHoursDay {
  open: boolean
  from?: string
  to?: string
}

export type OpeningHours = {
  mo?: OpeningHoursDay
  di?: OpeningHoursDay
  mi?: OpeningHoursDay
  do?: OpeningHoursDay
  fr?: OpeningHoursDay
  sa?: OpeningHoursDay
  so?: OpeningHoursDay
}

export interface LandingPageContent {
  // Hero
  logo_url?: string
  hero_image_url?: string
  headline?: string
  subheadline?: string
  about_text?: string
  cta_text?: string
  cta_url?: string
  lp_design_package?: string
  lp_layout?: string

  // Kontakt
  address?: string
  maps_url?: string
  phone?: string
  email?: string
  instagram?: string
  facebook?: string

  // Galerie
  gallery?: string[]

  // Features
  feature_badges?: string[]

  // Bewertungen
  review_url?: string
  google_rating?: number
  google_review_count?: number
  google_maps_url?: string
  review_quotes?: ReviewQuote[]

  // Öffnungszeiten
  opening_hours?: OpeningHours
}
```

- [ ] **Step 2: TypeScript-Fehler prüfen**

```bash
cd app && npx tsc --noEmit 2>&1 | head -30
```

Erwartung: Noch 0 Fehler (nur neue Datei, nichts geändert).

- [ ] **Step 3: Commit**

```bash
git add app/lib/landing-content.ts
git commit -m "feat(landing): add canonical LandingPageContent type with review fields"
```

---

## Task 2: `lp-layouts.ts` auf Re-Export umstellen

**Files:**
- Modify: `app/lib/lp-layouts.ts`

- [ ] **Step 1: Alten `LandingPageContent`-Block und `OpeningHours`-Block entfernen und re-exportieren**

Ersetze den gesamten Inhalt von `app/lib/lp-layouts.ts` durch:

```ts
// app/lib/lp-layouts.ts
export { LandingPageContent, OpeningHours, OpeningHoursDay, ReviewQuote } from './landing-content'
export type { LandingPageContent, OpeningHours, OpeningHoursDay, ReviewQuote } from './landing-content'

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

> **Hinweis:** TypeScript erlaubt kein doppeltes export+export type in einem Statement. Benutze nur `export type { ... }` wenn du Typen aus einem anderen Modul re-exportierst. Wenn `LandingPageContent` als value verwendet wird (z.B. `instanceof`), bleibt export. Da es nur ein Interface ist: nur `export type`.

Korrekte Version:

```ts
// app/lib/lp-layouts.ts
export type { LandingPageContent, OpeningHours, OpeningHoursDay, ReviewQuote } from './landing-content'

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
cd app && npx tsc --noEmit 2>&1 | head -40
```

Erwartung: 0 Fehler. Wenn Fehler über `LandingPageContent` aus `lp-layouts`: alle Imports bleiben funktionsfähig durch den re-export.

- [ ] **Step 3: Commit**

```bash
git add app/lib/lp-layouts.ts
git commit -m "refactor(landing): lp-layouts re-exports LandingPageContent from landing-content"
```

---

## Task 3: `types.ts` auf `LandingPageContent` umstellen

**Files:**
- Modify: `app/components/landing/types.ts`

Die Datei hat derzeit `HeroContent` mit nur 5 Feldern. `HeroProps` benutzt `HeroContent`. Wir ersetzen `HeroContent` durch `LandingPageContent`.

- [ ] **Step 1: types.ts aktualisieren**

```ts
// app/components/landing/types.ts
import type { ResolvedBrand } from '@/lib/resolve-brand'
import type { LandingPageContent } from '@/lib/landing-content'

export type { LandingPageContent }

export interface FeaturedItem {
  id: string
  name: string
  price: number
  image_url: string | null
}

export interface HeroProps {
  brand: ResolvedBrand
  content: LandingPageContent
  ctaHref: string
  restaurantName: string
  featuredItems?: FeaturedItem[]
}
```

- [ ] **Step 2: TypeScript prüfen**

```bash
cd app && npx tsc --noEmit 2>&1 | head -40
```

Erwartung: 0 Fehler. Die Hero-Komponenten bekommen jetzt alle neuen Felder über `content`, auch wenn sie sie noch nicht nutzen.

- [ ] **Step 3: Commit**

```bash
git add app/components/landing/types.ts
git commit -m "refactor(landing): HeroProps uses LandingPageContent instead of HeroContent"
```

---

## Task 4: `HeroClassicOverlay` auf reinen Hero-Block reduzieren

**Files:**
- Modify: `app/components/landing/HeroClassicOverlay.tsx`

Entfernen: Info-Strip (Zeilen 89–113), About (115–121), Menu CTA (123–134), Footer (136–138).  
Behalten: Nur den `<header>` Block (Zeilen 11–87).  
Der äußere `<div>` entfällt — `page.tsx` liefert den Wrapper.

- [ ] **Step 1: Datei auf Hero-Block reduzieren**

```tsx
// app/components/landing/HeroClassicOverlay.tsx
import type { HeroProps } from './types'

export function HeroClassicOverlay({ brand, content, ctaHref, restaurantName }: HeroProps) {
  const { colors, font } = brand
  const heading = content.headline || restaurantName
  const hasImage = Boolean(content.hero_image_url)

  return (
    <header style={{
      position: 'relative',
      minHeight: 'clamp(320px, 50vw, 480px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '64px 24px',
      textAlign: 'center',
      overflow: 'hidden',
      background: hasImage
        ? `url(${content.hero_image_url}) center/cover no-repeat`
        : `linear-gradient(160deg, ${colors.accent}18 0%, ${colors.bg} 100%)`,
    }}>
      {hasImage && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.65) 100%)',
        }} />
      )}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '600px', width: '100%' }}>
        <div style={{
          color: hasImage ? 'rgba(255,255,255,0.7)' : colors.muted,
          fontSize: '0.65rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginBottom: '16px',
        }}>
          {content.subheadline ? '' : 'Willkommen'}
        </div>
        <h1 style={{
          fontFamily: `${font.heading}, Georgia, serif`,
          fontSize: 'clamp(2.2rem, 7vw, 4rem)',
          fontWeight: 700,
          fontStyle: 'italic',
          lineHeight: 1.1,
          color: hasImage ? '#ffffff' : colors.text,
          letterSpacing: '-0.01em',
          marginBottom: '12px',
          textShadow: hasImage ? '0 2px 10px rgba(0,0,0,0.5)' : 'none',
        }}>
          {heading}
        </h1>
        <div style={{
          width: '48px', height: '1.5px',
          background: colors.accent,
          margin: '16px auto',
          opacity: 0.8,
        }} />
        {content.subheadline && (
          <p style={{
            color: hasImage ? 'rgba(255,255,255,0.85)' : colors.muted,
            fontSize: '1rem',
            lineHeight: 1.6,
            marginBottom: '28px',
            textShadow: hasImage ? '0 1px 4px rgba(0,0,0,0.4)' : 'none',
          }}>
            {content.subheadline}
          </p>
        )}
        <a href={ctaHref} style={{
          display: 'inline-block',
          padding: '14px 36px',
          borderRadius: '6px',
          background: colors.buttonBg,
          color: colors.buttonText,
          fontWeight: 700,
          fontSize: '0.9rem',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          boxShadow: `0 4px 20px ${colors.accent}44`,
          textDecoration: 'none',
        }}>
          {content.cta_text || 'Jetzt bestellen'}
        </a>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: TypeScript prüfen**

```bash
cd app && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/components/landing/HeroClassicOverlay.tsx
git commit -m "refactor(landing): HeroClassicOverlay renders only the visual hero block"
```

---

## Task 5: `HeroBoldStatement` auf reinen Hero-Block reduzieren

**Files:**
- Modify: `app/components/landing/HeroBoldStatement.tsx`

Entfernen: About-Sektion (Zeilen 71–76), Footer (78–80).  
Behalten: Header bar + Statement + Featured preview strip.  
Äußeren `<div>` behalten aber `minHeight: '100vh'`, `background`, `color` entfernen — kommt vom page-Wrapper.

- [ ] **Step 1: Datei aktualisieren**

```tsx
// app/components/landing/HeroBoldStatement.tsx
import type { HeroProps } from './types'

export function HeroBoldStatement({ brand, content, ctaHref, restaurantName, featuredItems = [] }: HeroProps) {
  const { colors, font } = brand
  const lines = (content.headline || restaurantName).split(' ')
  const firstWord = lines[0] ?? restaurantName
  const restWords = lines.slice(1).join(' ')

  return (
    <div>
      {/* ── Header bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: '12px', borderBottom: `1px solid ${colors.border}` }}>
        {brand.logoUrl && (
          <img src={brand.logoUrl} alt={restaurantName} style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }} />
        )}
        <span style={{ fontFamily: `${font.heading}, system-ui, sans-serif`, fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.05em' }}>{restaurantName}</span>
        <div style={{ marginLeft: 'auto', background: colors.accent, color: colors.buttonText, fontSize: '0.65rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px' }}>OFFEN</div>
      </div>

      {/* ── Statement ── */}
      <div style={{ padding: '36px 20px 24px' }}>
        <div style={{ fontFamily: `${font.heading}, system-ui, sans-serif`, fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.03em' }}>
          <div style={{ fontSize: 'clamp(3rem, 12vw, 5.5rem)', color: colors.text }}>{firstWord}</div>
          {restWords && (
            <div style={{ fontSize: 'clamp(3rem, 12vw, 5.5rem)', color: colors.accent }}>{restWords}.</div>
          )}
        </div>
        {content.subheadline && (
          <div style={{ color: colors.muted, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '16px' }}>
            {content.subheadline}
          </div>
        )}
        <a href={ctaHref} style={{
          display: 'inline-block', marginTop: '24px',
          padding: '14px 32px', borderRadius: '10px',
          background: colors.buttonBg, color: colors.buttonText,
          fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.02em',
          textDecoration: 'none',
          boxShadow: `0 4px 24px ${colors.accent}44`,
        }}>
          {content.cta_text || 'Jetzt bestellen'}
        </a>
      </div>

      {/* ── Featured preview strip ── */}
      {featuredItems.length > 0 && (
        <div style={{ padding: '0 20px 32px' }}>
          <div style={{ fontSize: '0.6rem', color: colors.muted, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '12px' }}>Highlights</div>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '4px' }}>
            {featuredItems.map(item => (
              <a key={item.id} href={ctaHref} style={{
                flexShrink: 0, width: '120px',
                background: colors.surface, borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                overflow: 'hidden', textDecoration: 'none',
              }}>
                {item.image_url
                  ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '70px', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '70px', background: colors.surface2 }} />
                }
                <div style={{ padding: '8px' }}>
                  <div style={{ color: colors.text, fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                  <div style={{ color: colors.accent, fontSize: '0.7rem', fontWeight: 800, marginTop: '2px' }}>{item.price.toFixed(2).replace('.', ',')} €</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript prüfen**

```bash
cd app && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/components/landing/HeroBoldStatement.tsx
git commit -m "refactor(landing): HeroBoldStatement renders only hero block, strips about+footer"
```

---

## Task 6: `HeroSplit` auf reinen Hero-Block reduzieren

**Files:**
- Modify: `app/components/landing/HeroSplit.tsx`

Entfernen: Category underline nav (Zeilen 62–74), About (76–80), Footer (82–84).  
Behalten: Nur den Split-Hero-Flex-Block.

- [ ] **Step 1: Datei aktualisieren**

```tsx
// app/components/landing/HeroSplit.tsx
import type { HeroProps } from './types'

export function HeroSplit({ brand, content, ctaHref, restaurantName }: HeroProps) {
  const { colors, font } = brand
  const heading = content.headline || restaurantName

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: 'clamp(360px, 55vw, 520px)' }}>
      {/* Left: text column */}
      <div style={{
        flex: '1 1 300px', padding: '56px 40px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        borderRight: `1px solid ${colors.border}`,
      }}>
        <div>
          <div style={{ color: colors.muted, fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '32px' }}>
            Speisekarte & Bestellung
          </div>
          <h1 style={{
            fontFamily: `${font.heading}, system-ui, sans-serif`,
            fontSize: 'clamp(2rem, 5vw, 3.2rem)',
            fontWeight: 200,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            color: colors.text,
            marginBottom: '24px',
          }}>
            {heading}
          </h1>
          {content.subheadline && (
            <p style={{ color: colors.muted, fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '32px' }}>
              {content.subheadline}
            </p>
          )}
        </div>
        <div>
          <div style={{ color: colors.muted, fontSize: '0.72rem', marginBottom: '16px' }}>Di–So · 12–22 Uhr</div>
          <a href={ctaHref} style={{
            display: 'inline-block', padding: '12px 28px',
            border: `1.5px solid ${colors.text}`,
            color: colors.text, fontWeight: 600,
            fontSize: '0.82rem', letterSpacing: '0.08em',
            textTransform: 'uppercase', textDecoration: 'none',
          }}>
            {content.cta_text || 'Bestellen'}
          </a>
        </div>
      </div>

      {/* Right: image */}
      <div style={{ flex: '1 1 300px', background: colors.surface2, position: 'relative', overflow: 'hidden', minHeight: '260px' }}>
        {content.hero_image_url
          ? <img src={content.hero_image_url} alt={heading} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
          : <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${colors.surface2}, ${colors.border})` }} />
        }
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript prüfen + Commit**

```bash
cd app && npx tsc --noEmit 2>&1 | head -20
git add app/components/landing/HeroSplit.tsx
git commit -m "refactor(landing): HeroSplit renders only split hero block"
```

---

## Task 7: `HeroCenteredMinimal` auf reinen Hero-Block reduzieren

**Files:**
- Modify: `app/components/landing/HeroCenteredMinimal.tsx`

Entfernen: About (Zeilen 72–77), Menu CTA (79–87), Footer (89–91).  
Behalten: Nur den zentrierten `<header>` mit Logo, Status-Pill, H1, CTA-Button, Dietary Tags.

- [ ] **Step 1: Datei aktualisieren**

```tsx
// app/components/landing/HeroCenteredMinimal.tsx
import type { HeroProps } from './types'

const DIETARY_TAGS = ['🌱 Vegan', '🌾 Glutenfrei', '♻️ Bio', '🥦 Regional']

export function HeroCenteredMinimal({ brand, content, ctaHref, restaurantName }: HeroProps) {
  const { colors, font } = brand
  const heading = content.headline || restaurantName
  const radius = '999px'

  return (
    <header style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '72px 24px 48px', textAlign: 'center' }}>
      {brand.logoUrl && (
        <img src={brand.logoUrl} alt={restaurantName} style={{ width: '64px', height: '64px', borderRadius: '16px', objectFit: 'cover', marginBottom: '24px' }} />
      )}

      {/* Status pill */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        background: `${colors.accent}18`, border: `1px solid ${colors.accent}40`,
        borderRadius: radius, padding: '5px 14px', marginBottom: '24px',
      }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors.accent }} />
        <span style={{ color: colors.accent, fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.05em' }}>Küche geöffnet</span>
      </div>

      <h1 style={{
        fontFamily: `${font.heading}, system-ui, sans-serif`,
        fontSize: 'clamp(2rem, 6vw, 3.5rem)',
        fontWeight: 600,
        color: colors.text,
        lineHeight: 1.15,
        letterSpacing: '-0.02em',
        marginBottom: '12px',
      }}>
        {heading}
      </h1>

      {content.subheadline && (
        <p style={{ color: colors.muted, fontSize: '0.95rem', lineHeight: 1.6, maxWidth: '400px', marginBottom: '28px' }}>
          {content.subheadline}
        </p>
      )}

      <a href={ctaHref} style={{
        display: 'inline-block', padding: '14px 36px',
        borderRadius: radius,
        background: colors.buttonBg, color: colors.buttonText,
        fontWeight: 600, fontSize: '0.9rem',
        textDecoration: 'none',
        marginBottom: '28px',
      }}>
        {content.cta_text || 'Jetzt bestellen'}
      </a>

      {/* Dietary tags */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {DIETARY_TAGS.map(tag => (
          <span key={tag} style={{
            background: `${colors.accent}14`,
            border: `1px solid ${colors.accent}30`,
            borderRadius: radius, padding: '4px 12px',
            color: colors.text, fontSize: '0.72rem',
          }}>
            {tag}
          </span>
        ))}
      </div>
    </header>
  )
}
```

- [ ] **Step 2: TypeScript prüfen + Commit**

```bash
cd app && npx tsc --noEmit 2>&1 | head -20
git add app/components/landing/HeroCenteredMinimal.tsx
git commit -m "refactor(landing): HeroCenteredMinimal renders only centered hero header"
```

---

## Task 8: `HeroGradientGlow` auf reinen Hero-Block reduzieren

**Files:**
- Modify: `app/components/landing/HeroGradientGlow.tsx`

Entfernen: About (Zeilen 75–79), Footer (81–83).  
Behalten: Ambient glows + Header bar + Statement + Category chips — alles innerhalb des `position: relative, zIndex: 1` Wrappers.

- [ ] **Step 1: Datei aktualisieren**

```tsx
// app/components/landing/HeroGradientGlow.tsx
import type { HeroProps } from './types'

export function HeroGradientGlow({ brand, content, ctaHref, restaurantName }: HeroProps) {
  const { colors, font } = brand
  const secondary = colors.accentSecondary
  const heading = content.headline || restaurantName
  const lines = heading.split(' ')
  const firstLine = lines.slice(0, Math.ceil(lines.length / 2)).join(' ')
  const secondLine = lines.slice(Math.ceil(lines.length / 2)).join(' ')

  const gradientBg = `linear-gradient(90deg, ${secondary}, ${colors.accent})`

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* ── Ambient glows ── */}
      <div style={{ position: 'fixed', top: '-100px', right: '-80px', width: '300px', height: '300px', borderRadius: '50%', background: `radial-gradient(circle, ${colors.accent}30 0%, transparent 70%)`, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-60px', left: '40px', width: '200px', height: '200px', borderRadius: '50%', background: `radial-gradient(circle, ${secondary}25 0%, transparent 70%)`, pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {brand.logoUrl && <img src={brand.logoUrl} alt={restaurantName} style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }} />}
            <span style={{ fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.02em' }}>{restaurantName}</span>
          </div>
          <div style={{ background: `${colors.accent}22`, border: `1px solid ${colors.accent}44`, color: colors.accent, fontSize: '0.6rem', padding: '3px 10px', borderRadius: '20px', fontWeight: 700 }}>OFFEN</div>
        </div>

        {/* ── Statement hero ── */}
        <div style={{ padding: '32px 20px 28px' }}>
          <div style={{ fontFamily: `${font.heading}, system-ui, sans-serif`, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em', fontSize: 'clamp(2.5rem, 10vw, 4.5rem)' }}>
            <div>{firstLine}</div>
            {secondLine && (
              <div style={{
                background: gradientBg,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              } as React.CSSProperties}>
                {secondLine}
              </div>
            )}
          </div>
          {content.subheadline && (
            <div style={{ color: colors.muted, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '16px' }}>{content.subheadline}</div>
          )}
          <a href={ctaHref} style={{
            display: 'inline-block', marginTop: '24px',
            padding: '14px 32px', borderRadius: '10px',
            background: gradientBg,
            color: '#ffffff',
            fontWeight: 700, fontSize: '0.9rem',
            textDecoration: 'none',
            boxShadow: `0 4px 24px ${colors.accent}44`,
          }}>
            {content.cta_text || 'Jetzt bestellen'}
          </a>
        </div>

        {/* ── Category chips ── */}
        <div style={{ display: 'flex', gap: '8px', padding: '0 20px 28px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {['Alles', 'Empfehlungen', 'Gerichte', 'Getränke'].map((cat, i) => (
            <div key={cat} style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: '20px', fontSize: '0.72rem',
              background: i === 0 ? gradientBg : `${colors.accent}12`,
              border: i === 0 ? 'none' : `1px solid ${colors.accent}30`,
              color: i === 0 ? '#fff' : colors.accent,
              fontWeight: i === 0 ? 700 : 400,
            }}>
              {cat}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript prüfen + Commit**

```bash
cd app && npx tsc --noEmit 2>&1 | head -20
git add app/components/landing/HeroGradientGlow.tsx
git commit -m "refactor(landing): HeroGradientGlow renders only glow+header+statement+chips"
```

---

## Task 9: `LandingPageSections.tsx` erstellen

**Files:**
- Create: `app/components/landing/LandingPageSections.tsx`

Dies ist der Kern des Features. Alle 10 gemeinsamen Sektionen, template-unabhängig.

Sektionen (Reihenfolge):
1. Info-Strip (immer)
2. Galerie (wenn `gallery?.length > 0`)
3. Featured Menu (wenn `featuredItems.length > 0`)
4. Über uns (wenn `about_text`)
5. Öffnungszeiten (wenn mindestens 1 Tag gesetzt)
6. Bewertungen (wenn `google_rating` gesetzt)
7. Reservierung CTA (immer)
8. Kontakt & Anfahrt (wenn `address || phone || email`)
9. Instagram (wenn `instagram`)
10. Footer (immer)

- [ ] **Step 1: Datei erstellen**

```tsx
// app/components/landing/LandingPageSections.tsx
import type { ResolvedBrand } from '@/lib/resolve-brand'
import type { LandingPageContent, OpeningHours } from '@/lib/landing-content'
import type { FeaturedItem } from './types'

interface Props {
  brand: ResolvedBrand
  content: LandingPageContent
  restaurantName: string
  slug: string
  featuredItems: FeaturedItem[]
}

const DAY_LABELS: Record<string, string> = {
  mo: 'Montag', di: 'Dienstag', mi: 'Mittwoch', do: 'Donnerstag',
  fr: 'Freitag', sa: 'Samstag', so: 'Sonntag',
}
const DAY_ORDER = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so']

function getTodayKey(): string {
  return DAY_ORDER[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]
}

function hasAnyOpeningHours(oh: OpeningHours): boolean {
  return DAY_ORDER.some(d => oh[d as keyof OpeningHours] !== undefined)
}

export function LandingPageSections({ brand, content, restaurantName, slug, featuredItems }: Props) {
  const { colors, font } = brand
  const todayKey = getTodayKey()

  const sectionStyle = {
    padding: '40px 24px',
    borderTop: `1px solid ${colors.border}`,
  }
  const innerStyle = {
    maxWidth: '680px',
    margin: '0 auto',
  }
  const sectionLabel = {
    fontSize: '0.65rem' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    color: colors.accent,
    marginBottom: '20px',
    fontWeight: 700,
  }

  return (
    <>
      {/* ── 1. Info-Strip ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1px 1fr 1px 1fr',
        background: colors.surface,
        borderTop: `1px solid ${colors.border}`,
        borderBottom: `1px solid ${colors.border}`,
        padding: '16px 24px',
      }}>
        {(() => {
          const today = content.opening_hours?.[todayKey as keyof OpeningHours]
          const todayStr = today?.open && today.from && today.to ? `${today.from}–${today.to} Uhr` : today?.open === false ? 'Geschlossen' : '–'
          return [
            { label: 'Heute', value: todayStr },
            null,
            { label: 'Küche', value: today?.open === false ? 'Geschlossen' : 'Geöffnet' },
            null,
            { label: 'Bestellung', value: 'Am Tisch & Online' },
          ].map((item, i) =>
            item === null
              ? <div key={i} style={{ background: colors.border }} />
              : (
                <div key={i} style={{ textAlign: 'center', padding: '0 12px' }}>
                  <div style={{ color: colors.muted, fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>{item.label}</div>
                  <div style={{ color: colors.text, fontSize: '0.82rem', fontWeight: 700 }}>{item.value}</div>
                </div>
              )
          )
        })()}
      </div>

      {/* ── 2. Galerie ── */}
      {(content.gallery ?? []).length > 0 && (
        <section style={sectionStyle}>
          <div style={innerStyle}>
            <div style={sectionLabel}>Unsere Küche</div>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '4px' }}>
              {content.gallery!.map((url, i) => (
                <img key={i} src={url} alt="" style={{
                  flexShrink: 0, width: '160px', height: '120px',
                  objectFit: 'cover', borderRadius: '10px',
                }} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 3. Featured Menu ── */}
      {featuredItems.length > 0 && (
        <section style={sectionStyle}>
          <div style={innerStyle}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={sectionLabel}>Highlights</div>
              <a href={`/bestellen/${slug}`} style={{ fontSize: '0.75rem', color: colors.accent, textDecoration: 'none' }}>Zur Speisekarte →</a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {featuredItems.slice(0, 4).map(item => (
                <a key={item.id} href={`/bestellen/${slug}`} style={{ textDecoration: 'none', background: colors.surface, borderRadius: '10px', border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '110px', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '110px', background: colors.surface2 }} />
                  }
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ color: colors.text, fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px' }}>{item.name}</div>
                    <div style={{ color: colors.accent, fontSize: '0.8rem', fontWeight: 800 }}>{item.price.toFixed(2).replace('.', ',')} €</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Über uns ── */}
      {content.about_text && (
        <section style={sectionStyle}>
          <div style={innerStyle}>
            <h2 style={{ fontFamily: `${font.heading}, Georgia, serif`, fontStyle: 'italic', fontSize: '1.6rem', color: colors.text, marginBottom: '14px', fontWeight: 700 }}>Über uns</h2>
            <p style={{ color: colors.muted, lineHeight: 1.8, fontSize: '0.95rem' }}>{content.about_text}</p>
          </div>
        </section>
      )}

      {/* ── 5. Öffnungszeiten ── */}
      {content.opening_hours && hasAnyOpeningHours(content.opening_hours) && (
        <section style={sectionStyle}>
          <div style={innerStyle}>
            <div style={sectionLabel}>Öffnungszeiten</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {DAY_ORDER.map(dayKey => {
                  const day = content.opening_hours![dayKey as keyof OpeningHours]
                  if (!day) return null
                  const isToday = dayKey === todayKey
                  return (
                    <tr key={dayKey} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: '10px 0', fontSize: '0.85rem', color: colors.text, fontWeight: isToday ? 700 : 400, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isToday && (
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: day.open ? colors.accent : '#ef4444', display: 'inline-block', flexShrink: 0 }} />
                        )}
                        {!isToday && <span style={{ width: '7px', display: 'inline-block', flexShrink: 0 }} />}
                        {DAY_LABELS[dayKey]}
                      </td>
                      <td style={{ padding: '10px 0', fontSize: '0.85rem', color: day.open ? colors.text : colors.muted, textAlign: 'right', fontWeight: isToday ? 700 : 400 }}>
                        {day.open && day.from && day.to ? `${day.from} – ${day.to} Uhr` : 'Geschlossen'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 6. Bewertungen ── */}
      {content.google_rating != null && (
        <section style={{ ...sectionStyle, background: colors.surface }}>
          <div style={innerStyle}>
            <div style={sectionLabel}>Bewertungen</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div style={{ fontFamily: `${font.heading}, Georgia, serif`, fontSize: '3.5rem', fontWeight: 700, color: colors.text, lineHeight: 1 }}>
                {content.google_rating.toFixed(1)}
              </div>
              <div>
                <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
                  {[1,2,3,4,5].map(s => (
                    <span key={s} style={{ color: s <= Math.round(content.google_rating!) ? '#f59e0b' : colors.border, fontSize: '1rem' }}>★</span>
                  ))}
                </div>
                {content.google_review_count && (
                  <div style={{ color: colors.muted, fontSize: '0.78rem' }}>{content.google_review_count} Google-Bewertungen</div>
                )}
              </div>
            </div>
            {(content.review_quotes ?? []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {content.review_quotes!.slice(0, 3).map((q, i) => (
                  <div key={i} style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '14px 16px' }}>
                    <div style={{ color: colors.text, fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '8px' }}>"{q.text}"</div>
                    <div style={{ color: colors.muted, fontSize: '0.72rem', fontWeight: 600 }}>— {q.author}</div>
                  </div>
                ))}
              </div>
            )}
            {content.google_maps_url && (
              <a href={content.google_maps_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '16px', color: colors.accent, fontSize: '0.78rem', textDecoration: 'none' }}>
                Alle Bewertungen auf Google lesen →
              </a>
            )}
          </div>
        </section>
      )}

      {/* ── 7. Reservierung CTA ── */}
      <section style={{ padding: '56px 24px', background: colors.primary ?? colors.accent, textAlign: 'center' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '12px' }}>Reservierung</div>
          <h2 style={{ fontFamily: `${font.heading}, Georgia, serif`, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 700, fontStyle: 'italic', color: '#ffffff', marginBottom: '12px' }}>
            Tisch reservieren
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem', marginBottom: '28px' }}>
            Für besondere Anlässe oder einfach um sicher zu gehen — reserviere deinen Tisch direkt online.
          </p>
          <a href={`/bestellen/${slug}?tab=reserve`} style={{
            display: 'inline-block', padding: '14px 36px', borderRadius: '8px',
            background: '#ffffff', color: colors.primary ?? colors.accent,
            fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none',
          }}>
            Jetzt reservieren
          </a>
        </div>
      </section>

      {/* ── 8. Kontakt & Anfahrt ── */}
      {(content.address || content.phone || content.email) && (
        <section style={sectionStyle}>
          <div style={innerStyle}>
            <div style={sectionLabel}>Kontakt & Anfahrt</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {content.address && (
                <a
                  href={content.maps_url || `https://maps.google.com?q=${encodeURIComponent(content.address)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', textDecoration: 'none' }}
                >
                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>📍</span>
                  <span style={{ color: colors.text, fontSize: '0.9rem', lineHeight: 1.5 }}>{content.address}</span>
                </a>
              )}
              {content.phone && (
                <a href={`tel:${content.phone}`} style={{ display: 'flex', gap: '12px', alignItems: 'center', textDecoration: 'none' }}>
                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>📞</span>
                  <span style={{ color: colors.text, fontSize: '0.9rem' }}>{content.phone}</span>
                </a>
              )}
              {content.email && (
                <a href={`mailto:${content.email}`} style={{ display: 'flex', gap: '12px', alignItems: 'center', textDecoration: 'none' }}>
                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>✉️</span>
                  <span style={{ color: colors.text, fontSize: '0.9rem' }}>{content.email}</span>
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 9. Instagram ── */}
      {content.instagram && (
        <section style={{ ...sectionStyle, background: colors.surface }}>
          <div style={{ ...innerStyle, display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
              background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fff', fontSize: '1.4rem' }}>📷</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: colors.text, fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>@{content.instagram.replace('@', '')}</div>
              <div style={{ color: colors.muted, fontSize: '0.78rem' }}>Folge uns für tägliche Specials & Neuigkeiten</div>
            </div>
            <a
              href={`https://instagram.com/${content.instagram.replace('@', '')}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                padding: '10px 20px', borderRadius: '8px',
                background: 'linear-gradient(135deg, #f09433, #dc2743, #bc1888)',
                color: '#fff', fontWeight: 700, fontSize: '0.82rem',
                textDecoration: 'none', flexShrink: 0,
              }}
            >
              Folgen
            </a>
          </div>
        </section>
      )}

      {/* ── 10. Footer ── */}
      <footer style={{ padding: '28px 24px', borderTop: `1px solid ${colors.border}`, textAlign: 'center' }}>
        <div style={{ color: colors.muted, fontFamily: `${font.heading}, Georgia, serif`, fontStyle: 'italic', fontSize: '0.9rem', marginBottom: '10px' }}>
          {restaurantName}
        </div>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { label: 'Impressum', href: `/legal/impressum` },
            { label: 'Datenschutz', href: `/legal/datenschutz` },
          ].map(link => (
            <a key={link.href} href={link.href} style={{ color: colors.muted, fontSize: '0.72rem', textDecoration: 'none' }}>{link.label}</a>
          ))}
          <span style={{ color: colors.muted, fontSize: '0.72rem' }}>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </>
  )
}
```

- [ ] **Step 2: TypeScript prüfen**

```bash
cd app && npx tsc --noEmit 2>&1 | head -40
```

Mögliche Fehler: `colors.primary` existiert möglicherweise nicht auf `ResolvedBrand`. In diesem Fall `colors.accent` als Fallback verwenden und `colors.primary ??` entfernen — nur `colors.accent` nutzen.

- [ ] **Step 3: Commit**

```bash
git add app/components/landing/LandingPageSections.tsx
git commit -m "feat(landing): add LandingPageSections with all 10 shared sections"
```

---

## Task 10: `page.tsx` aktualisieren

**Files:**
- Modify: `app/app/[slug]/info/page.tsx`

Änderungen:
1. Lokale `LandingPageContent`-Interface entfernen → Import aus `@/lib/landing-content`
2. `featuredItems`-Query immer ausführen (nicht nur für `bold-statement`)
3. Äußeren Wrapper-`<div>` mit bg/color/font ergänzen
4. `<LandingPageSections>` neben `<LandingHero>` rendern

- [ ] **Step 1: Datei komplett ersetzen**

```tsx
// app/app/[slug]/info/page.tsx
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveBrand } from '@/lib/resolve-brand'
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingPageSections } from '@/components/landing/LandingPageSections'
import type { LandingPageContent } from '@/lib/landing-content'
import type { FeaturedItem } from '@/components/landing/types'

export const dynamic = 'force-dynamic'

interface LandingPageRow {
  id: string
  restaurant_id: string
  template_slug: string
  content: LandingPageContent
  is_published: boolean
}

interface RestaurantRow {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  design_config: Record<string, unknown> | null
  primary_color: string | null
  bg_color: string | null
  surface_color: string | null
  header_color: string | null
  button_color: string | null
  card_color: string | null
  text_color: string | null
  font_pair: string | null
  layout_variant: string | null
  design_package: string | null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const admin = createSupabaseAdmin()

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('name, description')
    .eq('slug', slug)
    .maybeSingle()

  if (!restaurant) return {}

  const r = restaurant as Pick<RestaurantRow, 'name' | 'description'>
  return {
    title: r.name,
    description: r.description ?? `${r.name} — Online bestellen`,
  }
}

export default async function PublicLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const admin = createSupabaseAdmin()

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, name, slug, description, logo_url, design_config, primary_color, bg_color, surface_color, header_color, button_color, card_color, text_color, font_pair, layout_variant, design_package')
    .eq('slug', slug)
    .maybeSingle()

  if (!restaurant) notFound()

  const { data: lp } = await admin
    .from('landing_pages')
    .select('id, restaurant_id, template_slug, content, is_published')
    .eq('restaurant_id', (restaurant as RestaurantRow).id)
    .maybeSingle()

  if (!lp || !(lp as LandingPageRow).is_published) notFound()

  const landingPage = lp as LandingPageRow
  const resto = restaurant as RestaurantRow
  const content: LandingPageContent = landingPage.content ?? {}

  const brand = resolveBrand(resto, 'landing', {
    hero_image_url: content.hero_image_url,
    headline: content.headline,
    subheadline: content.subheadline,
    lp_layout: content.lp_layout,
  })

  const { data: itemsData } = await admin
    .from('menu_items')
    .select('id, name, price, image_url')
    .eq('restaurant_id', resto.id)
    .eq('available', true)
    .not('image_url', 'is', null)
    .order('sort_order', { ascending: true })
    .limit(4)

  const featuredItems: FeaturedItem[] = (itemsData ?? []) as FeaturedItem[]

  return (
    <div style={{
      fontFamily: `${brand.font.body}, system-ui, sans-serif`,
      background: brand.colors.bg,
      color: brand.colors.text,
    }}>
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
        restaurantName={resto.name}
        slug={resto.slug}
        featuredItems={featuredItems}
      />
    </div>
  )
}
```

- [ ] **Step 2: TypeScript prüfen**

```bash
cd app && npx tsc --noEmit 2>&1 | head -40
```

Wenn Fehler bei `resolveBrand` wegen `lp_layout`: Das zweite Argument des dritten Parameters heißt möglicherweise anders. Prüfe `app/lib/resolve-brand.ts` und passe den Key an.

- [ ] **Step 3: Dev-Server testen**

```bash
cd app && npm run dev
```

Öffne `http://localhost:3000/italiener/info` (oder einen anderen gültigen Slug mit veröffentlichter Landing Page). Prüfe:
- Hero wird korrekt gerendert (template-spezifisch)
- Darunter erscheinen die Sektionen
- Info-Strip zeigt Öffnungszeiten (sofern gesetzt)
- Galerie, About, Footer erscheinen
- Keine Doppelung (kein About doppelt durch alte Hero-Komponente)

- [ ] **Step 4: Commit**

```bash
git add app/app/[slug]/info/page.tsx
git commit -m "feat(landing): page.tsx renders LandingHero + LandingPageSections, fetches items for all layouts"
```

---

## Task 11: Review-Felder in `LandingPageTab.tsx` ergänzen

**Files:**
- Modify: `app/app/admin/branding/LandingPageTab.tsx`

Der bestehende "Bewertungen"-Block enthält nur ein `review_url`-Feld. Ersetze diesen Block durch: Google-Rating, Anzahl Bewertungen, Maps-URL, und 3 Zitat-Felder (Text + Autor).

- [ ] **Step 1: Lokalen `LandingPageContent`-Import auf `@/lib/landing-content` umstellen**

Suche nach dem `LandingPageContent`-Import in `LandingPageTab.tsx`. Wenn er aus `@/lib/lp-layouts` kommt: kein Handlungsbedarf (re-export ist eingerichtet). Wenn er lokal definiert ist: durch Import aus `@/lib/landing-content` ersetzen.

- [ ] **Step 2: Review-Block ersetzen (ab `{/* ── Review Link ── */}`)**

Finde diesen Block (ca. Zeile 637–645):

```tsx
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

Ersetze ihn durch:

```tsx
{/* ── Bewertungen ── */}
<div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
  <div style={sectionTitle}>Bewertungen</div>
  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
      <div>
        <label style={fieldLabel}>Google Rating <span style={{ opacity: 0.4 }}>(z.B. 4.8)</span></label>
        <input
          type="number" min="1" max="5" step="0.1"
          value={content.google_rating ?? ''}
          onChange={e => setContent(prev => ({ ...prev, google_rating: e.target.value ? parseFloat(e.target.value) : undefined }))}
          placeholder="4.8" style={inputStyle}
        />
      </div>
      <div>
        <label style={fieldLabel}>Anzahl Bewertungen</label>
        <input
          type="number" min="0"
          value={content.google_review_count ?? ''}
          onChange={e => setContent(prev => ({ ...prev, google_review_count: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
          placeholder="247" style={inputStyle}
        />
      </div>
    </div>
    <div>
      <label style={fieldLabel}>Google Maps Link</label>
      <input
        type="text"
        value={content.google_maps_url ?? ''}
        onChange={e => setContent(prev => ({ ...prev, google_maps_url: e.target.value }))}
        placeholder="https://maps.app.goo.gl/..." style={inputStyle}
      />
    </div>
    {[0, 1, 2].map(i => {
      const quote = content.review_quotes?.[i]
      return (
        <div key={i} style={{ background: 'var(--surface)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Zitat {i + 1}</div>
          <textarea
            rows={2}
            value={quote?.text ?? ''}
            onChange={e => setContent(prev => {
              const quotes = [...(prev.review_quotes ?? [{text:'',author:''},{text:'',author:''},{text:'',author:''}])]
              quotes[i] = { ...quotes[i], text: e.target.value }
              return { ...prev, review_quotes: quotes }
            })}
            placeholder="Tolles Essen, super Atmosphäre…"
            style={{ ...inputStyle, resize: 'vertical' as const }}
          />
          <input
            type="text"
            value={quote?.author ?? ''}
            onChange={e => setContent(prev => {
              const quotes = [...(prev.review_quotes ?? [{text:'',author:''},{text:'',author:''},{text:'',author:''}])]
              quotes[i] = { ...quotes[i], author: e.target.value }
              return { ...prev, review_quotes: quotes }
            })}
            placeholder="Max M." style={inputStyle}
          />
        </div>
      )
    })}
  </div>
</div>
```

- [ ] **Step 3: TypeScript prüfen**

```bash
cd app && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 4: Im Browser testen**

Öffne `/admin/branding` → Tab "Landing Page" → Tab "Inhalt". Scrolle nach unten zum Bewertungen-Block. Prüfe:
- Rating + Anzahl nebeneinander
- Maps-URL-Feld
- 3 Zitat-Blöcke (je Text + Autor)
- Speichern funktioniert (bestehende handleSave-Logik)

- [ ] **Step 5: Commit**

```bash
git add app/app/admin/branding/LandingPageTab.tsx
git commit -m "feat(admin): expand review section with rating, count, maps URL and 3 quote fields"
```

---

## Abschlusskontrolle

Nach allen Tasks:

- [ ] `npx tsc --noEmit` ohne Fehler
- [ ] `/[slug]/info` öffnet: Hero → Info-Strip → ggf. Galerie → ggf. Featured Menu → ggf. About → ggf. Öffnungszeiten → ggf. Bewertungen → Reservierungs-CTA → ggf. Kontakt → ggf. Instagram → Footer
- [ ] Kein About-Text doppelt (weder in Hero noch zweimal in Sections)
- [ ] Admin: Review-Felder speichern korrekt in `content`-JSONB
- [ ] Alle 5 Hero-Templates zeigen weiterhin ihren Hero korrekt an
- [ ] Mobile: Info-Strip, Galerie und Featured Menu sind horizontal scrollbar

```bash
git log --oneline -10
```

Erwartete Commits (in dieser Reihenfolge):
1. `feat(landing): add canonical LandingPageContent type with review fields`
2. `refactor(landing): lp-layouts re-exports LandingPageContent from landing-content`
3. `refactor(landing): HeroProps uses LandingPageContent instead of HeroContent`
4. `refactor(landing): HeroClassicOverlay renders only the visual hero block`
5. `refactor(landing): HeroBoldStatement renders only hero block, strips about+footer`
6. `refactor(landing): HeroSplit renders only split hero block`
7. `refactor(landing): HeroCenteredMinimal renders only centered hero header`
8. `refactor(landing): HeroGradientGlow renders only glow+header+statement+chips`
9. `feat(landing): add LandingPageSections with all 10 shared sections`
10. `feat(landing): page.tsx renders LandingHero + LandingPageSections, fetches items for all layouts`
11. `feat(admin): expand review section with rating, count, maps URL and 3 quote fields`
