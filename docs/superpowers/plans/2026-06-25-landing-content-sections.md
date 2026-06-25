# Landing-Inhalte: Neue Sektionen + Toggles + KI (Teilprojekt 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vier neue Landing-Sektionen (Team, Geschichte, Atmosphäre, Auszeichnungen) mit pro-Sektion Sichtbarkeits-Toggles und einem KI-Text-Endpoint — plus Reparatur der Save-Route, die aktuell alle strukturierten Content-Felder verwirft.

**Architecture:** Alle neuen Daten leben im bestehenden `content`-JSON von `landing_pages` (keine DB-Migration). Kanonische Typen in `app/lib/landing-content.ts`. Sichtbarkeit über reine Funktion `isSectionVisible`. Die Save-Route validiert Content künftig typbewusst über `sanitizeLandingContent` (statt 7-Key-String-Whitelist). Vier fokussierte Sektions-Komponenten, eingehängt in `LandingPageSections`. KI-Text per On-Demand-Endpoint nach bestehendem AI-Routen-Muster.

**Tech Stack:** Next.js 15 (App Router), TypeScript, React, Inline-Styles, Vitest (node-Umgebung), Anthropic SDK (`@anthropic-ai/sdk` ^0.82.0, bereits installiert).

---

## Kontext für den Implementierer (unbedingt lesen)

- **Kanonischer Typ** `app/lib/landing-content.ts` → `LandingPageContent`. Bestehende Felder u.a.: `logo_url, hero_image_url, headline, subheadline, about_text, cta_text, cta_url, lp_layout, address, maps_url, phone, email, instagram, facebook, gallery, feature_badges, review_url, google_rating, google_review_count, google_maps_url, review_quotes, opening_hours`. Außerdem existieren `ReviewQuote`, `OpeningHours`, `OpeningHoursDay`.
- **Brand:** `ResolvedBrand` (`app/lib/resolve-brand.ts`) hat `colors` (ColorSet) und `font` (FontPair). **Es gibt KEIN `colors.primary`** — gültige Farben: `bg, surface, surface2, border, accent, accentSecondary, text, muted, headerBg, headerText, buttonBg, buttonText, cardBg`.
- **Rendering:** `app/components/landing/LandingPageSections.tsx` rendert aktuell 9 Sektionen (Info-Strip, Galerie, Featured Menu, Über uns, Öffnungszeiten, Bewertungen, Reservierung CTA, Kontakt, Instagram). Es nutzt lokale Style-Objekte `sectionStyle` (`{ padding:'40px 24px', borderTop:'1px solid colors.border' }`), `innerStyle` (`{ maxWidth:'680px', margin:'0 auto' }`), `sectionLabel`.
- **BEKANNTER BUG (in Task 3 zu fixen):** Die Save-Route `app/app/api/admin/landing-page/route.ts` (PATCH) hat eine `ALLOWED_CONTENT_KEYS`-Whitelist mit nur 7 String-Keys und lehnt jeden Nicht-String-Wert ab. Dadurch werden `gallery`, `opening_hours`, `google_rating`, `review_quotes`, `feature_badges`, `lp_layout` etc. beim Speichern still verworfen. Der Admin-Tab (`LandingPageTab.tsx`) sendet aber das volle Content-Objekt. Die Public-Seite zeigt diese Felder nur, weil das Test-Restaurant direkt in der DB geseedet wurde. **Diese Route muss auf typbewusste Validierung umgestellt werden, sonst sind die neuen Felder nicht speicherbar.**
- **AI-Routen-Muster:** Siehe `app/app/api/ai/landing-page-content/route.ts`. Auth via Bearer-Token (`getUser`), Ownership via `owner_id` (`checkOwnership`), `rateLimit(key, max, windowMs)` aus `@/lib/rate-limit`, API-Key via `resolveAiKey(restaurant_id)` aus `@/lib/ai-key` (gibt `null` → 403 mit deutscher Meldung), Modell `claude-haiku-4-5-20251001`.
- **Test-Setup:** Vitest, `environment: 'node'`, `include: ['lib/**/*.test.ts']`. Reine Logik unter `lib/` wird per Vitest getestet (TDD). Komponenten/Routen werden per `tsc --noEmit` + manueller Prüfung verifiziert (kein jsdom einführen).
- **Befehle (aus `app/`):** Typecheck `npx tsc --noEmit`, Tests `npm test`, gezielt `npm test -- <name>`.
- `.env.local` niemals lesen/schreiben. Kein `console.log` im finalen Code (außer bestehende `console.error` in Routen — Muster beibehalten).

---

## Dateienübersicht

