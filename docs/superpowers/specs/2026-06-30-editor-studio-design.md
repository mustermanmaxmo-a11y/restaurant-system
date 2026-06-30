# Editor-Studio — Design-Spec

**Datum:** 2026-06-30
**Branch:** `feature/editor-studio`
**Status:** genehmigt (Brainstorming abgeschlossen, User-Lese-Gate bewusst übersprungen)

## Ziel

Den Admin-Editor (`/admin/branding`) von zwei getrennten, glue-verbundenen Editor-Apps („Bestellseite" + „Landing Page") in **ein zusammenhängendes Website-Studio** umbauen, das sich wie ein echtes großes Website-Tool (Wix/Squarespace-Editor) anfühlt: großer zentraler Live-Canvas, klare Navigation (Seiten + Marke), **ein** Entwurf-→-Veröffentlichen-Flow mit sichtbarem Status.

## Kontext / Ausgangslage

Heute ist [app/app/admin/branding/page.tsx](../../../app/app/admin/branding/page.tsx) (~1639 Zeilen) faktisch **zwei Editoren**, verbunden durch einen Top-Umschalter `designSection: 'order-page' | 'landing-page'`:

- **„Bestellseite"** — 3-Spalten-Editor mit *hand-gebauter* Fake-Mockup-Vorschau (Phone/Tablet/Desktop, kein echtes iframe) + eigenem `save()` → schreibt Marke-Felder **sofort live** in `restaurants`. Reiche Sub-Features: Templates-Galerie, KI-Design-Chat (`/api/ai/design-chat`), Design-aus-Screenshot (`/api/ai/design-extract`), Logo/Infos, Design-Anfragen.
- **„Landing Page"** — [LandingPageTab.tsx](../../../app/app/admin/branding/LandingPageTab.tsx) mit *echtem* iframe-Preview (`PreviewPane`), eigenem debounced Auto-Save + Veröffentlichen/Depublizieren → schreibt in `landing_pages`.

