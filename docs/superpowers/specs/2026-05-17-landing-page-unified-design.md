# Landing Page — Unified Design Editor

**Date:** 2026-05-17  
**Status:** Approved

---

## Context

Die bestehende Landing Page unter `/admin/landing-page` ist ein simpler 2-spalten Builder mit 5 hart kodierten Templates, der optisch komplett anders aussieht als die Branding Page. Das erzeugt Inkonsistenz: andere UI-Sprache, getrennte Seite, keine Verbindung zum Design-System.

Ziel: Die Landing Page wird in die Branding Page integriert — eine einheitliche "Design"-Seite mit zwei Haupt-Tabs ("Bestellseite" / "Landing Page"). Beide nutzen dieselben 8 Design-Pakete. Das Ergebnis: ein zusammenhängendes System, in dem alle visuellen Entscheidungen an einem Ort getroffen werden.

---

## Entscheidungen

1. **Architektur**: Eine Seite (`/admin/branding`), zwei Haupt-Tabs — "Bestellseite" (bestehend, unverändert) + "Landing Page" (neu)
2. **Templates**: Die 8 bestehenden Design-Pakete aus `lib/design-packages.ts` gelten für beide Seiten — kein separates Template-Set
3. **Landing Page Layout-Varianten**: 4 neue LP-spezifische Layouts (Classic Hero, Split Hero, Minimal, Bold Fullscreen)
4. **Inhalt**: Voller Umfang — Kontakt, Öffnungszeiten, Galerie, Feature-Badges, Review-Link, KI-Texte
5. **Bestehende Landing Page Seite**: Redirect `/admin/landing-page` → `/admin/branding`

---

## Architektur

### Datei-Struktur

```
app/app/admin/branding/
  page.tsx                  ← Hauptseite, bekommt top-level Tab-Switcher
  LandingPageTab.tsx        ← NEU: LP-Editor-Komponente (extrahiert)

app/app/admin/landing-page/
  page.tsx                  ← Wird zu Redirect → /admin/branding

app/lib/
  lp-layouts.ts             ← NEU: LP Layout-Varianten Definitionen
  design-packages.ts        ← UNVERÄNDERT (wird von LP-Tab geteilt)

supabase/migrations/
  20260517_048_lp_extended.sql  ← NEU: grant für landing_pages (keine Schema-Änderung nötig)
```

### Warum `LandingPageTab.tsx` als eigene Komponente?

`branding/page.tsx` ist bereits ~1300 Zeilen. Den LP-Editor direkt dort einzubauen würde eine nicht wartbare God-Component erzeugen. Der LP-Tab wird als eigenständige Komponente extrahiert, die in `page.tsx` nur eingebunden wird, wenn der "Landing Page"-Tab aktiv ist.

---

## Datenmodell

Die `landing_pages`-Tabelle bleibt unverändert — `content` ist bereits ein JSONB-Feld, das alle neuen Felder aufnimmt ohne Migration:

```typescript
interface OpeningHours {
  [day: string]: { open: boolean; from: string; to: string }
  // days: mo, di, mi, do, fr, sa, so
}

interface LandingPageContent {
  // Bestehend (bleiben)
  logo_url?: string
  hero_image_url?: string
  headline?: string
  subheadline?: string
  about_text?: string
  cta_text?: string
  cta_url?: string

  // Design (neu, in content JSONB)
  lp_design_package?: string        // z.B. 'modern-classic' — referenziert DESIGN_PACKAGES
  lp_layout?: LpLayoutSlug          // 'classic-hero' | 'split-hero' | 'minimal' | 'bold-fullscreen'

  // Kontakt & Info (neu)
  address?: string
  maps_url?: string
  phone?: string
  email?: string
  instagram?: string
  facebook?: string

  // Galerie (neu)
  gallery?: string[]                // max 6 Bild-URLs

  // Features (neu)
  feature_badges?: string[]         // z.B. ['Vegetarisch', 'Lieferung', 'Reservierung']

  // Reviews (neu)
  review_url?: string               // Google / Tripadvisor Link

  // Öffnungszeiten (neu)
  opening_hours?: OpeningHours
}
```

### LP Layout-Varianten (`lib/lp-layouts.ts`)

```typescript
export const LP_LAYOUTS = [
  { slug: 'classic-hero',    label: 'Classic Hero',    desc: 'Full-width Hero, Sektionen darunter' },
  { slug: 'split-hero',      label: 'Split Hero',      desc: 'Bild links, Text rechts' },
  { slug: 'minimal',         label: 'Minimal',         desc: 'Clean & minimalistisch' },
  { slug: 'bold-fullscreen', label: 'Bold Fullscreen', desc: 'Vollbild-Hero mit Overlay-Text' },
] as const
```

---

## UI-Struktur der neuen Landing Page Tab

Identisch zur Branding Page (3-Spalten-Layout):