- **Modify** `app/lib/landing-content.ts` — neue Typen `TeamMember`, `Award`, `SectionKey` + neue Felder in `LandingPageContent`.
- **Create** `app/lib/landing-visibility.ts` + `app/lib/__tests__/landing-visibility.test.ts` — `isSectionVisible`.
- **Create** `app/lib/landing-content-validate.ts` + `app/lib/__tests__/landing-content-validate.test.ts` — `sanitizeLandingContent`.
- **Modify** `app/app/api/admin/landing-page/route.ts` — Whitelist durch `sanitizeLandingContent` ersetzen.
- **Create** `app/components/landing/sections/TeamSection.tsx`, `StorySection.tsx`, `AmbianceSection.tsx`, `AwardsSection.tsx`.
- **Modify** `app/components/landing/LandingPageSections.tsx` — 4 Sektionen einhängen + alle Sektionen mit `isSectionVisible` gaten.
- **Create** `app/app/api/ai/landing-section/route.ts` — KI-Text pro Feld (`about` | `story`).

---

### Task 1: Typen erweitern

**Files:**
- Modify: `app/lib/landing-content.ts`

- [ ] **Step 1: Neue Typen + Felder ergänzen**

In `app/lib/landing-content.ts`, NACH dem `ReviewQuote`-Interface (vor `OpeningHoursDay`) einfügen:
```ts
export interface TeamMember {
  name: string
  role: string
  photo_url?: string
}

export interface Award {
  title: string
  subtitle?: string
  logo_url?: string
}

export type SectionKey =
  | 'gallery' | 'featured_menu' | 'about' | 'team' | 'story'
  | 'ambiance' | 'awards' | 'opening_hours' | 'reviews'
  | 'reservation_cta' | 'contact' | 'instagram'
```

Und INNERHALB von `interface LandingPageContent`, direkt VOR der schließenden `}` (nach dem `opening_hours?`-Feld), einfügen:
```ts

  // Team
  team?: TeamMember[]

  // Geschichte
  story_text?: string
  story_image_url?: string
  founded_year?: string

  // Atmosphäre
  ambiance_gallery?: string[]

  // Auszeichnungen
  awards?: Award[]

  // Sichtbarkeit pro Sektion (Default: alle sichtbar)
  section_visibility?: Partial<Record<SectionKey, boolean>>
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: 0 Fehler.

- [ ] **Step 3: Commit**
```bash
git add app/lib/landing-content.ts
git commit -m "feat(landing): add team/story/ambiance/awards types + section_visibility"
```

---

### Task 2: `isSectionVisible` Helper (TDD)

**Files:**
- Create: `app/lib/landing-visibility.ts`
- Test: `app/lib/__tests__/landing-visibility.test.ts`

- [ ] **Step 1: Failing Test schreiben**

Datei `app/lib/__tests__/landing-visibility.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { isSectionVisible } from '@/lib/landing-visibility'
import type { LandingPageContent } from '@/lib/landing-content'

describe('isSectionVisible', () => {
  it('ist sichtbar wenn keine section_visibility gesetzt ist', () => {
    expect(isSectionVisible('team', {})).toBe(true)
  })

  it('ist sichtbar wenn der Key fehlt obwohl andere gesetzt sind', () => {
    const content: LandingPageContent = { section_visibility: { story: false } }
    expect(isSectionVisible('team', content)).toBe(true)
  })

  it('ist unsichtbar wenn explizit auf false', () => {
    const content: LandingPageContent = { section_visibility: { team: false } }
    expect(isSectionVisible('team', content)).toBe(false)
  })

  it('ist sichtbar wenn explizit auf true', () => {
    const content: LandingPageContent = { section_visibility: { team: true } }
    expect(isSectionVisible('team', content)).toBe(true)
  })
})
```

- [ ] **Step 2: Test laufen, Fehlschlag bestätigen**

Run: `cd app && npm test -- landing-visibility`
Expected: FAIL — `Failed to resolve import "@/lib/landing-visibility"`.

- [ ] **Step 3: Implementierung schreiben**

Datei `app/lib/landing-visibility.ts`:
```ts
import type { LandingPageContent, SectionKey } from './landing-content'

/**
 * Eine Sektion ist sichtbar, solange der Betreiber sie nicht explizit
 * deaktiviert hat. Default (kein Eintrag) = sichtbar.
 * Die zusätzliche Inhalts-Prüfung (hat die Sektion überhaupt Daten?)
 * bleibt am jeweiligen Render-Ort.
 */
export function isSectionVisible(key: SectionKey, content: LandingPageContent): boolean {
  return content.section_visibility?.[key] !== false
}
```

- [ ] **Step 4: Test laufen, Erfolg bestätigen**

Run: `cd app && npm test -- landing-visibility`
Expected: PASS (4 Tests grün).

- [ ] **Step 5: Commit**
```bash
git add app/lib/landing-visibility.ts app/lib/__tests__/landing-visibility.test.ts
git commit -m "feat(landing): add isSectionVisible helper with tests"
```

---

### Task 3: `sanitizeLandingContent` Validator (TDD) + Save-Route reparieren

**Files:**
- Create: `app/lib/landing-content-validate.ts`
- Test: `app/lib/__tests__/landing-content-validate.test.ts`
- Modify: `app/app/api/admin/landing-page/route.ts`

- [ ] **Step 1: Failing Test schreiben**

Datei `app/lib/__tests__/landing-content-validate.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { sanitizeLandingContent } from '@/lib/landing-content-validate'

