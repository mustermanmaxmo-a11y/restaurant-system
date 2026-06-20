# Remove the V1/V2 Design-Version System

**Date:** 2026-06-17
**Status:** Approved (design) — pending implementation plan
**Related:** Surfaced during the brand-drift debugging (PRs #20–#22); see [[project_design_overhaul]] and `feedback_public_pages_force_dynamic`.

---

## Context

Die App hat zwei Design-Generationen (V1/V2), umschaltbar pro Scope (platform/admin/guest) über `lib/design-version.ts`. **Live läuft überall V1** (DB-Defaults `v1`, nichts wurde auf v2 umgestellt) — V2 ist faktisch toter Code. Das Doppelsystem hat den Brand-Drift-Bug verursacht (eine Fläche las V1-Pfad, eine andere V2/Legacy) und verkompliziert jede künftige Design-Arbeit (#2 Templates, #3 Mobile).

Entscheidung des Inhabers: **V2 komplett entfernen, V1 als einzige Version behalten, inkl. Löschen der DB-Spalten.**

---

## Ziel

Ein einziges Design-System (V1). Kein sichtbarer Unterschied (alles läuft bereits auf V1) — reine Vereinfachung + Entfernen der Fehlerquelle.

**Out of scope:** Umbenennen der `_v1`-Ordner (unnötige Churn/Risiko) und jede optische Änderung. Reine Entfernung.

---

## Scope

### Zu löschende Dateien/Ordner
- `app/app/order/[token]/_v2/`
- `app/app/bestellen/[slug]/_v2/`
- `app/app/reservieren/[slug]/_v2/`
- `app/app/admin/_v2/`
- `app/app/platform/_v2/`
- `app/app/platform/design/` (komplette Switcher-UI: `page.tsx` + `DesignSwitcherClient.tsx`)
- `app/app/api/platform/design/` (komplette API: `restaurants/route.ts` + `settings/route.ts`)
- `app/lib/design-version.ts`
- `app/components/providers/design-version-provider.tsx`

### Zu bearbeitende Dateien
| Datei | Änderung |
|-------|----------|
| `app/app/order/[token]/page.tsx` | `resolveDesignVersion`/`DesignVersionProvider`/V2-Import raus; direkt `<OrderV1 />` rendern (Restaurant-Lookup + `notFound` + `force-dynamic` bleiben). |
| `app/app/bestellen/[slug]/page.tsx` | Analog → direkt `<BestellenV1 />`. |
| `app/app/reservieren/[slug]/page.tsx` | Analog → direkt `<ReservierenV1 />`. |
| `app/app/admin/layout.tsx` | Version-Logik + Provider raus; `children` direkt rendern (sonstige Layout-Inhalte unverändert). |
| `app/app/admin/page.tsx` | `useDesignVersion` + `BentoOverview` raus; direkt `<ClassicOverview />`. |
| `app/app/platform/layout.tsx` | Version-Logik + `PlatformV2Banner` raus; festen V1-Hintergrund (`#1a1a2e`) verwenden. |
| `app/app/globals.css` | `.theme-v2`-Block entfernen; `:root, .theme-v1` → `:root`; `.theme-v1.dark, :root.dark:not(.theme-v2)` → `:root.dark`. (Damit verschwindet auch der grüne `#00C853`-Default sauber als reiner Dark-Wert, der explizit gesetzt bleibt wie in V1.) |
| `app/app/layout.tsx` | `className="theme-v1"` am `<html>` entfernen (redundant, da globals jetzt `:root` nutzt). Dark-Mode-Script bleibt. |
| `app/components/PlatformSidebar.tsx` | Nav-Eintrag „Design" → `/platform/design` (Zeile ~27) entfernen. **„Design-Anfragen" → `/platform/design-requests` bleibt** (anderes Feature). |

### Migration (DB)
Neue Migration `supabase/migrations/<next>_remove_design_versions.sql`:
- `ALTER TABLE public.platform_settings DROP COLUMN IF EXISTS platform_design_version, DROP COLUMN IF EXISTS restaurants_default_version;`
- `ALTER TABLE public.restaurants DROP COLUMN IF EXISTS admin_design_version, DROP COLUMN IF EXISTS guest_design_version;`
- CHECK-Constraints und Column-Grants fallen automatisch mit den Spalten weg. Keine RLS-Policy referenziert die Spalten (geprüft). Keine `CREATE TABLE` → keine neuen GRANTs nötig.

---

## Architektur danach

- Gast-Seiten: `page.tsx` lädt Restaurant-ID, rendert direkt die (einzige) `…V1`-Komponente.
- Admin: `layout.tsx` rendert `children`; `page.tsx` rendert `ClassicOverview`.
- Platform: `layout.tsx` ohne Versions-Verzweigung.
- Styling: `globals.css` definiert das Theme auf `:root` / `:root.dark` — kein Klassen-Switch mehr nötig.
- `design_config` bleibt die einzige Brand-Quelle (unverändert; #1 + Bugfixes #20–#22).

---

## Risiken & Verifikation

| Risiko | Gegenmaßnahme |
|--------|---------------|
| Versteckte V2-Referenz bricht Build | Vollständige Grep-Liste oben ist die Referenz; `npm run build` muss grün sein, keine `_v2`/`design-version`-Importe übrig. |
| Optische Regression | Nicht zu erwarten (alles war V1). Nach Deploy je eine Stichprobe: `/order/<token>`, `/bestellen/<slug>`, `/reservieren/<slug>`, `/admin` (Übersicht), `/platform`. |
| Migration löscht Spalten irreversibel | Spalten sind nach dem Code-Umbau nachweislich ungenutzt; Migration zuerst gegen Prod-Kopie ausführen. Kein Datenverlust an Nutzdaten (nur Theme-Flags). |
| `useDesignVersion`-Defaults entfernt | Keine `_v1`-Komponente nutzt den Provider (geprüft); nur `admin/page.tsx` → wird auf direkten Import umgestellt. |

## Definition of Done
- [ ] Alle `_v2`-Ordner, Switcher-UI, Design-APIs, `design-version.ts`, Provider gelöscht.
- [ ] 6 Seiten/Layouts rendern V1 direkt; Build grün; kein `resolveDesignVersion`/`_v2`-Import mehr im Source.
- [ ] `globals.css` ohne `.theme-v2`; Theme auf `:root`/`:root.dark`.
- [ ] Platform-Nav ohne „Design"-Switcher-Link (Design-Anfragen bleibt).
- [ ] Migration droppt die 4 Spalten; gegen Prod-Kopie verifiziert.
- [ ] Gast-/Admin-/Platform-Flächen sehen unverändert aus.
