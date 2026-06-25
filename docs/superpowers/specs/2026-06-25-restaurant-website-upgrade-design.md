# Restaurant Website Upgrade — Design

> **Status:** Approved (brainstorming). Next step: writing-plans per sub-project.
> **Date:** 2026-06-25

## Problem

Die heutige Gast-Erfahrung fühlt sich nicht wie eine echte Restaurant-Website an:

1. **Zu wenig Inhalt / Sektionen** — es fehlen Bereiche, die echte Restaurant-Seiten haben (Team, Geschichte, Atmosphäre, Auszeichnungen).
2. **Zu wenig echte Bilder** — kaum Stellen für echte Fotos (Team, Innenraum, Story).
3. **Wirkt generisch** — Texte/Anordnung wirken wie ein Template, nicht wie *dieses* Restaurant.
4. **Admin unübersichtlich** — der Betreiber weiß nicht, wo welche Bilder hingehören; das lange Formular ist verwirrend.
5. **Landing & Bestellen wirken wie zwei getrennte Apps** — gleiche Marke, aber kein gemeinsames Dach. Es fühlt sich nicht wie *eine* Website an.

## Ziel

Aus „einer Landing-Page" wird **die komplette Website des Restaurants** — mit Tiefe, echten Fotos, Persönlichkeit, integriertem Bestellen unter einem gemeinsamen Dach, und einem Admin-Editor, in dem der Betreiber alles mit Live-Vorschau bearbeiten kann.

## Wichtige Design-Entscheidungen (abgenommen)

- **Integration Bestellseite = Weg A:** Gemeinsames Website-Dach (geteilte Navigation + Footer) über Landing **und** Bestellseite. Die Bestell-Logik (Warenkorb, Realtime, Bezahlung) bleibt eine eigene Seite/Route — sie wird NICHT in die Startseite eingebaut. Begründung: wirkt als *eine* Website, ohne die funktionierende, schwere Bestell-Maschine zu zerreißen; schnelle Startseite; KISS.
- **Leere Inhalte = KI-Vorbefüllung:** Neue Text-Sektionen werden per KI aus Name + Restaurant-Typ vorbefüllt (on-demand Button), der Betreiber editiert nur. Ohne `ANTHROPIC`-API-Key sauberer Fallback (Button deaktiviert mit Hinweis) — der Key ist aktuell noch nicht eingetragen.
- **Admin = Live-Vorschau Split-Editor:** Links bearbeiten, rechts echter iframe der Gast-Seite. Genauigkeit > Instant-Tippen → iframe statt Render-Duplikat (kein Auseinanderlaufen).
- **Neue Sektionen = alle 4:** Team / Unsere Küche, Unsere Geschichte, Atmosphäre (große Galerie), Auszeichnungen / Presse.
- **Sektionen ein-/ausschaltbar:** Jede Sektion (außer Hero & Footer) hat einen Sichtbarkeits-Toggle, den der Betreiber für seine Website steuert.
- **Sektionen bleiben geteilt (nicht pro Template):** Die neuen Sektionen werden — wie die bestehenden 10 — über alle Templates geteilt und nur über Marken-Farben/-Fonts unterschieden. Das „generisch"-Gefühl lösen wir über KI-personalisierten Text + echte Fotos + echten Inhalt, nicht über 5 separate Sektions-Designs (Scope-Kontrolle).

## Gast-Flächen heute (Kontext)

- `/[slug]/info` → Marketing-Landing (10 Sektionen). Architektur: `LandingHero` (template-spezifisch) + `LandingPageSections` (10 geteilte Sektionen). Kanonischer Typ: `app/lib/landing-content.ts` → `LandingPageContent`.
- `/bestellen/[slug]` → Online-Bestellen für zuhause (Menü, Warenkorb, Realtime, Bezahlung).
- `/order/[token]` → Tisch-App im Restaurant (QR). **Nicht** Teil dieses Upgrades.

Alle öffentlichen, marken-getriebenen Server-Seiten brauchen `export const dynamic = 'force-dynamic'` (sonst stale Cache).

---

