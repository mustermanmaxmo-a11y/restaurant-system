# Restaurant Landing Page — Vollständige Website Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Alle 5 Premium-Templates auf der `/[slug]/info` Landing Page zu vollständigen Restaurant-Websites ausbauen — mit Galerie, Featured Menu, Öffnungszeiten, Bewertungen, Reservierungs-CTA, Kontakt, Instagram und Footer.

**Architecture:** Die hero-spezifischen Komponenten (`HeroClassicOverlay`, etc.) rendern künftig nur noch den visuellen Hero-Block. Alle anderen Sektionen werden in eine neue `LandingPageSections.tsx` extrahiert, die von allen Templates geteilt wird. Luca kann neue Templates hinzufügen ohne je eine Sektion anzufassen.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (admin client), Inline-Styles für brand-dynamische Werte, kein Tailwind für Laufzeit-Farben.

---

## 1. Architektur

### Vorher
```
page.tsx → <LandingHero> → HeroClassicOverlay (Hero + InfoStrip + About + MenuCTA + Footer)
```

### Nachher
```
page.tsx → <LandingHero>          (nur hero-spezifischer Block, template-abhängig)
         → <LandingPageSections>  (alle gemeinsamen Sektionen, template-unabhängig)
```

### Neue / geänderte Dateien

| Datei | Aktion | Zweck |
|-------|--------|-------|
| `app/lib/landing-content.ts` | **Erstellen** | Kanonischer `LandingPageContent`-Typ (geteilt zwischen Public + Admin) |
| `app/components/landing/LandingPageSections.tsx` | **Erstellen** | Alle 8 gemeinsamen Sektionen |
| `app/app/[slug]/info/page.tsx` | **Ändern** | Daten-Fetching erweitern + beide Komponenten rendern |
| `app/components/landing/HeroClassicOverlay.tsx` | **Ändern** | Nur Hero-Block behalten, Rest entfernen |
| `app/components/landing/HeroBoldStatement.tsx` | **Ändern** | Nur Hero-Block behalten |
| `app/components/landing/HeroSplit.tsx` | **Ändern** | Nur Hero-Block behalten |
| `app/components/landing/HeroCenteredMinimal.tsx` | **Ändern** | Nur Hero-Block behalten |
| `app/components/landing/HeroGradientGlow.tsx` | **Ändern** | Nur Hero-Block behalten |
| `app/components/landing/types.ts` | **Ändern** | `HeroContent` auf `LandingPageContent` umstellen |
| `app/app/admin/branding/LandingPageTab.tsx` | **Ändern** | Review-Felder (Rating, Count, Zitate) in Inhalt-Tab ergänzen |

---

## 2. Gemeinsamer Typ: `LandingPageContent`

Datei: `app/lib/landing-content.ts`

```ts
export interface ReviewQuote {
  text: string
  author: string
  stars?: number // 1-5, default 5
}

export interface OpeningHoursDay {
  open: boolean
  from?: string  // "11:00"
  to?: string    // "23:00"
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
  hero_image_url?: string
  headline?: string
  subheadline?: string
  cta_text?: string
  cta_url?: string
  logo_url?: string
  lp_layout?: string

  // Über uns
  about_text?: string

  // Galerie
  gallery?: string[]

  // Featured Menu (leer = kein manuelles Override → aus DB)
  // Öffnungszeiten
  opening_hours?: OpeningHours

  // Bewertungen
  google_rating?: number           // z.B. 4.8
  google_review_count?: number     // z.B. 247
  google_maps_url?: string         // Link zur Google Maps Seite
  review_quotes?: ReviewQuote[]    // bis zu 3 manuelle Zitate

  // Kontakt
  address?: string
  phone?: string
  email?: string

  // Social
  instagram?: string    // Handle ohne @, z.B. "meinrestaurant"

  // Feature Badges (Lieferung, Vegan, etc.)
  feature_badges?: string[]
}
```

