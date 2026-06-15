# Unified Brand System (#1)

**Date:** 2026-06-12
**Status:** Approved (design) — pending implementation plan
**Predecessor:** [2026-05-17-landing-page-unified-design.md](2026-05-17-landing-page-unified-design.md)

---

## Context

Das Design eines Restaurants lebt heute in mehreren, voneinander getrennten Quellen:

- `restaurants.design_config` (jsonb) — Farben, Fonts, Layout, Stil-Flags, `template_id`/`template_slug`. Wird von der **Tisch-Bestellseite** (`/order/[token]`, `OrderV2`) gelesen.
- `landing_pages.content.lp_design_package` + `lp_layout` — eigene Design-Quelle der **Landing-Page**.
- Die **Online-Bestellseite** (`/bestellen/[slug]`) liest **gar kein** `design_config` und ist dadurch eigenständig gestylt.

Folge: Ein Betreiber wählt Design effektiv mehrfach, und Landing- vs. Bestellseite können optisch auseinanderlaufen. Der Apply-Endpoint (`/api/design-templates/[id]/apply`) schreibt nur `design_config`, fasst `landing_pages` nicht an — der sichtbare Drift in einem Satz.

Der Vorgänger-Spec (2026-05-17) hat den **Editor-Ort** vereinheitlicht (eine Branding-Seite, zwei Tabs). Dieser Spec schließt die **Laufzeit-Lücke**: alle Flächen lesen denselben Brand.

### Was bereits existiert (ca. 70 % des Fundaments)

- `restaurants.design_config` jsonb + Validierung (`lib/design-config-validate.ts`, `ValidatedDesignConfig`). ✅
- `design_templates`-Tabelle mit **50 geseedeten Templates** (`046_template_seeds.sql`). ✅
- Funktionierender Apply-Endpoint, der ein Template in `design_config` schreibt + Legacy-Spalten spiegelt. ✅
- `OrderV2` liest `design_config` bereits — das **goldene Muster**. ✅

---

## Ziel

Ein **Brand**-Objekt als einzige Wahrheit. Alle vier Flächen rendern daraus. Ein Template-Klick restylt Tisch-, Online- und Landing-Fläche konsistent.

**Mentales Modell (bestätigt):** Brand-Kern + Pro-Fläche-Overrides ("B-Modell"). Template = Startpunkt, der den Kern einmalig füllt (Startpunkt-Modell, nicht Live-Theme).

---

## Scope

**In Scope (lean wiring):**
1. Zentraler Resolver `resolveBrand(restaurant, surface, overrides?)`.
2. Online-Bestellseite + öffentliche Landing-Page lesen den Brand.
3. Apply restylt alle Flächen über die geteilte `design_config`.
4. Landing-Editor: doppelter Farb-/Font-Picker entfällt, erbt den Kern.
5. Idempotente Migration bestehender Restaurants.