describe('sanitizeLandingContent', () => {
  it('übernimmt bekannte String-Felder', () => {
    const out = sanitizeLandingContent({ headline: 'Hallo', about_text: 'Text' })
    expect(out.headline).toBe('Hallo')
    expect(out.about_text).toBe('Text')
  })

  it('verwirft unbekannte Keys', () => {
    const out = sanitizeLandingContent({ headline: 'Hi', evil: 'x', __proto__pollute: 1 }) as Record<string, unknown>
    expect(out.headline).toBe('Hi')
    expect(out.evil).toBeUndefined()
  })

  it('behält Galerie + Ambiente als String-Arrays und filtert Nicht-Strings', () => {
    const out = sanitizeLandingContent({ gallery: ['a', 2, 'b'], ambiance_gallery: ['x'] })
    expect(out.gallery).toEqual(['a', 'b'])
    expect(out.ambiance_gallery).toEqual(['x'])
  })

  it('behält Zahlen für google_rating', () => {
    const out = sanitizeLandingContent({ google_rating: 4.5, google_review_count: 120 })
    expect(out.google_rating).toBe(4.5)
    expect(out.google_review_count).toBe(120)
  })

  it('validiert team: nur Objekte mit name+role, photo_url optional', () => {
    const out = sanitizeLandingContent({
      team: [
        { name: 'Marco', role: 'Chefkoch', photo_url: 'u' },
        { name: 'Ohne Rolle' },
        'garbage',
      ],
    })
    expect(out.team).toEqual([{ name: 'Marco', role: 'Chefkoch', photo_url: 'u' }])
  })

  it('validiert awards: title pflicht, subtitle/logo_url optional', () => {
    const out = sanitizeLandingContent({
      awards: [{ title: 'Stern', subtitle: '2024' }, { subtitle: 'kein Titel' }],
    })
    expect(out.awards).toEqual([{ title: 'Stern', subtitle: '2024' }])
  })

  it('übernimmt section_visibility nur als Booleans bekannter Keys', () => {
    const out = sanitizeLandingContent({
      section_visibility: { team: false, story: true, bogus: false, contact: 'no' },
    })
    expect(out.section_visibility).toEqual({ team: false, story: true })
  })

  it('liefert {} bei Nicht-Objekt-Eingabe', () => {
    expect(sanitizeLandingContent(null)).toEqual({})
    expect(sanitizeLandingContent('x')).toEqual({})
    expect(sanitizeLandingContent([1, 2])).toEqual({})
  })

  it('behält opening_hours mit gültigen Tagen', () => {
    const out = sanitizeLandingContent({
      opening_hours: { mo: { open: true, from: '10:00', to: '22:00' }, di: { open: false }, xx: { open: true } },
    })
    expect(out.opening_hours).toEqual({ mo: { open: true, from: '10:00', to: '22:00' }, di: { open: false } })
  })
})
```

- [ ] **Step 2: Test laufen, Fehlschlag bestätigen**

Run: `cd app && npm test -- landing-content-validate`
Expected: FAIL — `Failed to resolve import "@/lib/landing-content-validate"`.

- [ ] **Step 3: Implementierung schreiben**

Datei `app/lib/landing-content-validate.ts`:
```ts
import type {
  LandingPageContent, OpeningHours, OpeningHoursDay, ReviewQuote,
  TeamMember, Award, SectionKey,
} from './landing-content'

const SECTION_KEYS: SectionKey[] = [
  'gallery', 'featured_menu', 'about', 'team', 'story', 'ambiance',
  'awards', 'opening_hours', 'reviews', 'reservation_cta', 'contact', 'instagram',
]
const DAY_KEYS = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'] as const

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}
function asStringArray(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined
}
function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}
function asOpeningDay(v: unknown): OpeningHoursDay | undefined {
  if (typeof v !== 'object' || v === null) return undefined
  const o = v as Record<string, unknown>
  if (typeof o.open !== 'boolean') return undefined
  const day: OpeningHoursDay = { open: o.open }
  if (typeof o.from === 'string') day.from = o.from
  if (typeof o.to === 'string') day.to = o.to
  return day
}
function asOpeningHours(v: unknown): OpeningHours | undefined {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined
  const o = v as Record<string, unknown>
  const result: OpeningHours = {}
  for (const d of DAY_KEYS) {
    const day = asOpeningDay(o[d])
    if (day) result[d] = day
  }
  return result
}
function asTeam(v: unknown): TeamMember[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v
    .map((m): TeamMember | null => {
      if (typeof m !== 'object' || m === null) return null
      const o = m as Record<string, unknown>
      if (typeof o.name !== 'string' || typeof o.role !== 'string') return null
      const member: TeamMember = { name: o.name, role: o.role }
      if (typeof o.photo_url === 'string') member.photo_url = o.photo_url
      return member
    })
    .filter((m): m is TeamMember => m !== null)
}
function asAwards(v: unknown): Award[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v
    .map((a): Award | null => {
      if (typeof a !== 'object' || a === null) return null
      const o = a as Record<string, unknown>
      if (typeof o.title !== 'string') return null
      const award: Award = { title: o.title }
      if (typeof o.subtitle === 'string') award.subtitle = o.subtitle
      if (typeof o.logo_url === 'string') award.logo_url = o.logo_url
      return award
    })
    .filter((a): a is Award => a !== null)
}
function asReviewQuotes(v: unknown): ReviewQuote[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v
    .map((q): ReviewQuote | null => {
      if (typeof q !== 'object' || q === null) return null
      const o = q as Record<string, unknown>
      if (typeof o.text !== 'string' || typeof o.author !== 'string') return null
      const quote: ReviewQuote = { text: o.text, author: o.author }
      if (typeof o.stars === 'number') quote.stars = o.stars
      return quote
    })
    .filter((q): q is ReviewQuote => q !== null)
}
function asSectionVisibility(v: unknown): Partial<Record<SectionKey, boolean>> | undefined {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined
  const o = v as Record<string, unknown>
  const result: Partial<Record<SectionKey, boolean>> = {}
  for (const k of SECTION_KEYS) {
    if (typeof o[k] === 'boolean') result[k] = o[k] as boolean
  }
  return result
}