`LandingPageTab.tsx` importiert diesen Typ und entfernt die lokale Definition aus `lp-layouts.ts`. Die öffentliche `page.tsx` importiert ihn ebenfalls.

---

## 3. Sektionen-Komponente: `LandingPageSections`

Datei: `app/components/landing/LandingPageSections.tsx`

Props:
```ts
interface LandingPageSectionsProps {
  brand: ResolvedBrand
  content: LandingPageContent
  restaurantName: string
  slug: string
  featuredItems: FeaturedItem[]
}
```

### Sektionen (in Render-Reihenfolge)

**A. Info-Strip** (wird aus den Hero-Komponenten hierher verschoben)
- 3-spaltig: Heute Öffnungszeit | Küche-Status | Bestell-Typ
- Daten: `content.opening_hours` für den aktuellen Wochentag (Server-seitig via `new Date()`)
- Immer anzeigen

**B. Galerie**
- Nur anzeigen wenn `content.gallery?.length > 0`
- Horizontal scrollbar auf Mobile (`overflow-x: auto`)
- Bilder: 140px × 110px, `border-radius: 10px`, `object-fit: cover`
- Sektion-Titel: "Unsere Küche" (oder leer wenn kein Titel gesetzt)

**C. Featured Menu**
- Nur anzeigen wenn `featuredItems.length > 0`
- 2×2 Grid, Karten: Bild oben (70px), Name + Preis unten
- Sektion-Titel: "Highlights" mit Link "Zur Speisekarte →"
- `border-radius` der Karten: aus `brand.colors` (folgt Template-Setting)

**D. Über uns**
- Nur anzeigen wenn `content.about_text`
- Heading (italic serif), Fließtext, max-width 600px

**E. Öffnungszeiten**
- Nur anzeigen wenn `content.opening_hours` hat mindestens einen Eintrag
- Tabelle: Tag links, Zeiten rechts
- Heutiger Tag fett + grüner Punkt wenn geöffnet, roter Punkt wenn geschlossen

**F. Bewertungen**
- Nur anzeigen wenn `content.google_rating` gesetzt
- Header: große Rating-Zahl + Stern-Row + "X Google-Bewertungen"
- Review-Cards: maximal 3 Zitate aus `content.review_quotes[]`
- Falls `content.google_maps_url` gesetzt: "Alle Bewertungen lesen →" Link

**G. Reservierung CTA**
- Immer anzeigen (alle Restaurants haben Reservierungs-Tab)
- Dunkler Hintergrund (`brand.colors.primary` oder `#1a1a1a`)
- Headline, kurzer Untertitel, Button → `/bestellen/${slug}?tab=reserve`

**H. Kontakt & Anfahrt**
- Nur anzeigen wenn `content.address || content.phone || content.email`
- Zeilen: Adresse (📍), Telefon (📞), E-Mail (✉️)
- Google Maps Link als klickbares Dummy-Feld (öffnet `https://maps.google.com?q=...` mit URL-encoded Adresse)

**I. Instagram**
- Nur anzeigen wenn `content.instagram` gesetzt
- Horizontale Card: Instagram-Gradient-Icon + Handle + "Folge uns für tägliche Specials" + "Folgen" Button
- Button-Href: `https://instagram.com/${content.instagram}`

**J. Footer**
- Immer anzeigen
- Restaurant-Name (italic), Links: Impressum (`/legal/impressum`), Datenschutz (`/legal/datenschutz`), © Jahr
- Die Links sind Platzhalter — Restaurantbesitzer muss sie selbst befüllen (Phase 2)

---

## 4. Hero-Komponenten (Bereinigung)

Jede der 5 Hero-Komponenten behält nur den visuellen Hero-Block:
- `HeroClassicOverlay` → nur `<header>` mit Bild/Gradient + Headline + CTA-Button
- `HeroBoldStatement` → nur den Statement-Block mit Featured-Items-Strip
- `HeroSplit` → nur den 2-Spalten-Block
- `HeroCenteredMinimal` → nur den zentrierten Hero
- `HeroGradientGlow` → nur den Glow-Block

