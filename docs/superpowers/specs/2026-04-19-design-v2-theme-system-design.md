# Design V2 Theme-System

**Status:** Approved
**Datum:** 2026-04-19
**Scope:** Komplettes neues "V2 Bento Premium" Theme parallel zum bestehenden "V1 Classic" Theme, mit Platform-Admin-Switcher.

## Ziel

Einführung eines versionierten Theme-Systems, das dem Platform-Owner erlaubt, zwischen dem aktuellen Design (V1) und einem neuen Premium-Design (V2) zu wechseln — separat für die Platform-Admin-Oberfläche, als Restaurant-Default und als Override pro Restaurant. Das neue V2-Theme deckt sowohl Admin-Interface als auch Gast-Seiten ab. Restaurant-Branding (Logos, Brand-Farben) bleibt als unabhängiger Layer on-top aktiv.

## Scope

### In Scope

- Komplettes neues V2-Theme für Admin-Bereich (`/admin/*`)
- Komplettes neues V2-Theme für Gast-Seiten (`/bestellen/[slug]`, `/reservieren/[slug]`, `/order/[token]`)
- Komplettes neues V2-Theme für Platform-Admin (`/platform/*`)
- Theme-Switcher-Seite `/platform/design`
- Supabase-Schema-Erweiterungen für Theme-Persistierung
- Theme-Provider-Erweiterung mit `designVersion`-Context
- V1 bleibt 1:1 als Default erhalten

### Out of Scope

- Light-Mode für V2 — V2 ist dark-only in dieser Phase; V1 behält beide Modi. Der bestehende Dark/Light-Toggle wird in V2-Layouts nicht angezeigt.
- Restaurant-Branding-System (bleibt unverändert als Override-Layer)
- Mehrsprachigkeit der Theme-Seite (DE reicht)
- Bulk-Zuweisung von V2 an mehrere Restaurants gleichzeitig (kann später)
- V3, V4 — aber Architektur ist erweiterbar

## Design-Richtung V2

**Stil:** Bento Premium — Apple-inspirierte modulare Karten auf dunklem Grund.

**Typografie:** Geist (Vercel) als einzige Font-Familie, Weights 300–800.

**Farbsystem (V2-Basis, vor Restaurant-Branding-Override):**

| Token | Hex | Zweck |
|-------|-----|-------|
| `--bg` | `#0A0A0F` | Body-Background (tiefes Graublau statt reinem Schwarz) |
| `--surface` | `#111118` | Karten-Background |
| `--surface-2` | `#16213e` | Elevated Cards / Hover |
| `--surface-elevated` | `#1a1a2e` | Sidebar / Modals |
| `--accent` | `#EA580C` | Primary (Orange) |
| `--accent-hover` | `#F97316` | Hover-State |
| `--accent-glow` | `#EA580C40` | Glow-Overlays |
| `--text` | `#F5F5F7` | Primary-Text |
| `--text-muted` | `#8B8B93` | Secondary-Text |
| `--border` | `#1F1F28` | Standard-Border |
| `--card-radius` | `16px` | Alle Karten |
| `--card-shadow` | `0 8px 32px rgba(0,0,0,0.4)` | Elevation |
| `--gradient-accent` | `linear-gradient(135deg, #EA580C, #F97316)` | CTAs, Hero |

**Layout-Prinzipien V2:**

- **Admin-Dashboard:** Bento-Grid (2fr 1fr 1fr, variierende Kartengrößen) statt Listen
- **Sidebar:** 64px Icon-only, expandiert bei Hover auf 220px
- **Gast-Seiten:** Mobile-First, Gradient-Hero, horizontale Tab-Scrolls, Sticky-CTA mit Glow
- **Reservieren:** One-Page-Flow (Datum → Uhrzeit → Personen → Bestätigen) ohne Scroll-Stops
- **Hover:** Scale 1.02 + Accent-Glow (statt reinen Farbshift in V1)

## Architektur

### Daten-Modell

**Neue Supabase-Spalten:**