/**
 * Server-seitige Validierung des Landing-Content-JSON.
 * Übernimmt NUR bekannte Felder mit korrektem Typ (Allowlist).
 * Unbekannte Keys werden verworfen — schützt die DB-Zeile vor Müll.
 */
export function sanitizeLandingContent(raw: unknown): LandingPageContent {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const o = raw as Record<string, unknown>
  const c: LandingPageContent = {}

  const stringKeys = [
    'logo_url', 'hero_image_url', 'headline', 'subheadline', 'about_text', 'cta_text', 'cta_url',
    'lp_design_package', 'lp_layout', 'address', 'maps_url', 'phone', 'email', 'instagram', 'facebook',
    'review_url', 'google_maps_url', 'story_text', 'story_image_url', 'founded_year',
  ] as const
  for (const k of stringKeys) {
    const s = asString(o[k])
    if (s !== undefined) (c as Record<string, unknown>)[k] = s
  }

  const gallery = asStringArray(o.gallery); if (gallery) c.gallery = gallery
  const badges = asStringArray(o.feature_badges); if (badges) c.feature_badges = badges
  const ambiance = asStringArray(o.ambiance_gallery); if (ambiance) c.ambiance_gallery = ambiance

  const rating = asNumber(o.google_rating); if (rating !== undefined) c.google_rating = rating
  const count = asNumber(o.google_review_count); if (count !== undefined) c.google_review_count = count

  const oh = asOpeningHours(o.opening_hours); if (oh) c.opening_hours = oh
  const team = asTeam(o.team); if (team) c.team = team
  const awards = asAwards(o.awards); if (awards) c.awards = awards
  const quotes = asReviewQuotes(o.review_quotes); if (quotes) c.review_quotes = quotes
  const vis = asSectionVisibility(o.section_visibility); if (vis) c.section_visibility = vis

  return c
}
```

- [ ] **Step 4: Test laufen, Erfolg bestätigen**

Run: `cd app && npm test -- landing-content-validate`
Expected: PASS (9 Tests grün).

- [ ] **Step 5: Save-Route auf den Validator umstellen**

In `app/app/api/admin/landing-page/route.ts`:

(a) Import ergänzen (nach der `createSupabaseAdmin`-Import-Zeile):
```ts
import { sanitizeLandingContent } from '@/lib/landing-content-validate'
import type { LandingPageContent } from '@/lib/landing-content'
```

(b) Die lokale Duplikat-Definition löschen:
```ts
export interface LandingPageContent {
  logo_url?: string
  hero_image_url?: string
  headline?: string
  subheadline?: string
  about_text?: string
  cta_text?: string
  cta_url?: string
}
```
(Der `interface LandingPageRow { ... }` direkt darunter BLEIBT — er referenziert `LandingPageContent`, das jetzt importiert wird.)

(c) Den `ALLOWED_CONTENT_KEYS`-Block löschen:
```ts
const ALLOWED_CONTENT_KEYS: ReadonlySet<string> = new Set([
  'logo_url',
  'hero_image_url',
  'headline',
  'subheadline',
  'about_text',
  'cta_text',
  'cta_url',
])
```

(d) Im PATCH-Handler den Validierungsblock ersetzen. Ersetze:
```ts
  // Validate content fields
  let safeContent: LandingPageContent | undefined
  if (content !== undefined) {
    if (typeof content !== 'object' || content === null || Array.isArray(content)) {
      return NextResponse.json({ error: 'content muss ein Objekt sein' }, { status: 400 })
    }
    const cleaned: LandingPageContent = {}
    for (const [key, val] of Object.entries(content)) {
      if (!ALLOWED_CONTENT_KEYS.has(key)) continue
      if (val !== undefined && typeof val !== 'string') {
        return NextResponse.json({ error: `Feld "${key}" muss ein String sein` }, { status: 400 })
      }
      if (typeof val === 'string') {
        (cleaned as Record<string, string>)[key] = val
      }
    }
    safeContent = cleaned
  }
