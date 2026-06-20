# Handoff-Brief: #2 Template-Bibliothek

**Zweck dieser Datei:** Kontext für die Person/Claude-Instanz, die die Template-Bibliothek weiterbaut. (Die ausführlichen Projekt-Notizen liegen lokal beim ursprünglichen Entwickler und sind hier *nicht* verfügbar — daher dieser Brief.)

**Empfohlener Ablauf:** Diesen Brief lesen → mit dem `superpowers`-Brainstorming ein **Spec** schreiben (`docs/superpowers/specs/`) → **Plan** (`docs/superpowers/plans/`) → umsetzen (Branch/PR). Vorbild: die bereits vorhandenen Specs/Pläne (Unified Brand `2026-06-12-*`, Remove-V2 `2026-06-17-*`).

---

## Ziel

Die Templates sollen „richtig professionell" werden, wie bei Squarespace. Der Inhaber hat **drei** Schwächen benannt, die alle adressiert werden sollen:

1. **Vorschau wirkt billig** — in der Galerie sieht man nur abstrakte Farbkästchen statt echter, schöner Vorschauen.
2. **Templates zu ähnlich** — sie unterscheiden sich nur in Farbe/Font, nicht in der Struktur/im Layout.
3. **Nicht hochwertig genug** — die einzelnen Looks sollen edler/kuratierter sein (Farbkombis, Fonts).

Das ist zu groß für eine Spec → beim Brainstorming sinnvoll in Teilstücke zerlegen (z.B. erst echte Vorschauen, dann strukturelle Layout-Vielfalt, dann Kuratierung) und eins nach dem anderen als Spec→Plan→Build.

---

## Ist-Zustand (Fakten aus dem Code)

- **50 Templates sind bereits in der DB** (Tabelle `design_templates`, geseedet in `supabase/migrations/20260507_046_template_seeds.sql`). Jedes Template = `config` jsonb mit Farben, `font_pair`, `layout_variant`, Stil-Flags (`border_radius`, `hover_effect`, `animation_style`, `card_style`) + `category`, `style_tags`, `plan_tier`.
- **Galerie für Betreiber:** `app/app/admin/branding/page.tsx` (Tab „Templates") — Kategorie-Filter, Suche, „Anwenden", Plan-Tier-Gating. Die Karten zeigen aktuell eine **abstrakte Mini-Mockup-Vorschau aus den Farben** + Farbpunkte; es gibt **kein** echtes Vorschaubild (`preview_url` ist bei allen `null`). Rechts gibt es eine **Live-Phone-Vorschau**.
- **Template anwenden:** `app/app/api/design-templates/[id]/apply/route.ts` schreibt das Template in `restaurants.design_config` (+ Default-Layouts). Alle Gast-Flächen lesen `design_config` → ein Klick restylt alles.
- **Templates ändern nur Farbe/Font/Stil-Flags + Menü-`layout_variant`** (`cards|list|grid|large-cards`). Sie ändern **nicht** die Seiten-Struktur. Die öffentliche Landing rendert ein **festes** Hero-Layout; der Landing-Layout-Wähler ist vorerst ausgeblendet (`SHOW_LP_LAYOUT_PICKER = false` in `app/app/admin/branding/LandingPageTab.tsx`), bis die 4 Hero-Layouts (`classic-hero|split-hero|minimal|bold-fullscreen`) auf der öffentlichen Seite echt gebaut sind. → Aspekt 2 (strukturelle Vielfalt) hängt genau hier dran.

## Relevante Dateien

- Galerie/Editor: `app/app/admin/branding/page.tsx`, `app/app/admin/branding/LandingPageTab.tsx`
- Template-Daten/Apply: `supabase/migrations/20260507_045_branding_v3.sql` (Tabellen), `…046_template_seeds.sql` (Seeds), `app/app/api/design-templates/[id]/apply/route.ts`, `app/app/api/design-templates/route.ts`
- Brand-Lesen (Gast-Flächen): `app/lib/resolve-brand.ts`, `app/lib/color-utils.ts`, `app/lib/font-pairs.ts`, `app/lib/design-packages.ts`
- Gast-Renderer: `app/app/[slug]/info/page.tsx` (Landing), `app/app/bestellen/[slug]/_v1/`, `app/app/order/[token]/_v1/`, `app/components/menu/MenuItemCard.tsx`

## Konventionen, die hier wichtig sind (siehe auch `CONTRIBUTING.md`)

- `design_config` ist die **einzige** Brand-Quelle; nicht hart kodieren.
- Öffentliche Brand-Seiten brauchen `export const dynamic = 'force-dynamic'` (sonst stale Cache).
- Das V1/V2-System wurde entfernt — es gibt nur **eine** Design-Generation.
- `MenuItemCard` nutzt `var(--accent)` als Fallback; der Brand-Akzent muss im Scope gesetzt sein (Inline am Wurzel-Div), sonst greift der globale Default.

## Nützliche Design-Skills (falls verfügbar)

Zum Generieren/Verfeinern von Template-Varianten und Vorschauen: `frontend-design`, `ui-ux-pro-max`, `theme-factory`, `shadcn`. Vom Inhaber ausdrücklich erwünscht.
