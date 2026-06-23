# Premium Template Library — Design Spec

**Datum:** 2026-06-23
**Status:** Approved
**Vorgänger:** [2026-06-12-unified-brand-system-design.md](2026-06-12-unified-brand-system-design.md)

---

## Ziel

5 echte Premium-Templates bauen, die alle 3 Gast-Flächen konsistent stylen — Landing Page, Tisch-App (`/order/[token]`), Online-Bestellen (`/bestellen/[slug]`). Qualität wie Squarespace: jedes Template hat eine eigene visuelle Identität und Hero-Struktur, nicht nur andere Farben.

Gleichzeitig: Architektur so sauber halten, dass Luca (Co-Founder) jederzeit neue Templates hinzufügen kann — ohne Kerncode anzufassen.

---

## Architektur

### Was sich ändert

**`lib/resolve-brand.ts`** — ein neues Feld im `ResolvedBrand`-Interface:

```ts
heroLayout: 'classic-overlay' | 'bold-statement' | 'split' | 'centered-minimal' | 'gradient-glow'
```

Gelesen aus `design_config.hero_layout`. Fallback: `'classic-overlay'`.

**`app/[slug]/info/page.tsx`** — statt einem einzigen Hart-kodierten Hero rendert die Seite die passende Komponente:

```tsx
// Vorher: ein einziger monolithischer <header>
// Nachher:
<LandingHero brand={brand} content={content} ctaHref={ctaHref} />
// → wählt intern die richtige Struktur anhand brand.heroLayout
```

**`components/landing/`** — neues Verzeichnis mit 5 Hero-Komponenten + einer Switch-Komponente:

```
components/landing/
  LandingHero.tsx          ← Switch-Komponente (wählt anhand heroLayout)
  HeroClassicOverlay.tsx   ← Rustico
  HeroBoldStatement.tsx    ← Strada
  HeroSplit.tsx            ← Bianco
  HeroCenteredMinimal.tsx  ← Natura
  HeroGradientGlow.tsx     ← Vibrante
```

**`design_config` (Supabase jsonb)** — bestehende Felder bleiben. Neues Feld: `hero_layout`.

**`supabase/migrations/`** — eine Migration die `design_templates` für die 5 Templates updated (neue Seeds + `hero_layout`-Feld in config).

### Was sich NICHT ändert

- `resolveBrand`-Signatur bleibt kompatibel — nur ein neues optionales Feld wird hinzugefügt
- `design_templates`-Tabelle bleibt unverändert — `config` jsonb ist flexibel genug
- Screenshot-Adaptation-Feature bleibt: schreibt weiterhin Farb-/Font-Felder in `design_config`, `hero_layout` bleibt vom aktiven Template
- Order/Bestellen V1-Komponenten werden nicht neu gebaut — sie lesen bereits `design_config`-Farben via `buildColorsFromRestaurant`; der verbesserte Stil kommt durch `borderRadius`, `cardStyle` und `animationStyle` die bereits in `resolveBrand` existieren

### Wie Luca ein neues Template hinzufügt (Erweiterungsvertrag)

1. SQL-Insert in `design_templates` mit `config` jsonb (Felder siehe Template-Definitionen unten)
2. Falls neuer `heroLayout`-Wert gewünscht: neue Komponente in `components/landing/` + Case in `LandingHero.tsx`
3. Fertig — Template erscheint automatisch in der Branding-Galerie

---

## Die 5 Templates

### 1. Rustico

**Zielgruppe:** Italiener, Griechen, Tavernen, mediterrane Küche  
**Character:** Warm, familiär, handgemacht — wie eine Einladung nach Hause  
**Font Pair:** `playfair-lato` — Playfair Display (Heading) + Lato (Body)  
**Hero Layout:** `classic-overlay`  
**Menu Layout:** `cards` (runde, warme Karten mit Schatten)

**Farben:**

| Token | Wert |
|-------|------|
| `bg_color` | `#F5EDE0` |
| `surface_color` | `#FFFFFF` |
| `header_color` | `#3D2010` |
| `primary_color` | `#C4622D` |
| `button_color` | `#C4622D` |
| `card_color` | `#FFFFFF` |
| `text_color` | `#3D2010` |

**Style Tokens:**

| Token | Wert |
|-------|------|
| `border_radius` | `rounded` |
| `hover_effect` | `scale` |
| `animation_style` | `fade` |
| `card_style` | `elevated` |

**`HeroClassicOverlay` — Struktur:**
- Vollbild-Header (min-height 320px mobile, 480px desktop)
- Hintergrundbild wenn vorhanden, sonst warmer Gradient (`#C4622D22 → #F5EDE0`)
- Schwarzes Overlay (0.45 → 0.6) über dem Bild
- Zentriert: kleiner Label ("RISTORANTE" / Küche) → Restaurant-Name in Playfair serif → Trennlinie → Untertitel → CTA-Button
- Darunter: 3-spaltige Info-Leiste (Öffnungszeit / Tischnummer / Küche-Status) auf weißem Untergrund