```
┌─ Top Bar: "Design" + Speichern + Publizieren ──────────────────┐
│   [Bestellseite]   [Landing Page ●]                           │
├─────────────────────────────────────────────────────────────────┤
│ Left Nav  │        Center Content         │   Right Preview    │
│ (60px)    │        (scrollbar)            │   (Live LP)        │
│           │                               │                    │
│ Templates │  TEMPLATES TAB:               │  LandingPreview    │
│ Inhalt    │  - 8 Design-Pakete (grid)     │  (aktualisiert     │
│ Farben    │  - 4 LP Layout-Varianten      │   sich live mit    │
│ Layout    │                               │   allen Tabs)      │
│ KI-Chat   │  INHALT TAB:                  │                    │
│           │  - Logo / Hero-Bild           │  Gerätewechsel:    │
│           │  - Headline / Subheadline     │  📱 💻             │
│           │  - Über uns                   │                    │
│           │  - CTA Text + Link            │                    │
│           │  - Öffnungszeiten             │                    │
│           │  - Adresse + Maps URL         │                    │
│           │  - Telefon + E-Mail           │                    │
│           │  - Instagram + Facebook       │                    │
│           │  - Galerie (6 Bilder)         │                    │
│           │  - Feature Badges             │                    │
│           │  - Review Link                │                    │
│           │                               │                    │
│           │  FARBEN TAB:                  │                    │
│           │  - Gleiche Farbpicker wie     │                    │
│           │    Branding (optional override)│                   │
│           │                               │                    │
│           │  LAYOUT TAB:                  │                    │
│           │  - 4 LP Layout-Varianten      │                    │
│           │    (SVG Wireframe Icons)       │                   │
│           │                               │                    │
│           │  KI-CHAT TAB:                 │                    │
│           │  - KI generiert alle LP-Texte │                    │
└───────────┴───────────────────────────────┴────────────────────┘
```

### Live Preview — Neue Sektionen

Die `LandingPreview`-Komponente zeigt jetzt alle Sektionen:
1. Hero (besteht, wird layout-abhängig gerendert)
2. Feature Badges (pill tags in accent-Farbe)
3. Über uns
4. Galerie Grid (2-3 Bilder nebeneinander, responsive)
5. Öffnungszeiten (Tabelle Mo–So)
6. Kontakt (Adresse, Telefon, Email, Social, Maps-Link)
7. Review Button (wenn review_url gesetzt)
8. CTA

---

## Wichtige Implementierungsdetails

### Top-Level Tab-Switcher in `branding/page.tsx`

```tsx
type DesignSection = 'order-page' | 'landing-page'
const [designSection, setDesignSection] = useState<DesignSection>('order-page')

// Beide Sektionen werden gerendert, aber nur eine ist sichtbar (display: none)
// → Verhindert Re-Mount und Datenverlust beim Tab-Wechsel
```

### Datenfluss LP-Tab

1. `LandingPageTab` lädt `/api/admin/landing-page?restaurant_id=...`
2. Initialisiert `lp_design_package` aus dem Restaurant-`design_config.design_package` (Fallback: 'modern-classic')
3. Alle Änderungen updaten lokalen State sofort → Preview aktualisiert live
4. "Speichern" = PATCH `/api/admin/landing-page` mit vollem `content`-Objekt

### Feature-Badges

Vorgegebene Auswahl (Toggle-Chips, multiselect):
`['Vegetarisch', 'Vegan', 'Glutenfrei', 'Halal', 'Lieferung', 'Reservierung', 'Takeaway', 'Catering', 'Wifi', 'Terrasse', 'Parkplatz']`

### Öffnungszeiten-Editor

Pro Tag: Checkbox (offen/geschlossen) + zwei Zeitfelder (HH:MM) für "Von" und "Bis". Standard-Tage: Mo, Di, Mi, Do, Fr, Sa, So.

### Galerie-Upload

Nutzt bestehenden `/api/admin/landing-page/upload`-Endpoint mit `type: 'gallery'`. Speichert Array von URLs in `content.gallery`. Max 6 Bilder. Jedes Bild kann einzeln entfernt werden.

---

## Dateien die geändert werden

| Datei | Änderung |
|-------|----------|
| `app/app/admin/branding/page.tsx` | Top-level Tab-Switcher hinzufügen; `<LandingPageTab>` einbinden |
| `app/app/admin/branding/LandingPageTab.tsx` | NEU — vollständiger LP-Editor (inkl. erweitertem Preview) |
| `app/lib/lp-layouts.ts` | NEU — LP Layout-Varianten Definitionen |
| `app/app/admin/landing-page/page.tsx` | Redirect → `/admin/branding` |
| `app/app/api/admin/landing-page/upload/route.ts` | `type: 'gallery'` unterstützen (Bild-Array statt einzelne URL) |
| `app/app/api/ai/landing-page-content/route.ts` | Feature-Badges + Kurzversion Öffnungszeiten generieren |

**Keine DB-Migration nötig** — alle neuen Felder gehen in das bestehende `content` JSONB.

---

## Verifikation

1. `/admin/branding` öffnen → zwei Tabs sichtbar: "Bestellseite" (existing, unverändert) + "Landing Page"
2. Landing Page Tab → Templates zeigt alle 8 Design-Pakete; Auswahl aktualisiert Live-Preview sofort
3. Inhalt Tab → alle Felder ausfüllbar; Preview zeigt alle Sektionen live
4. Layout Tab → 4 Varianten wählbar; Preview ändert Darstellung entsprechend
5. KI-Chat Tab → generiert Texte; befüllt Felder automatisch
6. Speichern → PATCH-Request erfolgreich; Daten nach Reload noch vorhanden
7. Publizieren → LP unter `/{slug}/info` öffentlich erreichbar; alle neuen Felder werden gerendert
8. `/admin/landing-page` → Redirect zu `/admin/branding`
9. Mobile: Tab-Navigation funktionstüchtig (bestehende mobile Logik der Branding Page)
