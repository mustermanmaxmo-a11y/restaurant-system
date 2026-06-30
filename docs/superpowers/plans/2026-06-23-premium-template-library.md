# Premium Template Library — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 5 premium, structurally-distinct restaurant templates (Rustico, Strada, Bianco, Natura, Vibrante) that apply consistently across Landing Page, QR-Order App, and Online-Order App, with an extensible architecture Luca can add to without touching core code.

**Architecture:** Add `heroLayout` to `ResolvedBrand` so the landing page can switch between 5 distinct hero components. Each template lives as a SQL seed row in `design_templates` — no TypeScript file per template needed. Wire `cardStyle` and `borderRadius` from `resolveBrand` into `MenuItemCard` so all 3 guest surfaces reflect template style. Add live-HTML preview cards to the branding gallery.

**Tech Stack:** Next.js 15 App Router, TypeScript, Inline Styles (NOT Tailwind for brand-dynamic values — Tailwind doesn't interpolate runtime CSS values), Supabase Postgres, Framer Motion (existing)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `app/lib/color-utils.ts` | Modify | Add `accentSecondary` to `ColorSet` + `buildColorsFromRestaurant` |
| `app/lib/resolve-brand.ts` | Modify | Add `heroLayout` + `accentSecondary` to `ResolvedBrand` |
| `app/components/landing/types.ts` | Create | Shared `HeroProps` interface used by all hero components |
| `app/components/landing/HeroClassicOverlay.tsx` | Create | Rustico hero |
| `app/components/landing/HeroBoldStatement.tsx` | Create | Strada hero (needs featuredItems) |
| `app/components/landing/HeroSplit.tsx` | Create | Bianco hero |
| `app/components/landing/HeroCenteredMinimal.tsx` | Create | Natura hero |
| `app/components/landing/HeroGradientGlow.tsx` | Create | Vibrante hero |
| `app/components/landing/LandingHero.tsx` | Create | Switch component — picks hero by `brand.heroLayout` |
| `app/app/[slug]/info/page.tsx` | Modify | Replace `<header>` with `<LandingHero>`, add featuredItems query |
| `app/components/menu/MenuItemCard.tsx` | Modify | Accept + apply `borderRadius` + `cardStyle` props |
| `app/components/menu/MenuItemGrid.tsx` | Modify | Pass new props through to `MenuItemCard` |
| `app/app/order/[token]/_v1/OrderV1.tsx` | Modify | Pass `borderRadius` + `cardStyle` from brand to `MenuItemGrid` |
| `app/app/bestellen/[slug]/_v1/BestellenV1.tsx` | Modify | Pass `borderRadius` + `cardStyle` from brand to `MenuItemGrid` |
| `app/components/landing/TemplatePreviewCard.tsx` | Create | Live-HTML scaled preview for branding gallery |
| `app/app/admin/branding/page.tsx` | Modify | Replace color-swatch preview with `TemplatePreviewCard` |
| `app/supabase/migrations/20260623_001_premium_templates.sql` | Create | Upsert 5 premium template seeds |

---

## Task 1: Extend `ColorSet` with `accentSecondary`

**Files:**
- Modify: `app/lib/color-utils.ts`

- [ ] **Step 1: Add `accentSecondary` to the `ColorSet` interface**

In `app/lib/color-utils.ts`, add one line to the `ColorSet` interface after `accentGlow`:

```ts
export interface ColorSet {
  bg: string
  surface: string
  surface2: string
  border: string
  borderHover: string
  accent: string
  accentDim: string
  accentGlow: string
  accentSecondary: string   // ← add this line
  text: string
  muted: string
  muted2: string
  headerBg: string
  headerText: string
  buttonBg: string
  buttonText: string
  cardBg: string
}
```

- [ ] **Step 2: Populate `accentSecondary` in `buildColorsFromRestaurant`**

In the same file, inside `buildColorsFromRestaurant`, add the extraction and include the field in the returned object:

```ts
export function buildColorsFromRestaurant(restaurant: Partial<Restaurant>): ColorSet {
  const cfg = restaurant.design_config ?? {}
  const pkg = getDesignPackage(readCfgString(cfg, 'design_package') ?? restaurant.design_package ?? undefined)

  const accent = readCfgString(cfg, 'primary_color') ?? restaurant.primary_color ?? pkg.preview.primaryColor
  const accentSecondary = readCfgString(cfg, 'accent_secondary') ?? accent  // ← add this line
  const bg = readCfgString(cfg, 'bg_color') ?? restaurant.bg_color ?? pkg.preview.bgColor
  // ... rest of existing extractions unchanged ...

  return {
    bg,
    surface,
    surface2,
    border,
    borderHover,
    accent,
    accentDim: `${accent}1f`,
    accentGlow: `${accent}47`,
    accentSecondary,   // ← add this line
    text,
    muted,
    muted2,
    headerBg,
    headerText,
    buttonBg,
    buttonText,
    cardBg,
  }
}
```

- [ ] **Step 3: Check TypeScript compiles**

```bash
cd app && npx tsc --noEmit 2>&1 | grep "color-utils\|resolve-brand" | head -20
```

Expected: no errors on these files.

- [ ] **Step 4: Commit**

```bash
git add app/lib/color-utils.ts
git commit -m "feat(brand): add accentSecondary to ColorSet"
```

---

## Task 2: Extend `resolveBrand` with `heroLayout`

**Files:**
- Modify: `app/lib/resolve-brand.ts`

- [ ] **Step 1: Add `heroLayout` type + field to `ResolvedBrand`**

```ts
export type HeroLayout = 'classic-overlay' | 'bold-statement' | 'split' | 'centered-minimal' | 'gradient-glow'

export interface ResolvedBrand {
  surface: BrandSurface
  colors: ColorSet
  font: FontPair
  fontPairKey: string
  layoutVariant: string
  heroLayout: HeroLayout          // ← add
  borderRadius: 'sharp' | 'rounded' | 'pill'
  hoverEffect: 'scale' | 'glow' | 'underline' | 'color-shift' | 'none'
  animationStyle: 'fade' | 'slide' | 'none'
  cardStyle: 'elevated' | 'flat' | 'outlined' | 'ghost'
  name?: string
  logoUrl?: string
  overrides: BrandOverrides
}
```

- [ ] **Step 2: Read `heroLayout` inside `resolveBrand` and return it**

In the `resolveBrand` function, add the extraction before the `return` block:

```ts
const heroLayout = pickEnum(
  readCfgString(cfg, 'hero_layout'),
  ['classic-overlay', 'bold-statement', 'split', 'centered-minimal', 'gradient-glow'] as const,
  'classic-overlay',
)
```

Then add `heroLayout` to the returned object:

```ts
return {
  surface,
  colors,
  font,
  fontPairKey,
  layoutVariant,
  heroLayout,         // ← add
  borderRadius: pickEnum(readCfgString(cfg, 'border_radius'), ['sharp', 'rounded', 'pill'] as const, 'rounded'),
  hoverEffect: pickEnum(readCfgString(cfg, 'hover_effect'), ['scale', 'glow', 'underline', 'color-shift', 'none'] as const, 'scale'),
  animationStyle: pickEnum(readCfgString(cfg, 'animation_style'), ['fade', 'slide', 'none'] as const, 'fade'),
  cardStyle: pickEnum(readCfgString(cfg, 'card_style'), ['elevated', 'flat', 'outlined', 'ghost'] as const, 'elevated'),
  name: restaurant.name,
  logoUrl: restaurant.logo_url ?? undefined,
  overrides: safeOverrides,
}
```

- [ ] **Step 3: Check TypeScript compiles**

```bash
cd app && npx tsc --noEmit 2>&1 | grep "resolve-brand" | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/lib/resolve-brand.ts
git commit -m "feat(brand): add heroLayout to ResolvedBrand"
```

---

## Task 3: Create shared `HeroProps` type

**Files:**
- Create: `app/components/landing/types.ts`

- [ ] **Step 1: Create the file**

```ts
// app/components/landing/types.ts
import type { ResolvedBrand } from '@/lib/resolve-brand'

export interface HeroContent {
  hero_image_url?: string
  headline?: string
  subheadline?: string
  about_text?: string
  cta_text?: string
}

export interface FeaturedItem {
  id: string
  name: string
  price: number
  image_url: string | null
}

export interface HeroProps {
  brand: ResolvedBrand
  content: HeroContent
  ctaHref: string
  restaurantName: string
  featuredItems?: FeaturedItem[]
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/landing/types.ts
git commit -m "feat(landing): add shared HeroProps type"
```

---

## Task 4: Build `HeroClassicOverlay` (Rustico)

**Files:**
- Create: `app/components/landing/HeroClassicOverlay.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/components/landing/HeroClassicOverlay.tsx
import type { HeroProps } from './types'

export function HeroClassicOverlay({ brand, content, ctaHref, restaurantName }: HeroProps) {
  const { colors, font } = brand
  const heading = content.headline || restaurantName
  const hasImage = Boolean(content.hero_image_url)

  return (
    <div style={{ fontFamily: `${font.body}, system-ui, sans-serif` }}>
      {/* ── Hero ── */}
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
          {/* Eyebrow label */}
          <div style={{
            color: hasImage ? 'rgba(255,255,255,0.7)' : colors.muted,
            fontSize: '0.65rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: '16px',
          }}>
            {content.subheadline ? '' : 'Willkommen'}
          </div>
          {/* Name */}
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
          {/* Divider */}
          <div style={{
            width: '48px', height: '1.5px',
            background: hasImage ? colors.accent : colors.accent,
            margin: '16px auto',
            opacity: 0.8,
          }} />
          {/* Subheadline */}
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
          {/* CTA */}
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

      {/* ── Info strip ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1px 1fr 1px 1fr',
        background: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        padding: '16px 24px',
      }}>
        {[
          { label: 'Heute', value: '11–23 Uhr' },
          null,
          { label: 'Küche', value: 'Geöffnet' },
          null,
          { label: 'Bestellung', value: 'Am Tisch' },
        ].map((item, i) =>
          item === null
            ? <div key={i} style={{ background: colors.border }} />
            : (
              <div key={i} style={{ textAlign: 'center', padding: '0 12px' }}>
                <div style={{ color: colors.muted, fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>{item.label}</div>
                <div style={{ color: colors.text, fontSize: '0.82rem', fontWeight: 700 }}>{item.value}</div>
              </div>
            )
        )}
      </div>

      {/* ── About ── */}
      {content.about_text && (
        <section style={{ padding: '56px 24px', maxWidth: '680px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: `${font.heading}, Georgia, serif`, fontStyle: 'italic', fontSize: '1.8rem', color: colors.text, marginBottom: '16px' }}>Über uns</h2>
          <p style={{ color: colors.muted, lineHeight: 1.8, fontSize: '1rem' }}>{content.about_text}</p>
        </section>
      )}

      {/* ── Menu CTA ── */}
      <section style={{ padding: '40px 24px', background: colors.surface, borderTop: `1px solid ${colors.border}` }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ color: colors.accent, fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Speisekarte</div>
            <div style={{ color: colors.text, fontFamily: `${font.heading}, Georgia, serif`, fontStyle: 'italic', fontSize: '1.4rem' }}>Alle Gerichte entdecken</div>
          </div>
          <a href={ctaHref} style={{ padding: '12px 28px', borderRadius: '6px', background: colors.buttonBg, color: colors.buttonText, fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}>
            Zur Karte
          </a>
        </div>
      </section>

      <footer style={{ padding: '24px', textAlign: 'center', color: colors.muted, fontSize: '0.75rem', borderTop: `1px solid ${colors.border}` }}>
        {restaurantName}
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd app && npx tsc --noEmit 2>&1 | grep "HeroClassicOverlay" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/landing/HeroClassicOverlay.tsx
git commit -m "feat(landing): add HeroClassicOverlay (Rustico template)"
```

---

## Task 5: Build `HeroBoldStatement` (Strada)

**Files:**
- Create: `app/components/landing/HeroBoldStatement.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/components/landing/HeroBoldStatement.tsx
import type { HeroProps } from './types'

export function HeroBoldStatement({ brand, content, ctaHref, restaurantName, featuredItems = [] }: HeroProps) {
  const { colors, font } = brand
  const lines = (content.headline || restaurantName).split(' ')
  const firstWord = lines[0] ?? restaurantName
  const restWords = lines.slice(1).join(' ')

  return (
    <div style={{ fontFamily: `${font.body}, system-ui, sans-serif`, background: colors.bg, minHeight: '100vh', color: colors.text }}>
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
          <div style={{ color: colors.muted, fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '16px' }}>
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

      {/* ── About ── */}
      {content.about_text && (
        <section style={{ padding: '32px 20px', borderTop: `1px solid ${colors.border}` }}>
          <div style={{ color: colors.muted, lineHeight: 1.7, fontSize: '0.9rem', maxWidth: '600px' }}>{content.about_text}</div>
        </section>
      )}

      <footer style={{ padding: '20px', textAlign: 'center', color: colors.muted, fontSize: '0.72rem', borderTop: `1px solid ${colors.border}` }}>
        {restaurantName}
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd app && npx tsc --noEmit 2>&1 | grep "HeroBoldStatement" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add app/components/landing/HeroBoldStatement.tsx
git commit -m "feat(landing): add HeroBoldStatement (Strada template)"
```

---

## Task 6: Build `HeroSplit` (Bianco)

**Files:**
- Create: `app/components/landing/HeroSplit.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/components/landing/HeroSplit.tsx
import type { HeroProps } from './types'

export function HeroSplit({ brand, content, ctaHref, restaurantName }: HeroProps) {
  const { colors, font } = brand
  const heading = content.headline || restaurantName

  return (
    <div style={{ fontFamily: `${font.body}, system-ui, sans-serif`, background: colors.bg, color: colors.text, minHeight: '100vh' }}>
      {/* ── Split hero ── */}
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
              transition: 'background 0.15s',
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

      {/* ── Category underline nav ── */}
      <nav style={{ display: 'flex', gap: '0', borderBottom: `1px solid ${colors.border}`, padding: '0 40px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {['Alles', 'Empfehlungen', 'Gerichte', 'Getränke'].map((cat, i) => (
          <div key={cat} style={{
            padding: '14px 20px', fontSize: '0.78rem',
            color: i === 0 ? colors.text : colors.muted,
            borderBottom: i === 0 ? `2px solid ${colors.text}` : '2px solid transparent',
            cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.04em',
          }}>
            {cat}
          </div>
        ))}
      </nav>

      {/* ── About ── */}
      {content.about_text && (
        <section style={{ padding: '56px 40px', maxWidth: '680px' }}>
          <p style={{ color: colors.muted, lineHeight: 1.8, fontSize: '0.95rem' }}>{content.about_text}</p>
        </section>
      )}

      <footer style={{ padding: '24px 40px', color: colors.muted, fontSize: '0.72rem', borderTop: `1px solid ${colors.border}` }}>
        {restaurantName}
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd app && npx tsc --noEmit 2>&1 | grep "HeroSplit" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add app/components/landing/HeroSplit.tsx
git commit -m "feat(landing): add HeroSplit (Bianco template)"
```

---

## Task 7: Build `HeroCenteredMinimal` (Natura)

**Files:**
- Create: `app/components/landing/HeroCenteredMinimal.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/components/landing/HeroCenteredMinimal.tsx
import type { HeroProps } from './types'

const DIETARY_TAGS = ['🌱 Vegan', '🌾 Glutenfrei', '♻️ Bio', '🥦 Regional']

export function HeroCenteredMinimal({ brand, content, ctaHref, restaurantName }: HeroProps) {
  const { colors, font } = brand
  const heading = content.headline || restaurantName
  const radius = '999px'

  return (
    <div style={{ fontFamily: `${font.body}, system-ui, sans-serif`, background: colors.bg, color: colors.text, minHeight: '100vh' }}>
      {/* ── Hero: centered, no bg image ── */}
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

      {/* ── About ── */}
      {content.about_text && (
        <section style={{ padding: '40px 24px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{ color: colors.muted, lineHeight: 1.8 }}>{content.about_text}</p>
        </section>
      )}

      {/* ── Menu CTA ── */}
      <section style={{ padding: '32px 24px', background: colors.surface, borderTop: `1px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ maxWidth: '560px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ color: colors.text, fontSize: '1rem', fontWeight: 600 }}>Speisekarte entdecken</div>
          <a href={ctaHref} style={{ padding: '10px 24px', borderRadius: radius, background: colors.buttonBg, color: colors.buttonText, fontWeight: 600, fontSize: '0.82rem', textDecoration: 'none' }}>
            Zur Karte
          </a>
        </div>
      </section>

      <footer style={{ padding: '24px', textAlign: 'center', color: colors.muted, fontSize: '0.72rem' }}>
        {restaurantName}
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd app && npx tsc --noEmit 2>&1 | grep "HeroCenteredMinimal" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add app/components/landing/HeroCenteredMinimal.tsx
git commit -m "feat(landing): add HeroCenteredMinimal (Natura template)"
```

---

## Task 8: Build `HeroGradientGlow` (Vibrante)

**Files:**
- Create: `app/components/landing/HeroGradientGlow.tsx`

- [ ] **Step 1: Create the component**

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
    <div style={{ fontFamily: `${font.body}, system-ui, sans-serif`, background: colors.bg, color: colors.text, minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
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
              }}>
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

        {/* ── About ── */}
        {content.about_text && (
          <section style={{ padding: '28px 20px', borderTop: `1px solid ${colors.border}` }}>
            <p style={{ color: colors.muted, lineHeight: 1.7, fontSize: '0.9rem' }}>{content.about_text}</p>
          </section>
        )}

        <footer style={{ padding: '20px', textAlign: 'center', color: colors.muted, fontSize: '0.7rem', borderTop: `1px solid ${colors.border}` }}>
          {restaurantName}
        </footer>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd app && npx tsc --noEmit 2>&1 | grep "HeroGradientGlow" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add app/components/landing/HeroGradientGlow.tsx
git commit -m "feat(landing): add HeroGradientGlow (Vibrante template)"
```

---

## Task 9: Build `LandingHero` switch component + update landing page

**Files:**
- Create: `app/components/landing/LandingHero.tsx`
- Modify: `app/app/[slug]/info/page.tsx`

- [ ] **Step 1: Create `LandingHero.tsx`**

```tsx
// app/components/landing/LandingHero.tsx
import type { ResolvedBrand } from '@/lib/resolve-brand'
import type { HeroContent, FeaturedItem } from './types'
import { HeroClassicOverlay } from './HeroClassicOverlay'
import { HeroBoldStatement } from './HeroBoldStatement'
import { HeroSplit } from './HeroSplit'
import { HeroCenteredMinimal } from './HeroCenteredMinimal'
import { HeroGradientGlow } from './HeroGradientGlow'

interface LandingHeroProps {
  brand: ResolvedBrand
  content: HeroContent
  ctaHref: string
  restaurantName: string
  featuredItems?: FeaturedItem[]
}

export function LandingHero(props: LandingHeroProps) {
  switch (props.brand.heroLayout) {
    case 'bold-statement':    return <HeroBoldStatement {...props} />
    case 'split':             return <HeroSplit {...props} />
    case 'centered-minimal':  return <HeroCenteredMinimal {...props} />
    case 'gradient-glow':     return <HeroGradientGlow {...props} />
    case 'classic-overlay':
    default:                  return <HeroClassicOverlay {...props} />
  }
}
```

- [ ] **Step 2: Update `app/app/[slug]/info/page.tsx`**

Replace the entire file content with the following (adds `featuredItems` query + uses `LandingHero`):

```tsx
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveBrand } from '@/lib/resolve-brand'
import { LandingHero } from '@/components/landing/LandingHero'
import type { FeaturedItem } from '@/components/landing/types'

export const dynamic = 'force-dynamic'

interface LandingPageContent {
  logo_url?: string
  hero_image_url?: string
  headline?: string
  subheadline?: string
  about_text?: string
  cta_text?: string
  cta_url?: string
}

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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const admin = createSupabaseAdmin()
  const { data } = await admin.from('restaurants').select('name, description').eq('slug', slug).maybeSingle()
  if (!data) return {}
  return { title: data.name, description: (data as { description: string | null }).description ?? `${data.name} — Online bestellen` }
}

export default async function PublicLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createSupabaseAdmin()

  const [{ data: restaurant }, { data: lp }] = await Promise.all([
    admin.from('restaurants')
      .select('id, name, slug, description, logo_url, design_config, primary_color, bg_color, surface_color, header_color, button_color, card_color, text_color, font_pair, layout_variant, design_package')
      .eq('slug', slug)
      .maybeSingle(),
    admin.from('landing_pages')
      .select('id, restaurant_id, template_slug, content, is_published')
      .eq('restaurant_id',
        // We need the restaurant id — fetched inline below if needed
        // This join is resolved after the restaurant fetch
        'placeholder'
      )
      .maybeSingle(),
  ])

  if (!restaurant) notFound()
  const resto = restaurant as RestaurantRow

  // Fetch landing page properly with restaurant id
  const { data: landingPageData } = await admin
    .from('landing_pages')
    .select('id, restaurant_id, template_slug, content, is_published')
    .eq('restaurant_id', resto.id)
    .maybeSingle()

  if (!landingPageData || !(landingPageData as LandingPageRow).is_published) notFound()
  const landingPage = landingPageData as LandingPageRow
  const content: LandingPageContent = landingPage.content ?? {}

  const brand = resolveBrand(resto, 'landing', {
    hero_image_url: content.hero_image_url,
    headline: content.headline,
    subheadline: content.subheadline,
    lp_layout: (landingPage.content as Record<string, unknown>)?.lp_layout as string | undefined,
  })

  // For Strada (bold-statement): fetch top 4 menu items for preview strip
  let featuredItems: FeaturedItem[] = []
  if (brand.heroLayout === 'bold-statement') {
    const { data: items } = await admin
      .from('menu_items')
      .select('id, name, price, image_url')
      .eq('restaurant_id', resto.id)
      .eq('available', true)
      .limit(4)
    featuredItems = (items ?? []) as FeaturedItem[]
  }

  const ctaHref = content.cta_url || `/bestellen/${resto.slug}`

  return (
    <LandingHero
      brand={brand}
      content={content}
      ctaHref={ctaHref}
      restaurantName={content.headline || resto.name}
      featuredItems={featuredItems}
    />
  )
}
```

**Note:** The placeholder approach above has a bug (Promise.all with hardcoded `'placeholder'`). Use this cleaner version instead — sequential fetches for correctness:

```tsx
export default async function PublicLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createSupabaseAdmin()

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, name, slug, description, logo_url, design_config, primary_color, bg_color, surface_color, header_color, button_color, card_color, text_color, font_pair, layout_variant, design_package')
    .eq('slug', slug)
    .maybeSingle()

  if (!restaurant) notFound()
  const resto = restaurant as RestaurantRow

  const { data: landingPageData } = await admin
    .from('landing_pages')
    .select('id, restaurant_id, template_slug, content, is_published')
    .eq('restaurant_id', resto.id)
    .maybeSingle()

  if (!landingPageData || !(landingPageData as LandingPageRow).is_published) notFound()
  const landingPage = landingPageData as LandingPageRow
  const content: LandingPageContent = landingPage.content ?? {}

  const brand = resolveBrand(resto, 'landing', {
    hero_image_url: content.hero_image_url,
    headline: content.headline,
    subheadline: content.subheadline,
    lp_layout: (landingPage.content as Record<string, unknown>)?.lp_layout as string | undefined,
  })

  let featuredItems: FeaturedItem[] = []
  if (brand.heroLayout === 'bold-statement') {
    const { data: items } = await admin
      .from('menu_items')
      .select('id, name, price, image_url')
      .eq('restaurant_id', resto.id)
      .eq('available', true)
      .limit(4)
    featuredItems = (items ?? []) as FeaturedItem[]
  }

  return (
    <LandingHero
      brand={brand}
      content={content}
      ctaHref={content.cta_url || `/bestellen/${resto.slug}`}
      restaurantName={resto.name}
      featuredItems={featuredItems}
    />
  )
}
```

- [ ] **Step 3: Check TypeScript compiles**

```bash
cd app && npx tsc --noEmit 2>&1 | grep "landing\|info/page" | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/components/landing/LandingHero.tsx app/app/[slug]/info/page.tsx
git commit -m "feat(landing): wire LandingHero switch — 5 hero layouts now active"
```

---

## Task 10: Wire `cardStyle` + `borderRadius` into `MenuItemCard`

**Files:**
- Modify: `app/components/menu/MenuItemCard.tsx`
- Modify: `app/components/menu/MenuItemGrid.tsx`

- [ ] **Step 1: Add props to `MenuItemCardProps` interface in `MenuItemCard.tsx`**

Find the `MenuItemCardProps` interface and add two fields:

```ts
export interface MenuItemCardProps {
  item: MenuItem
  qty: number
  layout: LayoutVariant
  colors?: ColorSet
  special?: { label: string; special_price: number | null }
  displayName: string
  displayDesc: string | null
  index: number
  onAdd: () => void
  onRemove: () => void
  onOpen: () => void
  isFavorite?: boolean
  onToggleFavorite?: () => void
  borderRadius?: 'sharp' | 'rounded' | 'pill'   // ← add
  cardStyle?: 'elevated' | 'flat' | 'outlined' | 'ghost'  // ← add
}
```

- [ ] **Step 2: Create a helper to resolve border-radius pixel value**

Add this function near the top of `MenuItemCard.tsx`, after the imports:

```ts
function resolveRadius(br: 'sharp' | 'rounded' | 'pill' | undefined): string {
  if (br === 'sharp') return '4px'
  if (br === 'pill') return '999px'
  return '16px' // rounded (default)
}
```

- [ ] **Step 3: Update `CardsLayout` to use the new props**

In `CardsLayout`, destructure the new props and apply them:

```ts
function CardsLayout(props: MenuItemCardProps) {
  const { item, qty, colors, special, displayName, displayDesc, index, onAdd, onRemove, onOpen, isFavorite, onToggleFavorite, borderRadius, cardStyle } = props
  const inCart = qty > 0
  const radius = resolveRadius(borderRadius)

  const boxShadow = cardStyle === 'flat' || cardStyle === 'ghost'
    ? 'none'
    : inCart ? '0 2px 12px rgba(0,0,0,0.08)' : '0 1px 4px rgba(0,0,0,0.06)'

  const border = cardStyle === 'outlined'
    ? `1.5px solid ${c(colors, 'accent', '--accent')}66`
    : cardStyle === 'ghost'
    ? `1px solid ${c(colors, 'border', '--border')}`
    : inCart
    ? `1.5px solid ${c(colors, 'accent', '--accent')}`
    : '1.5px solid transparent'

  const background = cardStyle === 'ghost'
    ? 'transparent'
    : c(colors, 'cardBg', '--surface')

  return (
    <motion.div
      // ... existing motion props unchanged ...
      style={{
        background,
        borderRadius: radius,
        padding: '14px',
        display: 'flex',
        gap: '14px',
        alignItems: 'center',
        border,
        boxShadow,
        cursor: 'pointer',
      }}
    >
      {/* rest unchanged */}
```

- [ ] **Step 4: Find `MenuItemGrid.tsx` and pass through the new props**

In `app/components/menu/MenuItemGrid.tsx`, find the `MenuItemGrid` component props interface and add the two new fields, then forward them to each `MenuItemCard`:

```ts
// Add to MenuItemGridProps (find the existing interface):
borderRadius?: 'sharp' | 'rounded' | 'pill'
cardStyle?: 'elevated' | 'flat' | 'outlined' | 'ghost'

// Then in the JSX where MenuItemCard is rendered, add:
borderRadius={borderRadius}
cardStyle={cardStyle}
```

- [ ] **Step 5: Check TypeScript compiles**

```bash
cd app && npx tsc --noEmit 2>&1 | grep "MenuItemCard\|MenuItemGrid" | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/components/menu/MenuItemCard.tsx app/components/menu/MenuItemGrid.tsx
git commit -m "feat(menu): add borderRadius + cardStyle props to MenuItemCard/Grid"
```

---

## Task 11: Pass style tokens from `resolveBrand` in Order + Bestellen V1

**Files:**
- Modify: `app/app/order/[token]/_v1/OrderV1.tsx`
- Modify: `app/app/bestellen/[slug]/_v1/BestellenV1.tsx`

- [ ] **Step 1: Find `resolveBrand` call in `OrderV1.tsx`**

Search for where `resolveBrand` is called in `OrderV1.tsx`:

```bash
grep -n "resolveBrand\|buildColorsFromRestaurant\|MenuItemGrid" app/app/order/\[token\]/_v1/OrderV1.tsx | head -20
```

- [ ] **Step 2: Pass `borderRadius` and `cardStyle` to `MenuItemGrid` in `OrderV1.tsx`**

Find every `<MenuItemGrid` usage and add the two props. The values come from the restaurant's `design_config`. Since `OrderV1` calls `buildColorsFromRestaurant` (not `resolveBrand`), add a small helper read at the point where `design_config` is available:

```ts
// Near where restaurant data is loaded, extract the style tokens:
const cfg = (restaurant?.design_config ?? {}) as Record<string, unknown>
const borderRadius = (['sharp', 'rounded', 'pill'].includes(cfg.border_radius as string)
  ? cfg.border_radius : 'rounded') as 'sharp' | 'rounded' | 'pill'
const cardStyle = (['elevated', 'flat', 'outlined', 'ghost'].includes(cfg.card_style as string)
  ? cfg.card_style : 'elevated') as 'elevated' | 'flat' | 'outlined' | 'ghost'
```

Then pass to `<MenuItemGrid`:

```tsx
<MenuItemGrid
  // ...existing props...
  borderRadius={borderRadius}
  cardStyle={cardStyle}
/>
```

- [ ] **Step 3: Repeat for `BestellenV1.tsx`**

Apply the same pattern — find `<MenuItemGrid` usage, extract style tokens from the restaurant's `design_config`, pass `borderRadius` and `cardStyle`.

```bash
grep -n "MenuItemGrid\|design_config" app/app/bestellen/\[slug\]/_v1/BestellenV1.tsx | head -20
```

- [ ] **Step 4: Check TypeScript compiles**

```bash
cd app && npx tsc --noEmit 2>&1 | grep "OrderV1\|BestellenV1" | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/app/order/\[token\]/_v1/OrderV1.tsx app/app/bestellen/\[slug\]/_v1/BestellenV1.tsx
git commit -m "feat(order): pass borderRadius + cardStyle from design_config to MenuItemGrid"
```

---

## Task 12: Build `TemplatePreviewCard` + update branding gallery

**Files:**
- Create: `app/components/landing/TemplatePreviewCard.tsx`
- Modify: `app/app/admin/branding/page.tsx`

- [ ] **Step 1: Create `TemplatePreviewCard.tsx`**

```tsx
// app/components/landing/TemplatePreviewCard.tsx
'use client'

interface TemplateConfig {
  bg_color?: string
  surface_color?: string
  primary_color?: string
  button_color?: string
  text_color?: string
  hero_layout?: string
  font_pair?: string
  border_radius?: string
}

interface TemplatePreviewCardProps {
  config: TemplateConfig
  name: string
}

// Renders a scaled-down live preview of the template — no images, no external deps
export function TemplatePreviewCard({ config, name }: TemplatePreviewCardProps) {
  const bg = config.bg_color ?? '#ffffff'
  const surface = config.surface_color ?? '#f5f5f5'
  const accent = config.primary_color ?? '#333333'
  const text = config.text_color ?? '#111111'
  const heroLayout = config.hero_layout ?? 'classic-overlay'
  const isLight = parseInt(bg.replace('#','').substring(0,2), 16) > 180

  const muted = isLight ? '#888' : '#666'
  const radius = config.border_radius === 'sharp' ? '3px' : config.border_radius === 'pill' ? '20px' : '10px'

  return (
    <div style={{
      width: '100%', height: '120px',
      borderRadius: '8px', overflow: 'hidden',
      background: bg, position: 'relative',
      border: `1px solid ${isLight ? '#e5e5e5' : '#2a2a2a'}`,
    }}>
      {heroLayout === 'classic-overlay' && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${accent}22, ${bg})` }} />
          <div style={{ position: 'relative', padding: '16px', textAlign: 'center' }}>
            <div style={{ width: '40px', height: '2px', background: accent, margin: '0 auto 6px' }} />
            <div style={{ color: text, fontSize: '11px', fontWeight: 700, fontStyle: 'italic', marginBottom: '4px' }}>{name}</div>
            <div style={{ width: '24px', height: '1px', background: accent, margin: '0 auto 8px', opacity: 0.6 }} />
            <div style={{ display: 'inline-block', background: accent, color: '#fff', fontSize: '7px', padding: '3px 10px', borderRadius: radius, fontWeight: 700 }}>Bestellen</div>
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', background: surface, borderTop: `1px solid ${isLight ? '#eee' : '#333'}` }}>
            {['Öffnungszeit', 'Tisch', 'Status'].map(l => (
              <div key={l} style={{ flex: 1, padding: '5px', textAlign: 'center', fontSize: '6px', color: muted }}>{l}</div>
            ))}
          </div>
        </>
      )}
      {heroLayout === 'bold-statement' && (
        <div style={{ padding: '12px' }}>
          <div style={{ color: text, fontSize: '7px', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '4px', opacity: 0.6 }}>{name.toUpperCase()}</div>
          <div style={{ color: text, fontSize: '20px', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.03em' }}>BOLD</div>
          <div style={{ color: accent, fontSize: '20px', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.03em' }}>FOOD.</div>
          <div style={{ display: 'inline-block', background: accent, color: '#fff', fontSize: '7px', padding: '4px 10px', borderRadius: '6px', marginTop: '8px', fontWeight: 700 }}>Bestellen →</div>
        </div>
      )}
      {heroLayout === 'split' && (
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: `1px solid ${isLight ? '#eee' : '#333'}` }}>
            <div>
              <div style={{ color: muted, fontSize: '5px', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '6px' }}>JAPANESE CUISINE</div>
              <div style={{ color: text, fontSize: '13px', fontWeight: 200, lineHeight: 1.1 }}>{name}</div>
            </div>
            <div style={{ display: 'inline-block', border: `1.5px solid ${text}`, color: text, fontSize: '6px', padding: '4px 8px', fontWeight: 600 }}>BESTELLEN</div>
          </div>
          <div style={{ flex: 1, background: `linear-gradient(135deg, ${surface}, ${isLight ? '#e8e8e8' : '#2a2a2a'})` }} />
        </div>
      )}
      {heroLayout === 'centered-minimal' && (
        <div style={{ padding: '12px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: `${accent}18`, border: `1px solid ${accent}30`, borderRadius: '20px', padding: '2px 8px', marginBottom: '8px' }}>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: accent }} />
            <span style={{ color: accent, fontSize: '5px', fontWeight: 600 }}>Geöffnet</span>
          </div>
          <div style={{ color: text, fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>{name}</div>
          <div style={{ display: 'inline-block', background: accent, color: '#fff', fontSize: '6px', padding: '4px 14px', borderRadius: '20px', fontWeight: 600 }}>Bestellen</div>
        </div>
      )}
      {heroLayout === 'gradient-glow' && (
        <div style={{ padding: '12px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '60px', height: '60px', borderRadius: '50%', background: `radial-gradient(circle, ${accent}40 0%, transparent 70%)` }} />
          <div style={{ color: text, fontSize: '18px', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.03em', position: 'relative' }}>{name.split(' ')[0]}</div>
          <div style={{ fontSize: '18px', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.03em', background: `linear-gradient(90deg, #FF6B6B, ${accent})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', position: 'relative' }}>
            {name.split(' ').slice(1).join(' ') || 'Ramen'}
          </div>
          <div style={{ display: 'inline-block', marginTop: '8px', background: `linear-gradient(90deg, #FF6B6B, ${accent})`, color: '#fff', fontSize: '6px', padding: '4px 10px', borderRadius: '6px', fontWeight: 700 }}>Bestellen</div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Replace the template preview in `branding/page.tsx`**

In `app/app/admin/branding/page.tsx`, find the import block at the top and add:

```ts
import { TemplatePreviewCard } from '@/components/landing/TemplatePreviewCard'
```

Then find the existing preview block (the `<div style={{ height: '70px'...` div that renders color swatches — around line 967) and replace it with:

```tsx
<TemplatePreviewCard config={cfg} name={tpl.name} />
```

Remove the old color swatches `<div style={{ display: 'flex', gap: '3px'...` block (around line 974-975) since the preview card already communicates the design.

- [ ] **Step 3: Check TypeScript compiles**

```bash
cd app && npx tsc --noEmit 2>&1 | grep "TemplatePreviewCard\|branding" | head -20
```

- [ ] **Step 4: Commit**

```bash
git add app/components/landing/TemplatePreviewCard.tsx app/app/admin/branding/page.tsx
git commit -m "feat(branding): replace color-swatch preview with live TemplatePreviewCard"
```

---

## Task 13: Migration — 5 premium template seeds

**Files:**
- Create: `app/supabase/migrations/20260623_001_premium_templates.sql`

- [ ] **Step 1: Create the migration**

```sql
-- app/supabase/migrations/20260623_001_premium_templates.sql
-- Upsert 5 premium templates. Uses ON CONFLICT (slug) so re-running is safe.

INSERT INTO design_templates (name, slug, category, config, plan_tier, style_tags, preview_url)
VALUES
  (
    'Rustico',
    'premium-rustico',
    'italian',
    '{
      "bg_color": "#F5EDE0",
      "surface_color": "#FFFFFF",
      "header_color": "#3D2010",
      "primary_color": "#C4622D",
      "button_color": "#C4622D",
      "card_color": "#FFFFFF",
      "text_color": "#3D2010",
      "font_pair": "playfair-lato",
      "layout_variant": "cards",
      "hero_layout": "classic-overlay",
      "border_radius": "rounded",
      "hover_effect": "scale",
      "animation_style": "fade",
      "card_style": "elevated"
    }',
    'free',
    '["warm", "italian", "classic", "family"]',
    null
  ),
  (
    'Strada',
    'premium-strada',
    'fastcasual',
    '{
      "bg_color": "#111111",
      "surface_color": "#1E1E1E",
      "header_color": "#111111",
      "primary_color": "#FF3B30",
      "button_color": "#FF3B30",
      "card_color": "#1E1E1E",
      "text_color": "#FFFFFF",
      "font_pair": "space-dmsans",
      "layout_variant": "large-cards",
      "hero_layout": "bold-statement",
      "border_radius": "rounded",
      "hover_effect": "glow",
      "animation_style": "slide",
      "card_style": "elevated"
    }',
    'free',
    '["dark", "bold", "burger", "street-food", "energetic"]',
    null
  ),
  (
    'Bianco',
    'premium-bianco',
    'japanese',
    '{
      "bg_color": "#FAFAFA",
      "surface_color": "#FFFFFF",
      "header_color": "#FFFFFF",
      "primary_color": "#111111",
      "button_color": "#111111",
      "card_color": "#FFFFFF",
      "text_color": "#111111",
      "font_pair": "inter-inter",
      "layout_variant": "list",
      "hero_layout": "split",
      "border_radius": "sharp",
      "hover_effect": "underline",
      "animation_style": "fade",
      "card_style": "flat"
    }',
    'pro',
    '["minimal", "sushi", "fine-dining", "white", "elegant"]',
    null
  ),
  (
    'Natura',
    'premium-natura',
    'vegan',
    '{
      "bg_color": "#F0F4EC",
      "surface_color": "#FFFFFF",
      "header_color": "#F0F4EC",
      "primary_color": "#2D5016",
      "button_color": "#2D5016",
      "card_color": "#FFFFFF",
      "text_color": "#2D5016",
      "font_pair": "syne-dmsans",
      "layout_variant": "cards",
      "hero_layout": "centered-minimal",
      "border_radius": "pill",
      "hover_effect": "scale",
      "animation_style": "fade",
      "card_style": "outlined"
    }',
    'free',
    '["green", "vegan", "organic", "minimal", "bowl"]',
    null
  ),
  (
    'Vibrante',
    'premium-vibrante',
    'asian',
    '{
      "bg_color": "#0D0D1A",
      "surface_color": "#1A1A2E",
      "header_color": "#0D0D1A",
      "primary_color": "#A855F7",
      "button_color": "#A855F7",
      "card_color": "#1A1A2E",
      "text_color": "#FFFFFF",
      "accent_secondary": "#FF6B6B",
      "font_pair": "space-dmsans",
      "layout_variant": "grid",
      "hero_layout": "gradient-glow",
      "border_radius": "rounded",
      "hover_effect": "glow",
      "animation_style": "slide",
      "card_style": "ghost"
    }',
    'free',
    '["dark", "neon", "ramen", "asian", "gradient", "night"]',
    null
  )
ON CONFLICT (slug) DO UPDATE SET
  name       = EXCLUDED.name,
  category   = EXCLUDED.category,
  config     = EXCLUDED.config,
  plan_tier  = EXCLUDED.plan_tier,
  style_tags = EXCLUDED.style_tags;
```

- [ ] **Step 2: Apply the migration**

```bash
cd app && npx supabase db push 2>&1 | tail -10
```

Expected: `Applying migration 20260623_001_premium_templates.sql` with success message.

- [ ] **Step 3: Verify in Supabase**

```bash
cd app && npx supabase db exec --db-url "$DATABASE_URL" "SELECT slug, name FROM design_templates WHERE slug LIKE 'premium-%';" 2>&1
```

Expected: 5 rows with the premium template slugs.

- [ ] **Step 4: Commit**

```bash
git add app/supabase/migrations/20260623_001_premium_templates.sql
git commit -m "feat(db): seed 5 premium templates (Rustico/Strada/Bianco/Natura/Vibrante)"
```

---

## Task 14: End-to-end smoke test

- [ ] **Step 1: Start the dev server**

```bash
cd app && npm run dev
```

- [ ] **Step 2: Test each template on the landing page**

For a test restaurant (use any existing restaurant in your DB), open Supabase Studio and manually update `design_config` to include `"hero_layout": "classic-overlay"` (or whichever you want to test). Then open `http://localhost:3000/[your-slug]/info` and verify the hero renders correctly.

Repeat for each `heroLayout` value:
- `classic-overlay` → warm overlay with serif name
- `bold-statement` → dark page, huge bold text, featured strip
- `split` → two-column, image right
- `centered-minimal` → centered, green pills
- `gradient-glow` → dark with purple/red glow

- [ ] **Step 3: Test the branding gallery**

Open `http://localhost:3000/admin/branding` → Templates tab. Verify the 5 premium templates show live preview cards (not color swatches).

- [ ] **Step 4: Apply a premium template and check all surfaces**

Click "Anwenden" on "Rustico". Then visit:
- `http://localhost:3000/[slug]/info` — should render `HeroClassicOverlay`
- `http://localhost:3000/bestellen/[slug]` — should render with warm Rustico colors + rounded elevated cards
- `http://localhost:3000/order/[token]` — same warm colors + rounded elevated cards

- [ ] **Step 5: Final commit**

```bash
git add -A && git commit -m "test: smoke-tested all 5 premium templates across 3 guest surfaces"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ `resolveBrand` extended with `heroLayout` → Task 2
- ✅ `accentSecondary` in `ColorSet` → Task 1
- ✅ `HeroClassicOverlay` (Rustico) → Task 4
- ✅ `HeroBoldStatement` (Strada) + featuredItems query → Task 5 + Task 9
- ✅ `HeroSplit` (Bianco) → Task 6
- ✅ `HeroCenteredMinimal` (Natura) → Task 7
- ✅ `HeroGradientGlow` (Vibrante) → Task 8
- ✅ `LandingHero` switch + landing page updated → Task 9
- ✅ `cardStyle` + `borderRadius` wired to `MenuItemCard` → Tasks 10–11
- ✅ `TemplatePreviewCard` live preview in gallery → Task 12
- ✅ Migration with 5 premium template seeds → Task 13
- ✅ `HeroProps` shared type → Task 3

**Type consistency check:**
- `HeroProps` defined in Task 3, used in Tasks 4–8 ✅
- `FeaturedItem` defined in Task 3, used in Task 5 + Task 9 ✅
- `heroLayout` added to `ResolvedBrand` in Task 2, read in Task 9 ✅
- `accentSecondary` added to `ColorSet` in Task 1, used in Task 8 ✅
- `borderRadius` + `cardStyle` props added to `MenuItemCard` in Task 10, passed in Task 11 ✅