---

### 2. Strada

**Zielgruppe:** Burger-Joints, Pizzerien, Fast Casual, Street Food  
**Character:** Energetisch, selbstbewusst, laut — das Essen ist die Hauptperson  
**Font Pair:** `space-dmsans` — Space Grotesk (Heading) + DM Sans (Body)  
**Hero Layout:** `bold-statement`  
**Menu Layout:** `large-cards` (große Bilder, volle Breite)

**Farben:**

| Token | Wert |
|-------|------|
| `bg_color` | `#111111` |
| `surface_color` | `#1E1E1E` |
| `header_color` | `#111111` |
| `primary_color` | `#FF3B30` |
| `button_color` | `#FF3B30` |
| `card_color` | `#1E1E1E` |
| `text_color` | `#FFFFFF` |

**Style Tokens:**

| Token | Wert |
|-------|------|
| `border_radius` | `rounded` |
| `hover_effect` | `glow` |
| `animation_style` | `slide` |
| `card_style` | `elevated` |

**`HeroBoldStatement` — Struktur:**
- Dark Header-Bar (Logo links, Name, Status-Badge rechts)
- Große Typografie: 2-zeiliger Marketing-Claim in Space Grotesk ExtraBold (z.B. "ECHTES / BEEF."), zweite Zeile in Akzentfarbe
- Kleiner Subtext (Küche-Attribute, Stadt)
- CTA-Button (Akzentfarbe, kein Hero-Bild nötig)
- Horizontal scrollbare Featured-Karten der Top 3–4 Gerichte direkt darunter (Preview-Strip)
- **Daten-Hinweis:** Landing Page fetcht dafür zusätzlich `SELECT id, name, price, image_url FROM menu_items WHERE restaurant_id = $1 AND available = true LIMIT 4` — schlanker separater Query, kein N+1

---

### 3. Bianco

**Zielgruppe:** Sushi-Restaurants, Fine Dining, moderne japanische/asiatische Küche  
**Character:** Radikal minimal — Stille kommuniziert Qualität  
**Font Pair:** `inter-inter` — Inter Light/Regular (Heading) + Inter (Body)  
**Hero Layout:** `split`  
**Menu Layout:** `list` (keine Karten — Listenzeilen mit Trennlinien)

**Farben:**

| Token | Wert |
|-------|------|
| `bg_color` | `#FAFAFA` |
| `surface_color` | `#FFFFFF` |
| `header_color` | `#FFFFFF` |
| `primary_color` | `#111111` |
| `button_color` | `#111111` |
| `card_color` | `#FFFFFF` |
| `text_color` | `#111111` |

**Style Tokens:**

| Token | Wert |
|-------|------|
| `border_radius` | `sharp` |
| `hover_effect` | `underline` |
| `animation_style` | `fade` |
| `card_style` | `flat` |

**`HeroSplit` — Struktur:**
- Zwei Spalten (mobile: Stack, desktop: 50/50)
- Links: Restaurant-Kategorie (uppercase, sehr klein, mit viel Abstand) → Name in Inter Light (großes Font-Weight-Kontrast) → Öffnungszeit → Rechteckiger CTA-Button
- Rechts: Hero-Bild (object-fit: cover), ohne Overlay. Wenn kein Bild: subtiler Grau-Gradient
- Darunter: Kategorie-Tabs als Unterstrich-Navigation (kein Pill-Stil)
- Speisekarte als reine Listenansicht: Name (Letter-Spacing) | Beschreibung (muted) | Preis — mit 1px-Trennlinie

---

### 4. Natura

**Zielgruppe:** Vegane Cafés, Bowl-Restaurants, Bio, Farm-to-Table  
**Character:** Geerdet, offen, ehrlich — man spürt die Zutaten  
**Font Pair:** `syne-dmsans` — Syne (Heading) + DM Sans (Body)  
**Hero Layout:** `centered-minimal`  
**Menu Layout:** `cards` (outlined, mit Emoji-Icons, pill-radius)

**Farben:**

| Token | Wert |
|-------|------|
| `bg_color` | `#F0F4EC` |
| `surface_color` | `#FFFFFF` |
| `header_color` | `#F0F4EC` |
| `primary_color` | `#2D5016` |
| `button_color` | `#2D5016` |
| `card_color` | `#FFFFFF` |
| `text_color` | `#2D5016` |

**Style Tokens:**

| Token | Wert |
|-------|------|
| `border_radius` | `pill` |
| `hover_effect` | `scale` |
| `animation_style` | `fade` |
| `card_style` | `outlined` |

**`HeroCenteredMinimal` — Struktur:**
- Viel Weißraum, kein Hero-Bild als Background — stattdessen kleines Logo oben
- Status-Pill ("Küche geöffnet" mit grünem Punkt) als erstes Element
- Restaurantname in Syne, zentriert, normales Fontgewicht (kein Heavy)
- Stadt + Küchen-Typ in muted
- Pill-CTA-Button in Grün
- Dietary-Tags als Chip-Row: 🌱 Vegan · 🌾 Glutenfrei · ♻️ Bio
- Menükarten: outlined border, runde Ecken (pill-radius), Icon/Emoji, kompakt