Daraus die vom User benannten Probleme:
1. Zwei „Speichern"-Buttons (oben global + im Landing-Tab) + „Depublizieren" → verwirrend.
2. Unklarer Auto-Save-Status (Untertitel „sofort live sichtbar" ist sogar irreführend).
3. Zwei Tabs „Bestellseite"/„Landing Page" sind unsinnig, weil seit `feature/website-upgrade` alles **eine** integrierte Website ist (geteiltes `SiteHeader`/`SiteFooter`).
4. Vorschau zu klein/unpraktisch (zwei verschiedene Vorschau-Systeme).

Genehmigte Grundentscheidungen aus dem Brainstorming:
- **Ambition:** Studio-Layout (großer Canvas, kein Klick-ins-Bild).
- **Navigation:** zwei Bereiche — *Seiten* (Start/Speisekarte/Reservieren → je Sektionen) ↔ *Design & Marke* (seitenweit).
- **Speichern:** Entwurf → Veröffentlichen für **alles** (auch Marke). Marke-Änderungen werden damit erst nach Veröffentlichen für Gäste sichtbar (vom User ausdrücklich ok).

## Architektur: Zwei-Zustands-Modell (Entwurf / Veröffentlicht)

Kernidee: ein **Entwurf** (was der Editor bearbeitet) getrennt vom **Veröffentlicht**-Zustand (was Gäste sehen).

```
┌─ ENTWURF ──────────────────────────────┐        ┌─ VERÖFFENTLICHT ─────────────────────┐
│ restaurants.draft_config (JSONB)        │        │ restaurants.* Spalten (Marke)         │
│  ├ brand: { alle Marke-Felder }         │  ──▶   │ landing_pages.content + is_published  │
│  ├ landing_content: LandingPageContent  │ Publish                                        │
│  └ draft_updated_at                      │        │ restaurants.last_published_at         │
└──────────────────────────────────────────┘        └──────────────────────────────────────┘
```

- **Editor** liest/schreibt nur den Entwurf. Auto-Save = Entwurf speichern. Nie direkt öffentlich.
- **Veröffentlichen** validiert + kopiert Entwurf → Live-Orte und setzt `last_published_at = now()`, `landing_pages.is_published = true`.
- **Vorschau (`?preview=1`, besitzer-geschützt)** liest künftig den **Entwurf** (Fallback Live, falls kein Entwurf existiert).
- **Gäste-Seiten unverändert:** lesen weiter die Live-Spalten/`landing_pages.content`. Kein Umbau an `resolve-brand`-Konsumenten nötig → kleiner Eingriff.
- **„Nicht veröffentlichte Änderungen"** = `draft_config.draft_updated_at > last_published_at` (oder `last_published_at IS NULL` und Entwurf existiert).

### Eine Vorschau statt zwei
Die hand-gebaute Fake-Mockup-Vorschau der Bestellseite (`previewContent`, `DesignMockup`, Geräte-Frames in page.tsx) wird **entfernt**. Es bleibt **nur** das echte `PreviewPane`-iframe als zentraler Canvas (zeigt Start/Speisekarte/Reservieren echt gerendert, liest den Entwurf via `?preview=1`).

### Datenmodell-Details

`draft_config` JSONB-Form:
```jsonc
{
  "brand": {
    "design_package": "modern-classic",
    "layout_variant": "cards",
    "font_pair": "syne-dmsans",
    "primary_color": "#e85d26",   // oder null = Paket-Standard
    "bg_color": null,
    "header_color": null,
    "card_color": null,
    "button_color": null,
    "text_color": null,
    "design_config": { /* Template/AI-Config, oder null */ },
    "logo_url": null,
    "contact_email": null,
    "contact_phone": null,
    "contact_address": null,
    "description": null
  },
  "landing_content": { /* LandingPageContent (siehe app/lib/landing-content.ts) */ },
  "draft_updated_at": "2026-06-30T12:00:00.000Z"
}
```

Reine lib-Funktionen (testbar, in `app/lib/editor-draft.ts`):
- `initDraftFromLive(restaurant, landingContent): DraftConfig` — befüllt Entwurf aus aktuellem Live-Stand (für bestehende Restaurants ohne `draft_config`).
- `promoteDraft(draft): { restaurantUpdate, landingContent }` — bildet Entwurf auf die Live-Schreibziele ab (inkl. `surface_color`-Ableitung wie heute: `primary_color ? null : pkg.preview.surfaceColor`); `landingContent` wird durch `sanitizeLandingContent` geschickt.
- `hasUnpublishedChanges(draftUpdatedAt, lastPublishedAt): boolean`.

## Komponenten: Studio-Shell (Phase 2)

```
┌────────────────────────────────────────────────────────────────┐
│ EditorTopBar:  Seiten-Umschalter [Start ▾]  [📱🖥]  ● Status · [Veröffentlichen] │
├──────────────┬──────────────────────────────────┬──────────────┤
│ EditorNav    │  EditorCanvas                    │ EditorPanel   │
│ Seiten│Marke │  (echtes PreviewPane-iframe,     │ (Editor der   │
│ Seiten:      │   groß, zentral, liest Entwurf)  │  gewählten    │
│  Start ●     │                                  │  Sektion oder │
│  Speisekarte │                                  │  Marke-Tools) │
│  Reservieren │                                  │               │
│ Sektionen:   │                                  │               │
│  Hero 👁     │                                  │               │
│  Galerie 👁  │                                  │               │
│  Team 🚫     │                                  │               │
└──────────────┴──────────────────────────────────┴──────────────┘
```

- **`EditorShell`** — Single Source of Truth: hält Entwurf-State, debounced Auto-Save (`PATCH /api/admin/editor-draft`), Publish (`POST /api/admin/editor-publish`), Auswahl-State (gewählte Seite + gewählter Nav-Eintrag). Orchestriert die 4 Teilkomponenten.
- **`EditorTopBar`** — Seiten-Umschalter (Start/Speisekarte/Reservieren), Geräte-Umschalter (📱/🖥), **Status-Badge**, **ein** „Veröffentlichen"-Button, „⋯"-Menü (Landing offline nehmen, Änderungen verwerfen, Live ansehen).
- **`EditorNav`** (links) — Umschalter *Seiten ↔ Design & Marke*. Unter *Seiten*: Seitenliste + Sektionen der gewählten Seite, jede Sektion mit 👁-Sichtbarkeits-Toggle direkt daneben. Unter *Design & Marke*: Farben, Schrift, Logo, Templates, KI-Chat, Scan, Anfragen.
- **`EditorCanvas`** (Mitte) — `PreviewPane`-iframe groß/zentral; zeigt gewählte Seite + Gerät; debounced Reload bei Entwurf-Änderung.
- **`EditorPanel`** (rechts) — rendert den Editor des links gewählten Eintrags. Die bestehenden Sektion-Editoren (Hero/Galerie/Team/Story/Ambiance/Awards/Kontakt/Öffnungszeiten/Bewertungen) und Marke-Tools (Templates/Farben/Schrift/KI/Scan/Anfragen) wandern hierher.

**Mobil:** stapelt — Navi wird oben zum Dropdown, Panel volle Breite, Canvas hinter „Vorschau"-Umschalter (bestehende `isMobile`-Logik wiederverwenden).

## Status-/Veröffentlichen-UX (Phase 1 Backend-Status + Phase 3 Feinschliff)

- Status-Badge: `Speichert…` → `Gespeichert ✓` (Entwurf sicher); wenn Entwurf ≠ Live: `● Nicht veröffentlichte Änderungen` → Veröffentlichen-Button aktiv; nach Publish: `Veröffentlicht vor X · Live ansehen ↗`.
- **Zwei Dinge sauber getrennt:** (1) **Veröffentlichen** = Entwurf→Live (Haupt-Button). (2) **Landing online/offline** (`is_published`) im dezenten „⋯"-Menü; die Bestell-App `/bestellen` bleibt immer erreichbar.
- Optional: **„Änderungen verwerfen"** → Entwurf auf Live-Stand zurücksetzen.

## Sonderfälle

- **Erstinitialisierung:** kein `draft_config` → beim ersten Editor-Laden via `initDraftFromLive` aus Live-Stand befüllen.
- **Validierung beim Publish:** `sanitizeLandingContent` + Marke-Feld-Validierung laufen beim Veröffentlichen (nicht nur beim Speichern).
- **Vorschau besitzer-geschützt:** `?preview=1` liest Entwurf → weiterhin nur eingeloggter Besitzer (IDOR-Schutz aus PR #25 gilt unverändert).
- **KI-Fallback:** ohne Anthropic-Key zeigen ✦KI-Buttons dezente Fehlermeldung, kein Absturz.
- **Auto-Save-Race:** ein einziger Entwurfs-State, last-write-wins; Publish-Status im Save-Pfad berücksichtigen.

## Phasen (je eigener Plan, je für sich lauffähig & testbar)

### Phase 1 — Entwurf/Veröffentlichen-Fundament (reines Backend, keine sichtbare UI-Änderung)
- Migration: `restaurants.draft_config jsonb`, `restaurants.last_published_at timestamptz` (+ GRANTs unverändert, nur Spalten-Add).
- `app/lib/editor-draft.ts`: Typen + `initDraftFromLive`, `promoteDraft`, `hasUnpublishedChanges` (mit Vitest-Unit-Tests).
- `GET/PATCH /api/admin/editor-draft` (Besitzer-Auth) — Entwurf laden/auto-speichern.
- `POST /api/admin/editor-publish` — Entwurf→Live promoten + validieren.
- Vorschau-Pfad: `/[slug]/info` und `/bestellen/[slug]` lesen im Besitzer-Preview den Entwurf (Fallback Live, wenn kein Entwurf). Gäste-Pfad unverändert.
- Da noch keine UI in den Entwurf schreibt, bleibt das Gäste-/Vorschau-Verhalten unverändert (Fallback Live) → sicheres Fundament.

### Phase 2 — Studio-Shell + Verdrahtung auf Entwurf
- `EditorShell`, `EditorTopBar`, `EditorNav`, `EditorCanvas`, `EditorPanel` bauen.
- Bestehende Sektion-Editoren + Marke-Tools ins Panel ziehen; die zwei Tabs verschmelzen.
- Alles auf `editor-draft`/`editor-publish`-APIs verdrahten; Status-Badge + Veröffentlichen-Leiste.
- Fake-Mockup-Vorschau entfernen; `PreviewPane` als Canvas.

### Phase 3 — Parität & Politur
- Alle Marke-Tools (Templates/KI-Chat/Scan/Anfragen) im neuen IA erreichbar & getestet.
- „⋯"-Menü (offline nehmen, verwerfen, Live ansehen), Geräte-Umschalter, mobile Stapelung, Kanten-/Fehlerfälle.

## Tests

- **Phase 1:** Promote-Logik, `initDraftFromLive`, `hasUnpublishedChanges`, Sanitize-beim-Publish als reine lib-Funktionen → Vitest-Unit-Tests (wie `landing-content-validate`).
- **Komponenten:** kein Render-Harness → `tsc --noEmit` + manueller Durchlauf pro Phase.
- **Routen-Smoke:** Admin-Editor, `?preview=1` (Besitzer liest Entwurf), Gäste-Seiten (lesen Live).

## Nicht-Ziele (Out of Scope)

- Klick-ins-Bild / In-Canvas-Inline-Editing (Visual-Builder Level 3).
- Custom Domains (separat zurückgestellt).
- Änderungen am öffentlichen Seiten-Rendering selbst (nur Lesepfad für Preview wird ergänzt).
- Mehrsprachige Inhalte / Versionierung/History über den einfachen Entwurf hinaus.