**Entfernt aus allen Hero-Komponenten:**
- Info-Strip (→ `LandingPageSections`)
- About-Sektion (→ `LandingPageSections`)
- Menu-CTA-Sektion (→ `LandingPageSections`)
- Footer (→ `LandingPageSections`)

Die Hero-Komponenten geben kein vollständiges Dokument zurück, sondern nur ihren eigenen Block (`<header>...</header>` oder `<section>...</section>`).

---

## 5. Daten-Fetching in `page.tsx`

```ts
// Immer (war bisher nur für bold-statement):
const { data: featuredItemsData } = await admin
  .from('menu_items')
  .select('id, name, price, image_url')
  .eq('restaurant_id', resto.id)
  .eq('available', true)
  .not('image_url', 'is', null)
  .order('sort_order', { ascending: true })
  .limit(4)
```

Falls `featuredItemsData` leer ist: kein Featured-Menu rendern (Sektion wird ausgeblendet).

Render:
```tsx
<>
  <LandingHero brand={brand} content={content} ctaHref={ctaHref} restaurantName={resto.name} featuredItems={featuredItems} />
  <LandingPageSections brand={brand} content={content} restaurantName={resto.name} slug={resto.slug} featuredItems={featuredItems} />
</>
```

---

## 6. Admin: Bewertungs-Felder in `LandingPageTab`

Im "Inhalt"-Tab, nach der Galerie-Sektion, neue Untersektion "Bewertungen":

```
Google-Rating:     [  4.8  ]   Anzahl: [  247  ]
Google Maps URL:   [__________________________]
Bewertung 1:       [Text-Textarea]  [Autor]
Bewertung 2:       [Text-Textarea]  [Autor]
Bewertung 3:       [Text-Textarea]  [Autor]
```

Alle Felder optional — wenn leer, wird die Bewertungs-Sektion auf der Landing Page nicht angezeigt.

---

## 7. Styling-Prinzipien

- **Inline-Styles** für alle `brand.colors.*`-Werte (Tailwind kann keine Runtime-Farben)
- **Sektions-Trenner**: `border-top: 1px solid ${brand.colors.border}`
- **Sektions-Titel**: `font-size: '0.65rem'`, `text-transform: 'uppercase'`, `letter-spacing: '0.1em'`, Farbe: `brand.colors.accent`
- **Schrift**: Heading-Sektionen (About, Galerie-Titel) nutzen `brand.font.heading`, Body nutzt `brand.font.body`
- **Abstände**: `padding: '40px 24px'` für alle Sektionen, `max-width: 680px; margin: '0 auto'` für Inhalts-Container
- **Kein iFrame** für Maps — nur ein gestylter `<a href="https://maps.google.com?q=...">` Link

---

## 8. Sichtbarkeits-Logik (Zusammenfassung)

| Sektion | Bedingung |
|---------|-----------|
| Info-Strip | immer |
| Galerie | `content.gallery?.length > 0` |
| Featured Menu | `featuredItems.length > 0` |
| About | `!!content.about_text` |
| Öffnungszeiten | mind. 1 Tag in `content.opening_hours` |
| Bewertungen | `content.google_rating != null` |
| Reservierung CTA | immer |
| Kontakt | `content.address \|\| content.phone \|\| content.email` |
| Instagram | `!!content.instagram` |
| Footer | immer |

---

## 9. Out of Scope

- Kein eingebettetes Google Maps iFrame (Datenschutz)
- Keine Instagram-Embed-Gallery (API-Komplexität, nach Go-Live)
- Kein automatisches Fetching von Google Reviews (API-Key nötig, nach Go-Live)
- Keine Animation/Parallax-Effekte (nach Go-Live, Framer Motion Phase 2)
- Kein Light-Mode-Toggle auf der Landing Page