```
durch:
```ts
  // Validate content fields (typbewusst: behält alle bekannten Felder, verwirft Müll)
  let safeContent: LandingPageContent | undefined
  if (content !== undefined) {
    if (typeof content !== 'object' || content === null || Array.isArray(content)) {
      return NextResponse.json({ error: 'content muss ein Objekt sein' }, { status: 400 })
    }
    safeContent = sanitizeLandingContent(content)
  }
```

- [ ] **Step 6: Typecheck + Tests**

Run: `cd app && npx tsc --noEmit`
Expected: 0 Fehler (`LandingPageRow` nutzt jetzt den importierten `LandingPageContent`).

Run: `cd app && npm test`
Expected: alle grün (inkl. neue landing-content-validate + landing-visibility + site-nav + resolve-brand).

- [ ] **Step 7: Commit**
```bash
git add app/lib/landing-content-validate.ts app/lib/__tests__/landing-content-validate.test.ts "app/app/api/admin/landing-page/route.ts"
git commit -m "fix(landing): persist full content shape via sanitizeLandingContent"
```

---

### Task 4: Vier neue Sektions-Komponenten

**Files:**
- Create: `app/components/landing/sections/TeamSection.tsx`
- Create: `app/components/landing/sections/StorySection.tsx`
- Create: `app/components/landing/sections/AmbianceSection.tsx`
- Create: `app/components/landing/sections/AwardsSection.tsx`

- [ ] **Step 1: `TeamSection.tsx` schreiben**

Datei `app/components/landing/sections/TeamSection.tsx`:
```tsx
import type { ResolvedBrand } from '@/lib/resolve-brand'
import type { TeamMember } from '@/lib/landing-content'

interface Props {
  brand: ResolvedBrand
  team: TeamMember[]
}