## Architektur — drei aufeinander aufbauende Teilprojekte

Reihenfolge: **1 → 2 → 3**. Jedes Teilprojekt bekommt einen eigenen Implementierungs-Plan und eigene Umsetzung. Jedes Teilprojekt liefert für sich lauffähige Software.

### Teilprojekt 1 — Website-Dach (Fundament)

Geteiltes Header/Footer-Dach über Landing- und Bestellseite, damit sich beide wie *eine* Website anfühlen.

**Neue Komponenten:**

- `app/components/site/SiteHeader.tsx`
  - Sticky Top-Navigation, marken-getrieben (`ResolvedBrand` Farben/Fonts).
  - Links: **Start** (`/[slug]/info`), **Speisekarte** (`/bestellen/[slug]`), **Reservieren** (`/bestellen/[slug]?tab=reserve`), **Kontakt** (Anchor `#kontakt` auf der Startseite).
  - Logo links (nutzt `content.logo_url`, Fallback Restaurant-Name).
  - Mobil: Hamburger-Menü (aufklappbares Panel). Mobile-first.
  - Props: `{ brand, slug, restaurantName, logoUrl?, active?: 'start' | 'speisekarte' | 'reservieren' }`.
- `app/components/site/SiteFooter.tsx`
  - Heutigen Footer aus `LandingPageSections` (Sektion 10) herauslösen → geteilte Komponente.
  - Inhalt: Restaurant-Name, Impressum, Datenschutz, © Jahr.
  - Props: `{ brand, restaurantName }`.

**Integration:**

- `app/app/[slug]/info/page.tsx`: `SiteHeader` oben, `SiteFooter` unten (Footer aus `LandingPageSections` entfernen).
- `/bestellen/[slug]` Seite: dasselbe `SiteHeader` + `SiteFooter` einhängen (Branding ist dort bereits aufgelöst).

**Boundary/Risiko:** Routen werden NICHT umbenannt (QR-Codes, bestehende Links bleiben gültig). Nur Header/Footer kommen hinzu.

**Lieferbar:** Beide Gast-Seiten zeigen dieselbe Navigation + Footer; man kann zwischen Start ↔ Speisekarte ↔ Reservieren navigieren.

---

### Teilprojekt 2 — Landing-Inhalte (4 neue Sektionen + Toggles + KI)

**Typ-Erweiterungen** in `app/lib/landing-content.ts` (alles im bestehenden `content`-JSON-Feld → **keine DB-Migration nötig**):

```ts
export interface TeamMember { name: string; role: string; photo_url?: string }
export interface Award { title: string; subtitle?: string; logo_url?: string }

export type SectionKey =
  | 'gallery' | 'featured_menu' | 'about' | 'team' | 'story'
  | 'ambiance' | 'awards' | 'opening_hours' | 'reviews'
  | 'reservation_cta' | 'contact' | 'instagram'

// Ergänzungen zu LandingPageContent:
//   team?: TeamMember[]
//   story_text?: string
//   story_image_url?: string
//   founded_year?: string
//   ambiance_gallery?: string[]
//   awards?: Award[]
//   section_visibility?: Partial<Record<SectionKey, boolean>>
```

**Sichtbarkeits-Regel:** Eine Sektion wird gerendert, wenn (a) sie nicht explizit auf `false` steht UND (b) sie Inhalt hat. `section_visibility` ist standardmäßig „alle sichtbar". Hero & Footer sind nicht toggelbar (immer an). Eine zentrale Hilfsfunktion `isSectionVisible(key, content)` kapselt die Logik (DRY), genutzt von Rendering UND Admin-Editor.

**4 neue Sektions-Komponenten** (eingehängt in `LandingPageSections`, in der Seiten-Reihenfolge). Jede ist eine eigene Datei für fokussierte, gut testbare Einheiten:

- `app/components/landing/sections/TeamSection.tsx` — Raster aus Foto + Name + Rolle. Position: nach „Über uns".
- `app/components/landing/sections/StorySection.tsx` — großes Foto + Text + `founded_year` („Seit 1998"). Position: nach Team.
- `app/components/landing/sections/AmbianceSection.tsx` — große Innenraum/Ambiente-Fotos im vollbreiten Raster (getrennt von der kleinen Speisen-Galerie). Position: nach Geschichte.
- `app/components/landing/sections/AwardsSection.tsx` — Auszeichnungen/Presse: Titel + Untertitel + optionales Logo. Position: vor/bei „Bewertungen".

Alle nutzen die bestehenden geteilten Style-Tokens (`colors`, `font`) aus `ResolvedBrand` und das vorhandene Sektions-Styling-Muster. **Verbotene Farb-Tokens:** `colors.primary` existiert nicht — nur `bg, text, muted, accent, accentSecondary, border, surface, surface2, buttonBg, buttonText` verwenden.

**KI-Vorbefüllung — Endpoint:**

- `app/app/api/admin/landing-page/ai-generate/route.ts` → `POST { field: 'about' | 'story' | 'team_role', restaurantName, cuisineType?, context? }`.
- Nutzt das neueste Claude-Modell (`claude-opus-4-8` o.ä.) via Anthropic SDK; gibt generierten Text zurück.
- **Fallback ohne Key:** Wenn `ANTHROPIC_API_KEY` fehlt → `409`/`{ error: 'no_api_key' }`; der Admin-Button ist dann deaktiviert mit Hinweis. Niemals `.env.local` lesen/schreiben.

**Lieferbar:** Landing-Seite zeigt die 4 neuen Sektionen, sobald Inhalt vorhanden ist; Sichtbarkeit per `section_visibility` steuerbar; KI-Endpoint liefert Texte (oder sauberen Fallback).

---

### Teilprojekt 3 — Admin Split-Editor

Umbau von `app/app/admin/branding/LandingPageTab.tsx` von langem Formular zu Zwei-Spalten-Editor.

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Branding · Speisekarte · Bestellungen        [Vorlage wechseln ▾]   │
├──────────────────────────────────┬──────────────────────────────────┤
│  LINKS: Bearbeiten (scrollbar)   │  RECHTS: Live-Vorschau (sticky)   │
│  ① HERO            [Sektion ✔]   │  [Start][Speisekarte][Reservieren]│
│   Überschrift / Untertitel        │  [📱 Mobil] [🖥 Desktop]          │
│   ┌─ Hero-Bild ────────────────┐ │  ┌──────────────────────────────┐│
│   │[Thumb] erscheint ganz oben │ │  │ echter iframe der Gast-Seite ││
│   │1600×900 · [ändern][✕]      │ │  │                              ││
│   └────────────────────────────┘ │  │                              ││
│  ② ÜBER UNS  [✔]  Text [✨KI]    │  └──────────────────────────────┘│
│  ③ TEAM      [✔]  [+ Mitglied]   │         Gespeichert ✓            │
│  ④ GESCHICHTE[✘] (ausgegraut)    │                                  │
│  ... usw.                        │                                  │
└──────────────────────────────────┴──────────────────────────────────┘
```

**Kern-UX-Prinzipien:**

1. **Editor-Reihenfolge = Seiten-Reihenfolge.** Jede Editor-Box (①②③…) heißt wie die Sektion auf der Seite und steht in derselben Reihenfolge.
2. **Bild-Zonen mit Klartext im Kontext.** Jede Upload-Stelle sagt *wofür* und *wo*: Label + Hilfetext (Format/Empfehlung) + Thumbnail + „ändern/✕".
3. **Sichtbarkeits-Toggle pro Sektion** am Box-Header. Aus = Box ausgegraut **und** Sektion verschwindet in der Vorschau (schreibt `section_visibility[key]=false`).
4. **Live-Vorschau = echte Seite** via iframe. Debounced Autosave → iframe-Reload → „Gespeichert ✓". Vorschau-Tabs: **Start / Speisekarte / Reservieren**; Geräte-Umschalter **Mobil/Desktop** (Mobil Standard).
5. **✨ KI-Buttons** an Textfeldern (Über uns, Geschichte, Team-Rollen) → rufen `ai-generate`. Ohne Key deaktiviert.

**Neue wiederverwendbare Komponenten:**

- `app/app/admin/branding/editor/ImageDropZone.tsx` — `{ label, helpText, value, aspectHint?, onUpload, onRemove }`. Thumbnail + Klick/Drag-Upload an bestehenden `/api/admin/landing-page/upload`-Endpoint.
- `app/app/admin/branding/editor/SectionEditor.tsx` — Wrapper: `{ number, title, sectionKey?, visible, onToggleVisible, children }`. Rendert Header + Toggle + Inhalt; graut aus wenn unsichtbar.
- `app/app/admin/branding/editor/PreviewPane.tsx` — `{ slug }`. iframe + Seiten-Tabs + Geräte-Umschalter; `reload()` nach Save.

**Vorschau-Flag:** Gast-Seiten unterstützen `?preview=1` (z.B. um künftige preview-only-Effekte/Deaktivierung von Analytics zu erlauben). Initial reicht das Durchreichen des Flags; kein spezielles Verhalten zwingend nötig.

**Speichern:** nutzt den bestehenden `PUT/POST /api/admin/landing-page`-Pfad; debounced (~600ms) Autosave nach Änderungen, danach `PreviewPane.reload()`.

**Lieferbar:** Betreiber bearbeitet alle Website-Inhalte links, sieht rechts sofort die echte Seite (Start/Speisekarte/Reservieren, Mobil/Desktop), schaltet Sektionen ein/aus, lädt Bilder an klar beschrifteten Zonen hoch, generiert Texte per KI.

---

## Abgrenzungen (Out of Scope)

- **Gerichte & Preise** bleiben im bestehenden „Speisekarte"-Tab. Im Editor erscheinen sie nur als fertige Menü-Vorschau im iframe, werden dort nicht editiert.
- **Tisch-App `/order/[token]`** ist nicht betroffen.
- **Keine Routen-Umbenennung** (QR-Codes/Links bleiben gültig).
- **Keine pro-Template-Sektions-Designs** (Sektionen bleiben geteilt, marken-getrieben).
- **Kein Instant-Tippen-Preview** in V1 (iframe-Reload; postMessage später optional).

## Datenfluss

1. Betreiber bearbeitet im Split-Editor → debounced Autosave → `POST /api/admin/landing-page` schreibt ins `content`-JSON.
2. `PreviewPane` lädt iframe `/[slug]/info?preview=1` (bzw. `/bestellen/[slug]`) neu.
3. Gast-Seite rendert server-seitig (`force-dynamic`) aus `content` über `LandingHero` + `LandingPageSections` + `SiteHeader/SiteFooter`.
4. KI-Button → `POST /api/admin/landing-page/ai-generate` → Text ins Feld → normaler Save-Pfad.

## Testing

- **Typen:** `tsc` 0 Fehler nach jedem Teilprojekt.
- **Sichtbarkeitslogik:** Unit-Tests für `isSectionVisible(key, content)` (sichtbar/leer/explizit aus).
- **Rendering:** Jede neue Sektion rendert mit Inhalt, rendert nicht bei leer/aus.
- **Shell:** `SiteHeader` aktiv-State + mobiler Hamburger; `SiteFooter` Links.
- **KI-Endpoint:** mit Key → Text; ohne Key → sauberer Fallback (kein 500).
- **Manuell:** lokal Server starten, durch Start/Speisekarte/Reservieren in der iframe-Vorschau klicken, Toggle aus/an, Bild-Upload, KI-Button.

## Qualitäts-Checkliste (aus bisherigen Lessons)

- `export const dynamic = 'force-dynamic'` auf allen öffentlichen marken-getriebenen Server-Seiten.
- Keine `colors.primary`-Nutzung (existiert nicht).
- Jede neue DB-Tabelle bräuchte GRANTs — hier **keine** neue Tabelle (nur JSON-Feld).
- `branding`-Storage-Bucket muss existieren (Public) für Uploads.
- Kein `console.log` im finalen Code.
- `.env.local` niemals lesen/schreiben.