---

### 5. Vibrante

**Zielgruppe:** Ramen, Asian Fusion, Bubble Tea, Street Food Asia  
**Character:** Nacht-Atmosphäre, urban, jung — wie ein guter Song  
**Font Pair:** `space-dmsans` — Space Grotesk (Heading) + DM Sans (Body)  
**Hero Layout:** `gradient-glow`  
**Menu Layout:** `grid` (2-spaltig, dunkle Karten mit farbigen Akzenten)

**Farben:**

| Token | Wert |
|-------|------|
| `bg_color` | `#0D0D1A` |
| `surface_color` | `#1A1A2E` |
| `header_color` | `#0D0D1A` |
| `primary_color` | `#A855F7` |
| `button_color` | `#A855F7` |
| `card_color` | `#1A1A2E` |
| `text_color` | `#FFFFFF` |

**Sonderfall:** Vibrante nutzt einen Gradient-Akzent (`#FF6B6B → #A855F7`) für CTAs und aktive States. Dieser wird als zusätzliches `design_config`-Feld gespeichert: `accent_secondary: "#FF6B6B"`. `resolveBrand` gibt `colors.accentSecondary` zurück (aus `design_config.accent_secondary`, Fallback: gleich wie `accent`). Alle anderen Templates ignorieren dieses Feld — es hat keinen Effekt wenn nicht gesetzt.

**Style Tokens:**

| Token | Wert |
|-------|------|
| `border_radius` | `rounded` |
| `hover_effect` | `glow` |
| `animation_style` | `slide` |
| `card_style` | `ghost` |

**`HeroGradientGlow` — Struktur:**
- Tief-dunkler Background mit 2 farbigen Radial-Gradient-Glows (Lila oben-rechts, Rot-Orange unten-links)
- Restaurant-Name + Gradient-Text-Clip für zweite Zeile
- Küchen-Attribut (klein, letter-spaced, muted)
- Gradient-CTA-Button (`linear-gradient(90deg, #FF6B6B, #A855F7)`)
- Kategorie-Chips mit farbigen Ghost-Borders (jede Kategorie eine eigene Farbe)
- 2-spaltiges Menü-Grid, Karten mit Ghost-Stil und subtilen farbigen Border-Glows

---

## Galerie-Vorschau (Branding-Seite)

Jedes Template bekommt eine echte HTML-Vorschau-Karte in der Galerie — nicht mehr abstrakte Farbpunkte.

**Implementierung:** `<TemplatePreviewCard template={t} />` — rendert eine skalierte (transform: scale(0.3)) Version des jeweiligen Hero als Live-HTML. Kein Bild nötig, kein Screenshot-Service.

**Warum:** Skaliertes Live-HTML ist pixel-perfect, immer aktuell, und kostet null externe Abhängigkeiten.

---

## Reihenfolge der Umsetzung

1. **`resolveBrand` erweitern** — `heroLayout` hinzufügen (10 min)
2. **5 Hero-Komponenten bauen** — je eine Datei, pure TSX/Inline-Styles (kein Tailwind-Conflict mit brand-Farben)
3. **`LandingHero` Switch-Komponente** + Landing Page updaten
4. **Galerie-Vorschau** — `TemplatePreviewCard` + Branding-Seite
5. **Migration** — 5 Template-Seeds updaten mit neuen Feldern
6. **Order + Bestellen** — `cardStyle` + `borderRadius` aus `resolveBrand` in `MenuItemCard` und `MenuItemGrid` durchdraten (sind schon partial implementiert, vervollständigen)

---

## Erweiterungsvertrag für Luca

Luca kann ein neues Template hinzufügen durch:

```sql
-- In einer neuen Migration-Datei:
INSERT INTO design_templates (name, slug, category, config, plan_tier, style_tags)
VALUES (
  'Mein Template',
  'mein-template',
  'casual',
  '{
    "bg_color": "#...",
    "primary_color": "#...",
    "font_pair": "space-dmsans",
    "hero_layout": "bold-statement",
    "border_radius": "rounded",
    "hover_effect": "glow",
    "animation_style": "slide",
    "card_style": "elevated",
    "layout_variant": "cards"
  }',
  'free',
  '["dark", "bold"]'
);
```

Wenn ein neuer `hero_layout`-Wert gewünscht ist: neue Komponente in `components/landing/` + ein `case`-Eintrag in `LandingHero.tsx`. Das ist der einzige Code-Eingriff.

---

## Out of Scope

- Neues Branding-Editor-UI (separate Aufgabe)
- KI-Bildgenerierung für Hero-Bilder
- Custom Domain Templates
- A/B Testing zwischen Templates