export function TeamSection({ brand, team }: Props) {
  const { colors } = brand
  return (
    <section style={{ padding: '40px 24px', borderTop: `1px solid ${colors.border}` }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: colors.accent, marginBottom: '20px', fontWeight: 700 }}>
          Unser Team
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '18px' }}>
          {team.map((m, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              {m.photo_url ? (
                <img src={m.photo_url} alt={m.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '14px', marginBottom: '10px' }} />
              ) : (
                <div style={{ width: '100%', aspectRatio: '1', borderRadius: '14px', marginBottom: '10px', background: colors.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 700, color: colors.muted }}>
                  {m.name.charAt(0)}
                </div>
              )}
              <div style={{ color: colors.text, fontWeight: 700, fontSize: '0.9rem' }}>{m.name}</div>
              <div style={{ color: colors.muted, fontSize: '0.78rem' }}>{m.role}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: `StorySection.tsx` schreiben**

Datei `app/components/landing/sections/StorySection.tsx`:
```tsx
import type { ResolvedBrand } from '@/lib/resolve-brand'

interface Props {
  brand: ResolvedBrand
  storyText: string
  imageUrl?: string
  foundedYear?: string
}

export function StorySection({ brand, storyText, imageUrl, foundedYear }: Props) {
  const { colors, font } = brand
  return (
    <section style={{ padding: '40px 24px', borderTop: `1px solid ${colors.border}` }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'grid', gridTemplateColumns: imageUrl ? 'minmax(0, 1fr) minmax(0, 1fr)' : '1fr', gap: '28px', alignItems: 'center' }}>
        {imageUrl && (
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', maxHeight: '360px', objectFit: 'cover', borderRadius: '16px' }} />
        )}
        <div>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: colors.accent, marginBottom: '12px', fontWeight: 700 }}>
            Unsere Geschichte
          </div>
          {foundedYear && (
            <div style={{ fontFamily: `${font.heading}, Georgia, serif`, fontStyle: 'italic', fontSize: '1.8rem', color: colors.text, marginBottom: '12px', fontWeight: 700 }}>
              Seit {foundedYear}
            </div>
          )}
          <p style={{ color: colors.muted, lineHeight: 1.8, fontSize: '0.95rem', whiteSpace: 'pre-line' }}>{storyText}</p>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: `AmbianceSection.tsx` schreiben**

Datei `app/components/landing/sections/AmbianceSection.tsx`:
```tsx
import type { ResolvedBrand } from '@/lib/resolve-brand'

interface Props {
  brand: ResolvedBrand
  images: string[]
}

export function AmbianceSection({ brand, images }: Props) {
  const { colors } = brand
  return (
    <section style={{ padding: '40px 24px', borderTop: `1px solid ${colors.border}` }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: colors.accent, marginBottom: '20px', fontWeight: 700 }}>
          Atmosphäre
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {images.map((url, i) => (
            <img key={i} src={url} alt="" style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '14px' }} />
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: `AwardsSection.tsx` schreiben**

Datei `app/components/landing/sections/AwardsSection.tsx`:
```tsx
import type { ResolvedBrand } from '@/lib/resolve-brand'
import type { Award } from '@/lib/landing-content'

interface Props {
  brand: ResolvedBrand
  awards: Award[]
}

export function AwardsSection({ brand, awards }: Props) {
  const { colors } = brand
  return (
    <section style={{ padding: '40px 24px', borderTop: `1px solid ${colors.border}`, background: colors.surface }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: colors.accent, marginBottom: '20px', fontWeight: 700 }}>
          Auszeichnungen & Presse
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {awards.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '14px 16px' }}>
              {a.logo_url ? (
                <img src={a.logo_url} alt="" style={{ width: '48px', height: '48px', objectFit: 'contain', flexShrink: 0 }} />
              ) : (
                <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>🏆</span>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ color: colors.text, fontWeight: 700, fontSize: '0.9rem' }}>{a.title}</div>
                {a.subtitle && <div style={{ color: colors.muted, fontSize: '0.78rem' }}>{a.subtitle}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: 0 Fehler.

- [ ] **Step 6: Commit**
```bash
git add app/components/landing/sections/
git commit -m "feat(landing): add Team/Story/Ambiance/Awards section components"
```

---

### Task 5: Sektionen einhängen + Sichtbarkeit gaten

**Files:**
- Modify: `app/components/landing/LandingPageSections.tsx`

Diese Sektion rendert aktuell 9 Blöcke. Jeder bekommt ein `isSectionVisible('<key>', content) &&` vorangestellt, und die 4 neuen Sektionen werden an den richtigen Stellen eingefügt. Reihenfolge danach: Info-Strip → Galerie → Featured Menu → Über uns → **Team** → **Geschichte** → **Atmosphäre** → Öffnungszeiten → **Auszeichnungen** → Bewertungen → Reservierung CTA → Kontakt → Instagram. (Info-Strip bleibt ungated — er ist die Status-Leiste, kein Toggle in `SectionKey`.)

- [ ] **Step 1: Imports ergänzen**

In `app/components/landing/LandingPageSections.tsx`, die bestehende Import-Zeile
```tsx
import type { LandingPageContent, OpeningHours } from '@/lib/landing-content'
```
ersetzen durch:
```tsx
import type { LandingPageContent, OpeningHours } from '@/lib/landing-content'
import { isSectionVisible } from '@/lib/landing-visibility'
import { TeamSection } from './sections/TeamSection'
import { StorySection } from './sections/StorySection'
import { AmbianceSection } from './sections/AmbianceSection'
import { AwardsSection } from './sections/AwardsSection'
```

- [ ] **Step 2: Galerie gaten**

Ersetze:
```tsx
      {/* ── 2. Galerie ── */}
      {(content.gallery ?? []).length > 0 && (
```
durch:
```tsx
      {/* ── 2. Galerie ── */}
      {isSectionVisible('gallery', content) && (content.gallery ?? []).length > 0 && (
```

- [ ] **Step 3: Featured Menu gaten**

Ersetze:
```tsx
      {/* ── 3. Featured Menu ── */}
      {featuredItems.length > 0 && (
```
durch:
```tsx
      {/* ── 3. Featured Menu ── */}
      {isSectionVisible('featured_menu', content) && featuredItems.length > 0 && (
```

- [ ] **Step 4: Über uns gaten UND die neuen Sektionen Team/Geschichte/Atmosphäre danach einfügen**

Ersetze:
```tsx
      {/* ── 4. Über uns ── */}
      {content.about_text && (
        <section style={sectionStyle}>
          <div style={innerStyle}>
            <h2 style={{ fontFamily: `${font.heading}, Georgia, serif`, fontStyle: 'italic', fontSize: '1.6rem', color: colors.text, marginBottom: '14px', fontWeight: 700 }}>Über uns</h2>
            <p style={{ color: colors.muted, lineHeight: 1.8, fontSize: '0.95rem' }}>{content.about_text}</p>
          </div>
        </section>
      )}
```
durch:
```tsx
      {/* ── 4. Über uns ── */}
      {isSectionVisible('about', content) && content.about_text && (
        <section style={sectionStyle}>
          <div style={innerStyle}>
            <h2 style={{ fontFamily: `${font.heading}, Georgia, serif`, fontStyle: 'italic', fontSize: '1.6rem', color: colors.text, marginBottom: '14px', fontWeight: 700 }}>Über uns</h2>
            <p style={{ color: colors.muted, lineHeight: 1.8, fontSize: '0.95rem' }}>{content.about_text}</p>
          </div>
        </section>
      )}

      {/* ── 5. Team ── */}
      {isSectionVisible('team', content) && (content.team?.length ?? 0) > 0 && (
        <TeamSection brand={brand} team={content.team!} />
      )}

      {/* ── 6. Geschichte ── */}
      {isSectionVisible('story', content) && content.story_text && (
        <StorySection brand={brand} storyText={content.story_text} imageUrl={content.story_image_url} foundedYear={content.founded_year} />
      )}

      {/* ── 7. Atmosphäre ── */}
      {isSectionVisible('ambiance', content) && (content.ambiance_gallery?.length ?? 0) > 0 && (
        <AmbianceSection brand={brand} images={content.ambiance_gallery!} />
      )}
```

- [ ] **Step 5: Öffnungszeiten gaten**

Ersetze:
```tsx
      {/* ── 5. Öffnungszeiten ── */}
      {content.opening_hours && hasAnyOpeningHours(content.opening_hours) && (
```
durch:
```tsx
      {/* ── 8. Öffnungszeiten ── */}
      {isSectionVisible('opening_hours', content) && content.opening_hours && hasAnyOpeningHours(content.opening_hours) && (
```

- [ ] **Step 6: Auszeichnungen einfügen + Bewertungen gaten**

Ersetze:
```tsx
      {/* ── 6. Bewertungen ── */}
      {content.google_rating != null && (
```
durch:
```tsx
      {/* ── 9. Auszeichnungen ── */}
      {isSectionVisible('awards', content) && (content.awards?.length ?? 0) > 0 && (
        <AwardsSection brand={brand} awards={content.awards!} />
      )}

      {/* ── 10. Bewertungen ── */}
      {isSectionVisible('reviews', content) && content.google_rating != null && (
```

- [ ] **Step 7: Reservierung CTA gaten (Wrap)**

Diese Sektion ist aktuell bedingungslos. Ersetze:
```tsx
      {/* ── 7. Reservierung CTA ── */}
      <section style={{ padding: '56px 24px', background: colors.accent, textAlign: 'center' }}>
```
durch:
```tsx
      {/* ── 11. Reservierung CTA ── */}
      {isSectionVisible('reservation_cta', content) && (
      <section style={{ padding: '56px 24px', background: colors.accent, textAlign: 'center' }}>
```
UND die zugehörige schließende `</section>` dieser CTA (direkt vor `{/* ── 8. Kontakt & Anfahrt ── */}`) ersetzen. Ersetze:
```tsx
        </div>
      </section>

      {/* ── 8. Kontakt & Anfahrt ── */}
```
durch:
```tsx
        </div>
      </section>
      )}

      {/* ── 12. Kontakt & Anfahrt ── */}
```

- [ ] **Step 8: Kontakt gaten**

Ersetze:
```tsx
      {(content.address || content.phone || content.email) && (
        <section id="kontakt" style={sectionStyle}>
```
durch:
```tsx
      {isSectionVisible('contact', content) && (content.address || content.phone || content.email) && (
        <section id="kontakt" style={sectionStyle}>
```

- [ ] **Step 9: Instagram gaten**

Ersetze:
```tsx
      {/* ── 9. Instagram ── */}
      {content.instagram && (
```
durch:
```tsx
      {/* ── 13. Instagram ── */}
      {isSectionVisible('instagram', content) && content.instagram && (
```

- [ ] **Step 10: Typecheck + Tests + manuelle Prüfung**

Run: `cd app && npx tsc --noEmit`
Expected: 0 Fehler.

Run: `cd app && npm test`
Expected: alle grün.

Manuell (Dev-Server läuft): `http://localhost:3000/italiener/info` öffnen. Bestehende Sektionen erscheinen weiterhin. Neue Sektionen erscheinen, sobald das Restaurant entsprechende Felder (`team`, `story_text`, `ambiance_gallery`, `awards`) im Content hat — ohne Daten bleiben sie unsichtbar (das ist korrekt; befüllt werden sie über den Admin in Teilprojekt 3).

- [ ] **Step 11: Commit**
```bash
git add app/components/landing/LandingPageSections.tsx
git commit -m "feat(landing): render 4 new sections + visibility gating for all sections"
```

---

### Task 6: KI-Text-Endpoint pro Feld

**Files:**
- Create: `app/app/api/ai/landing-section/route.ts`

Spiegelt das Muster von `app/app/api/ai/landing-page-content/route.ts`, generiert aber den Text genau eines Feldes (`about` | `story`) und gibt `{ text }` zurück. Für die ✨-Buttons im Admin-Editor (Teilprojekt 3).

- [ ] **Step 1: Route schreiben**

Datei `app/app/api/ai/landing-section/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveAiKey } from '@/lib/ai-key'
import { rateLimit } from '@/lib/rate-limit'

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

async function checkOwnership(userId: string, restaurantId: string): Promise<boolean> {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', userId)
    .maybeSingle()
  return !!data
}

const FIELD_PROMPTS: Record<'about' | 'story', string> = {
  about: 'Schreibe einen einladenden "Über uns"-Text (3-4 Sätze) für die Website dieses Restaurants. Persönlich, einladend, ohne Floskeln.',
  story: 'Schreibe eine kurze Gründungs-/Geschichte (3-5 Sätze) für die Website dieses Restaurants. Erzähle von Ursprung, Werten und Leidenschaft. Persönlich und glaubwürdig.',
}

// POST — generate text for a single landing section field
export async function POST(req: NextRequest) {
  let body: { restaurant_id?: string; field?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { restaurant_id, field } = body

  if (typeof restaurant_id !== 'string' || !restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id erforderlich' }, { status: 400 })
  }
  if (field !== 'about' && field !== 'story') {
    return NextResponse.json({ error: 'Ungültiges Feld' }, { status: 400 })
  }

  const { user } = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

  const isOwner = await checkOwnership(user.id, restaurant_id)
  if (!isOwner) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const allowed = await rateLimit(`landing-section:${restaurant_id}`, 10, 3_600_000)
  if (!allowed) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte später erneut versuchen.' }, { status: 429 })
  }

  const apiKey = await resolveAiKey(restaurant_id)
  if (!apiKey) {
    return NextResponse.json(
      { error: 'KI nicht verfügbar. Bitte Pro-Plan buchen und API Key eintragen.' },
      { status: 403 }
    )
  }

  const admin = createSupabaseAdmin()
  const { data: restaurant, error: restoErr } = await admin
    .from('restaurants')
    .select('name, restaurant_category, description')
    .eq('id', restaurant_id)
    .single()

  if (restoErr || !restaurant) {
    return NextResponse.json({ error: 'Restaurant nicht gefunden' }, { status: 404 })
  }

  const name = restaurant.name as string
  const category = (restaurant.restaurant_category as string | null) ?? 'Restaurant'
  const description = (restaurant.description as string | null) ?? 'none'

  const anthropic = new Anthropic({ apiKey })

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: 'Du bist Werbetexter für Restaurant-Websites. Antworte NUR mit dem reinen Text — ohne Anführungszeichen, ohne Vorrede, ohne Überschrift.',
      messages: [
        {
          role: 'user',
          content: `${FIELD_PROMPTS[field]}\n\nRestaurant: "${name}". Kategorie: ${category}. Beschreibung: ${description}. Sprache: Deutsch.`,
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    if (!text) {
      return NextResponse.json({ error: 'Leere KI-Antwort' }, { status: 500 })
    }
    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ error: 'KI momentan nicht verfügbar' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: 0 Fehler.

- [ ] **Step 3: Commit**
```bash
git add "app/app/api/ai/landing-section/route.ts"
git commit -m "feat(landing): add per-field AI text endpoint (about/story)"
```

---

## Final Verification (nach allen Tasks)

- [ ] **Typecheck:** `cd app && npx tsc --noEmit` → 0 Fehler.
- [ ] **Tests:** `cd app && npm test` → alle grün (site-nav, resolve-brand, landing-visibility, landing-content-validate).
- [ ] **Manuell — Rendering:** `http://localhost:3000/italiener/info` lädt (HTTP 200), bestehende Sektionen unverändert.
- [ ] **Manuell — Save-Fix (wichtig):** Im Admin (`/admin/branding`, Tab Landing Page) eine strukturierte Änderung speichern (z.B. eine Bewertung/Galerie-Bild) und neu laden → bleibt erhalten (vorher wurde es verworfen).
- [ ] **Optional — KI:** Ohne `ANTHROPIC`-Key liefert `POST /api/ai/landing-section` 403 mit deutscher Meldung (kein 500).

---

## Self-Review (durchgeführt)

**1. Spec-Abdeckung (Teilprojekt 2):**
- Typen `team/story/ambiance/awards/section_visibility` → Task 1 ✓
- 4 Sektions-Komponenten → Task 4 ✓
- Einhängen in Reihenfolge (Team nach Über-uns, Geschichte, Atmosphäre, Auszeichnungen vor Bewertungen) → Task 5 ✓
- Sichtbarkeits-Toggle pro Sektion (`isSectionVisible`, alle Sektionen gegated, Hero/Footer/Info-Strip ausgenommen) → Task 2 + Task 5 ✓
- KI-Endpoint mit Key-Fallback (403 ohne Key) → Task 6 ✓
- Keine DB-Migration (alles im JSON) ✓
- **Zusätzlich nötig & ergänzt:** Save-Route-Reparatur (Bug: strukturierte Felder wurden verworfen) → Task 3.

**2. Placeholder-Scan:** Keine TBD/TODO; jeder Code-Schritt zeigt vollständigen Code; alle Edits als exakte old→new-Blöcke.

**3. Typ-Konsistenz:** `SectionKey` (Task 1) wird in `isSectionVisible` (Task 2), `sanitizeLandingContent` (Task 3) und den Render-Gates (Task 5) identisch genutzt. `TeamMember`/`Award` (Task 1) werden in den Komponenten (Task 4), im Validator (Task 3) und beim Einhängen (Task 5) konsistent verwendet. Komponenten-Props: `TeamSection({brand, team})`, `StorySection({brand, storyText, imageUrl?, foundedYear?})`, `AmbianceSection({brand, images})`, `AwardsSection({brand, awards})` — die Aufrufe in Task 5 passen exakt (`content.team!`, `content.story_text`, `content.ambiance_gallery!`, `content.awards!`). Die KI-Route gibt `{ text }` zurück (Task 6), passend für die Teilprojekt-3-Buttons.