**Explizit NICHT in Scope (→ #2/#3):**
- Neue Templates bauen (#2).
- Mobile-Redesign der Gast-Flächen (#3).
- Brand-Editor optisch neu bauen.
- Plattform-Admin-Funktionen (#5).

---

## Architektur

### Der geteilte Vertrag

```
resolveBrand(restaurant, surface, overrides?) → ResolvedBrand
```

- **Eingang Kern:** `restaurants.design_config` (validiert via `ValidatedDesignConfig`) + Stammdaten (Logo, Name, Adresse, Öffnungszeiten, Socials).
- **Eingang Overrides:** flächenspezifische jsonb (siehe Datenmodell).
- **Merge-Regel (B-Modell):**
  - **Gesperrt (nie überschreibbar):** `primary_color`, `bg_color`, `surface_color`, `header_color`, `button_color`, `card_color`, `text_color`, `font_pair`, Logo. Overrides für diese Keys werden **ignoriert** (nicht nur „gewinnt der Kern" — der Resolver verwirft sie aktiv).
  - **Überschreibbar:** Landing → `hero_image_url`, `headline`, `subheadline`, `lp_layout`, `gallery`, `feature_badges`, Sektions-Reihenfolge, CTA. Order/Online → `layout_variant` (Menü-Layout), Cover-Bild, Begrüßung.
- **Ausgang:** ein flaches, render-fertiges `ResolvedBrand`. Keine Fläche liest danach rohe DB-Designfelder direkt.

`surface ∈ { 'order' | 'online' | 'landing' }`.

### Datenmodell

| Layer | Ort | Status |
|-------|-----|--------|
| Brand-Kern | `restaurants.design_config` (jsonb) | ✅ existiert |
| Templates (50) | `design_templates.config` (jsonb) | ✅ existiert |
| Landing-Overrides | `landing_pages.content` (jsonb) — nur Override-Keys behalten | ♻️ trimmen |
| Order/Online-Overrides | `landing_pages.content` ist nur Landing; Order/Online-Overrides klein in eigenem jsonb-Feld (z. B. `restaurants.guest_overrides`) | ➕ kleine Ergänzung |

- **Entfernt als Farb-/Font-Quelle:** `lp_design_package`. Landing erbt Farben/Fonts aus dem Kern.
- **Legacy-Spalten** (`primary_color` etc. direkt auf `restaurants`) bleiben vorerst stehen (Rollback-Sicherheit), werden in einem späteren Cleanup-Schritt entfernt — **nicht** Teil von #1.

### Dateien (Richtwert)

```
app/lib/
  resolve-brand.ts          ← NEU: resolveBrand + ResolvedBrand-Typ (der geteilte Vertrag)
  design-config-validate.ts ← UNVERÄNDERT (Kern-Schema-Quelle)

app/app/order/[token]/_v2/OrderV2.tsx     ← Refactor: über resolveBrand statt direktem design_config-Read
app/app/bestellen/[slug]/...              ← liest resolveBrand('online')
app/app/[slug]/info/page.tsx              ← liest resolveBrand('landing')
app/app/admin/branding/LandingPageTab.tsx ← Farb-/Font-Picker entfernen, Kern-Vorschau anzeigen
app/app/api/design-templates/[id]/apply/route.ts ← Default-Layouts setzen, falls leer

supabase/migrations/
  <date>_064_unify_brand.sql ← Migration: lp_design_package → Kern, Default-Konfig befüllen, GRANTs
```

---

## Apply-Logik

- Template anwenden = `design_config` updaten (Route macht das **schon**). Sobald Landing + Online ebenfalls daraus lesen, restylt **ein** Apply automatisch alle drei Flächen.
- **Einzige Ergänzung:** beim Apply Default-`lp_layout` (Landing) + Default-`layout_variant` (Menü) setzen, **nur falls noch nicht vorhanden**. Bestehende Overrides werden nie überschrieben.
- **Template-Wechsel (Startpunkt-Modell):** Warn-Dialog *„Deine Farb-/Font-Anpassungen werden ersetzt"* → bei Bestätigung `design_config` überschreiben; Pro-Fläche-Overrides (Hero, Galerie, Layout-Wahl) bleiben erhalten.

---

## Migration bestehender Restaurants

Idempotent, getestet gegen eine Kopie der Prod-Daten, mit Rollback-Pfad (Legacy-Spalten bleiben).

1. `design_config` gesetzt → unverändert. ✅
2. Landing nutzt noch `lp_design_package` → Landing-Farben/Fonts **verworfen** zugunsten des Kerns; echte Overrides (`hero_image_url`, `headline`, `subheadline`, `gallery`, `feature_badges`, `lp_layout`, Kontakt) bleiben in `landing_pages.content`.
3. `design_config` leer → mit `modern-classic` (aktueller Default-Look) befüllen.
4. `lp_design_package` aus `content` entfernen (nur dieser Key).

---

## Tests

- **Unit (`resolveBrand`):** Kern allein; Kern + erlaubte Overrides; **gesperrte Felder** (Farb-Override wird verworfen); fehlende `design_config` → Default-Fallback.
- **Integration (Apply-Route):** schreibt `design_config`; setzt Default-Layouts nur bei leer; lässt bestehende Overrides unangetastet.
- **E2E (Playwright):** Template anwenden → Tisch, Online und Landing zeigen dieselbe Primärfarbe + denselben Font. Das ist der „verbunden"-Beweistest.
- **Migration:** zweimal ausführen → identisches Ergebnis (Idempotenz).

---

## Risiken & Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|--------|---------------|
| Migration fasst Live-Daten an | idempotent, gegen Prod-Kopie testen, Legacy-Spalten als Rollback behalten |
| Online-Seite hat evtl. eigene Style-Annahmen | zuerst `OrderV2`-Muster spiegeln, visuell gegen Tisch-Seite prüfen |
| `landing_pages.content` enthält gemischte Keys | Migration entfernt gezielt nur `lp_design_package`, lässt Rest unberührt |
| Zwei Entwickler am selben System | `resolveBrand`-Vertrag zuerst festzurren, dann parallelisieren (siehe Co-Founder-Hinweis unten) |

---

## Co-Founder-Aufteilung

`resolveBrand` ist der einzige geteilte Vertrag. Sobald dessen Signatur + `ResolvedBrand`-Typ stehen (erster Merge), kann parallel gearbeitet werden:
- **David:** gastseitige Flächen (#1 Verkabelung, später #2 Templates, #3 Mobile) — `lib/resolve-brand.ts`, `order`, `bestellen`, `[slug]`.
- **Co-Founder:** Betreiber/Plattform (#4, #5) — `app/admin/*`, `app/platform/*`.
Feature-Branches → PRs, je eigener Git-Worktree, gemeinsame Regeln in `CLAUDE.md`.

---

## Definition of Done

- [ ] `resolveBrand` existiert, getestet, von allen 3 Gast-Flächen genutzt.
- [ ] Online-Bestellseite + öffentliche Landing erben den Brand-Kern.
- [ ] Landing-Editor hat keinen eigenen Farb-/Font-Picker mehr.
- [ ] Ein Template-Apply restylt Tisch + Online + Landing identisch (E2E grün).
- [ ] Migration idempotent, gegen Prod-Kopie verifiziert, kein Restaurant sieht „kaputt" aus.
- [ ] `lp_design_package` als Farb-/Font-Quelle ist eliminiert.