```sql
-- Tabelle: platform_settings (existiert bereits für andere Settings)
alter table platform_settings
  add column platform_design_version text default 'v1',
  add column restaurants_default_version text default 'v1';

-- Tabelle: restaurants
alter table restaurants
  add column admin_design_version text,  -- null = use platform default
  add column guest_design_version text;  -- null = use platform default

-- CHECK constraints
alter table platform_settings
  add constraint platform_design_version_check check (platform_design_version in ('v1','v2')),
  add constraint restaurants_default_version_check check (restaurants_default_version in ('v1','v2'));

alter table restaurants
  add constraint admin_design_version_check check (admin_design_version in ('v1','v2') or admin_design_version is null),
  add constraint guest_design_version_check check (guest_design_version in ('v1','v2') or guest_design_version is null);
```

### Auflösungs-Logik

| Scope | Quelle |
|-------|--------|
| `/platform/*` | `platform_settings.platform_design_version` |
| `/admin/*` (Restaurant-Owner) | `restaurants.admin_design_version` → Fallback `platform_settings.restaurants_default_version` |
| `/bestellen`, `/reservieren`, `/order` | `restaurants.guest_design_version` → Fallback `platform_settings.restaurants_default_version` |

### Komponenten-Struktur

```
app/
  components/
    providers/
      design-version-provider.tsx    # Neu — Context + useDesignVersion()
      theme-provider.tsx             # Bestehend — light/dark, bleibt orthogonal

  app/
    admin/
      layout.tsx                     # Switcht zwischen AdminLayoutV1 und AdminLayoutV2
      _v2/
        AdminLayoutV2.tsx           # Neu — Icon-Sidebar + Bento
      _v1/
        AdminLayoutV1.tsx           # Refaktor — aktueller Code extrahiert
      page.tsx                       # Conditional: BentoOverview vs. ClassicOverview
      _v2/
        BentoOverview.tsx           # Neu — Bento-Dashboard
      _v1/
        ClassicOverview.tsx         # Refaktor — aktueller Code extrahiert
      # Gleiches Pattern für orders/, menu/, reservations/, etc.

    bestellen/[slug]/
      page.tsx                       # Conditional Render
      _v1/BestellenV1.tsx
      _v2/BestellenV2.tsx

    reservieren/[slug]/
      page.tsx                       # Conditional Render
      _v1/ReservierenV1.tsx
      _v2/ReservierenV2.tsx

    order/[token]/
      page.tsx                       # Conditional Render
      _v1/OrderV1.tsx
      _v2/OrderV2.tsx

    platform/
      design/
        page.tsx                     # Neu — Theme-Switcher
      layout.tsx                     # Conditional: PlatformLayoutV1 / V2
      _v2/PlatformLayoutV2.tsx
      _v1/PlatformLayoutV1.tsx
```

### Theme-Provider

```tsx
// components/providers/design-version-provider.tsx
type DesignVersion = 'v1' | 'v2'
type Scope = 'platform' | 'admin' | 'guest'

interface DesignVersionContext {
  version: DesignVersion
  scope: Scope
  isLoading: boolean
}

// Server-Side: fetcht aus Supabase basierend auf URL-Segment + User
// Client-Side: wendet Klasse `theme-v1` oder `theme-v2` auf <html> an
// Export: useDesignVersion() Hook
```

**CSS-Struktur `globals.css`:**

```css
/* V1 bleibt Default — bestehende Tokens */
:root, .theme-v1 { /* ... unverändert ... */ }
.theme-v1.dark { /* ... unverändert ... */ }

/* V2 — neue Tokens */
.theme-v2 {
  --bg: #0A0A0F;
  --surface: #111118;
  /* ... siehe Farbsystem oben ... */
}
```

### Font-Loading

In `app/layout.tsx`:

```tsx
import { Geist } from 'next/font/google'
const geist = Geist({ subsets: ['latin'], weight: ['300','400','500','600','700','800'], variable: '--font-geist' })
// Syne + DM Sans (V1) bleiben geladen
```

V2 verwendet `--font-geist` via CSS-Variable `--font-body: var(--font-geist)` in der `.theme-v2`-Scope-Klasse.

### Theme-Switcher-Seite `/platform/design`

**Server-Component** liest aktuelle Settings aus `platform_settings` + alle Restaurants.

**Client-Component** rendert drei Sektionen:

1. **Platform Admin** — Toggle V1 / V2 → Update `platform_settings.platform_design_version`
2. **Restaurants Default** — Toggle V1 / V2 → Update `platform_settings.restaurants_default_version`
3. **Per-Restaurant Override** — Liste aller Restaurants, pro Zeile Auto/V1/V2 → Update `restaurants.admin_design_version` + `restaurants.guest_design_version` (beide gleichzeitig, "Auto" = `null`)

**Save-Verhalten:** Optimistic UI, nach erfolgreichem Update Toast "Design gespeichert".

**Reload-Verhalten:** Nach Änderung der eigenen Platform-Version → automatischer `router.refresh()`, damit das Theme sofort greift.

### Navigation

Neuer Eintrag in `components/PlatformSidebar.tsx`:

```
- Dashboard
- Restaurants
- Team
- Design          ← NEU (Icon: Palette)
- Design Requests
- Billing
- Legal
- Settings
```

Sichtbar für Rollen `owner` + `co_founder`.

## User-Flow

### Fall 1: Platform-Owner schaltet sich auf V2

1. Owner öffnet `/platform/design`
2. Klickt V2 unter "Platform Admin"
3. Supabase-Update → Toast → `router.refresh()`
4. Platform-Layout lädt mit `theme-v2` Klasse → neues Bento-Design sofort sichtbar

### Fall 2: Restaurant-Default auf V2 setzen

1. Owner klickt V2 unter "Restaurants Default"
2. Supabase-Update → Toast
3. Alle Restaurants mit `admin_design_version = null` bekommen bei nächstem Request V2
4. Restaurants mit explizitem V1-Override bleiben auf V1

### Fall 3: Einzelnes Restaurant auf V1 halten

1. Owner klickt "V1" in Zeile "Burger Republic"
2. Update `restaurants.admin_design_version = 'v1'` + `guest_design_version = 'v1'`
3. Dieses Restaurant bleibt auch dann auf V1, wenn Default auf V2 wechselt

## Error-Handling

- **Invalid Value in DB:** Wenn `designVersion` aus DB nicht in `['v1','v2']`, Fallback auf `'v1'`
- **Supabase-Read-Fehler:** Fallback auf `'v1'` + Log (Sentry)
- **Font-Load-Fehler:** Geist wird per `next/font` geladen → automatischer System-Font-Fallback
- **Theme-Switcher-Save-Fehler:** Toast "Konnte nicht speichern, bitte erneut versuchen"

## Testing

- **Unit-Tests:**
  - `getDesignVersion(scope, user)` Auflösungslogik (Fallback-Chain korrekt)
  - Constraint-Checks auf DB-Ebene
- **E2E-Tests (Playwright):**
  - Platform-Owner schaltet auf V2 → V2 sichtbar nach Reload
  - Restaurant-Owner mit explizit V1 bleibt auf V1 trotz Default-V2
  - Gast auf `/bestellen/[slug]` sieht korrektes Theme pro Restaurant
- **Visual-Regression:**
  - Screenshot-Tests für V1 vor und nach Refactor → muss pixel-identisch bleiben

## Migration / Rollout

1. **Phase 1 — Infrastruktur:** Supabase-Schema, Theme-Provider, CSS-Tokens, V1-Refactor (Code in `_v1/` extrahiert, Tests grün)
2. **Phase 2 — V2 Admin:** `AdminLayoutV2`, `BentoOverview`, alle Admin-Unterseiten in V2
3. **Phase 3 — V2 Platform:** `PlatformLayoutV2`, Platform-Unterseiten in V2
4. **Phase 4 — V2 Guest:** `BestellenV2`, `ReservierenV2`, `OrderV2`
5. **Phase 5 — Theme-Switcher:** `/platform/design`-Seite + Navigation
6. **Default bleibt V1** — Owner aktiviert V2 manuell nach QA

## Offene Fragen

_Keine — alle Scope-Fragen in Brainstorming geklärt._

## Anti-Patterns zu vermeiden

- **Keine Emojis als Icons** — nur Lucide React SVG-Icons
- **Keine Hardcoded-Farben in V2-Komponenten** — immer CSS-Variablen aus `.theme-v2`
- **Kein silent Fallback ohne Log** — unbekannte Version loggt zu Sentry
- **Keine Mehrfach-Updates pro Klick** — ein Save pro Toggle-Aktion, optimistic UI
