# Professionalisierung: Weg vom KI-Look

**Datum:** 2026-07-16 · **Status:** Plan (Umsetzung folgt in Opus-Session)
**Ziel:** Alle Flächen (Public Site, Gast-Apps, Betreiber-Dashboard, Platform) wirken wie ein
professionell designtes Produkt — nicht wie generierter Code. Messbar, in PRs geschnitten, ohne Big-Bang.

---

## Teil 1 — Audit: Warum wirkt es aktuell „KI-generiert"?

Die folgenden Befunde sind gemessen, nicht gefühlt (Stand: main @ 6495916).

### 1.1 Es gibt kein Design-System im Code (Kernproblem)

| Messwert | Ist | Soll |
|---|---|---|
| Inline-Styles `style={{…}}` | **5.887** | ~0 (nur dynamische Brand-Farben) |
| Tailwind `className=` | 112 | Standard-Weg |
| Verschiedene `fontSize`-Werte | **25+** (0.55–1.6rem, inkl. 0.62/0.73/0.88) | 6–7 Stufen |
| Verschiedene `borderRadius`-Werte | **15+** (2–20px, inkl. 7/9/11/13px) | 4 Tokens |
| Geteilte UI-Primitives in `components/ui/` | 4 (kein Button, kein Input, keine Card, kein Modal) | ~16 |
| Inline definierte `Modal`/`StatCard`-Duplikate | mind. 5 Dateien | 1 Komponente |

Tailwind 4 ist installiert, wird aber praktisch nicht benutzt. Jede Seite stylt sich selbst —
deshalb driftet alles minimal auseinander. **Genau diese Mikro-Inkonsistenz ist der Haupt-Tell.**
Kein einzelnes Element ist falsch, aber nichts passt exakt zusammen.

### 1.2 Emojis als Icons (stärkster sichtbarer Tell)

**126 Emoji-Vorkommen in 35 UI-Dateien**, obwohl `lucide-react` eingebunden ist:
- Seiten-Überschriften: „💧 Win-Back Drip", „🍳 KI-Vorbereitungsplan", „📧 Email Marketing", „🎁 Loyalty"
- Buttons: „✨ Mit KI", „💾 Rezept speichern", „🗑"
- Kategorien/Status: „🥩 Fleisch", „🤢 Verdorben", „🟢/🟡/🔴"-Ampeln
- Betroffen: fast alle Admin-Seiten, Platform, staff, split, pricing, unsubscribe

Emojis in **Inhalten** (z. B. vom Betreiber verfasste E-Mail-Betreffs) sind ok. Emojis im
**UI-Chrome** (Überschriften, Buttons, Labels, Nav) sind der klassische ChatGPT-Look → alle raus.

### 1.3 Marken-Identitätskrise

- Public Site heißt **OrderIQ**, Admin/Staff/Register/Root-Metadata heißen **RestaurantOS** (11 Dateien)
- `theme-color` Meta ist `#00C9A7` (Türkis) — passt zu **keiner** existierenden Akzentfarbe
- Plattform-Akzent wechselt zwischen Light (`#FF6B2C` Orange) und Dark (`#00C853` Grün) — zwei Marken-Identitäten
- Platform-Admin nutzt zusätzlich Violett (`#7C3AED`) — dritte Identität
- Homepage nutzt wieder ein anderes Orange (`#EA580C`)

### 1.4 Public Site = generisches AI-SaaS-Template

`app/app/page.tsx` hat alle Merkmale der Standard-KI-Landingpage:
- Uppercase-Badge „Das modernste Restaurant-System" (unbelegbare Superlative)
- Emoji-Feature-Grid (📱⚡🤖⭐🎁📧)
- Orange Gradient-CTAs mit Glow-Schatten, `borderRadius: 13px`
- „Bereit loszulegen?"-Abschluss-CTA in Gradient-Box
- Vergleichstabelle gegen Flipdish/Mr. Yum/Toast mit ✓/✕ (rechtlich heikel + wirkt erfunden)
- Kein einziger Produkt-Screenshot, kein Demo-Link — nur Behauptungen

### 1.5 Professionalitäts-Basics fehlen

- **Metadata: nur 3 von 91 Seiten** definieren `metadata`/`generateMetadata`. Restaurant-Landing
  (`/[slug]/info`) und `/bestellen/[slug]` haben **kein** per-Restaurant-SEO/OG → geteilter Link in
  WhatsApp zeigt „RestaurantOS" statt Restaurantname + Bild
- **Kein** `not-found.tsx`, `error.tsx` oder `loading.tsx` im gesamten Projekt (Default-Next-Fehlerseiten!)
- `public/` enthält noch die Next.js-Starter-SVGs (`next.svg`, `vercel.svg`, `globe.svg`, …)
- Kein OG-Image, Favicon vermutlich Next-Default (prüfen), nur 2 PWA-Icons
- `<img>` 38× benutzt, `next/image` **0×** → LCP/CLS-Schaden auf bildlastigen Gastseiten
- `aria-*` nur 24× in der gesamten App; Scrollbars global versteckt (a11y-Problem am Desktop)
- Copy-Ton inkonsistent: „Wir vermissen dich! 🍕", „🎉 … aktiviert!" neben nüchternem Fachdeutsch;
  du/Du/Sie gemischt

### 1.6 Performance-Tells

- **11 Google-Font-Familien** werden im Root-Layout auf **jeder** Seite geladen (auch Gast-Handy
  am Tisch) — genutzt werden pro Restaurant genau 2
- Gast-Apps sind Client-Monolithen: `BestellenV1.tsx` 2.223 Zeilen, `OrderV1.tsx` 1.549 Zeilen,
  `admin/settings` 1.180 Zeilen — alles ein Bundle, alles `'use client'`

### 1.7 Halbfertige i18n

Admin-Nav mischt `t('nav.orders')` mit hartkodiertem „Bestellhistorie", „Küchen-Display",
„Lieferanten". Übersetzungsdatei existiert (671 Zeilen), deckt aber nur Teile ab. Halbfertig
wirkt unprofessioneller als bewusst einsprachig.

### 1.8 Admin-IA überladen

19 Sidebar-Punkte in 4 Gruppen **plus** 12 Marketing-Unterseiten. Kein Betreiber findet
„Tagesabschluss" vs. „Statistiken" vs. „Übersicht" intuitiv. (Deckt sich mit Teilprojekt #4
aus der Design-Überholung vom 12.06.)

---

## Teil 2 — Zielbild & Designprinzipien

**Referenzklasse:** Betreiber-/Platform-Flächen wie Linear/Stripe-Dashboard (ruhig, dicht,
monochrom mit einem Akzent). Gast-Flächen wie hochwertige Restaurant-Sites (Squarespace-Klasse):
appetitlich, bildgetrieben, typografisch ruhig — das Restaurant ist der Star, nicht unsere UI.

**Prinzipien (gelten für jede Zeile der Umsetzung):**
1. **Ein System, eine Quelle:** Alle Werte kommen aus Tokens. Kein px-Wert, keine Hex-Farbe
   direkt in einer Seite (Ausnahme: dynamische Brand-Farben der Restaurants via `resolveBrand`).
2. **Icons statt Emojis** im UI-Chrome. Lucide, 1 Größe pro Kontext (16 inline, 18 nav, 20 primär).
3. **Zeigen statt behaupten:** Screenshots, Live-Demo, echte Zahlen — keine Superlative.
4. **Ruhe:** max. 1 Akzentfarbe pro Fläche, Grautöne arbeiten lassen, Animationen dezent
   (Confetti & Bounce nur an genau 1 Moment: Bestellung erfolgreich).
5. **Zustände sind Design:** Jede Liste hat Empty/Loading/Error-State mit derselben Komponente.
6. **Deutsch, konsequent Du** in Betreiber-Flächen (Zielgruppe Gastro, per Du), **neutral-imperativ**
   auf Gast-Flächen („Jetzt bestellen", nie „Bestelle jetzt dein Essen!"). Keine Ausrufezeichen, kein ✨.

---

## Teil 3 — Grundsatzentscheidungen (mit David geklärt am 2026-07-16)

| # | Entscheidung | ✅ Beschluss |
|---|---|---|
| E1 | **Produktname** | **OrderIQ** — überall vereinheitlichen (UI, Metadata, E-Mail-Templates, 4 PWA-Manifeste, README). „RestaurantOS" verschwindet komplett |
| E2 | **Plattform-Akzentfarbe** | **Dunkles Petrol/Blau-Türkis** (Basis `#0E7490`, finaler Wert in Phase 1 mit Kontrast-Check ≥ 4.5:1). David: Orange zu nah an Lieferando. Petrol ist im Gastro-SaaS unbesetzt, hebt sich von Lieferando (orange) und Wolt (hellblau) ab, identisch in Light & Dark. Grün `#10B981` bleibt ausschließlich Status „serviert", Violett fliegt aus Platform raus. Gilt für die **Plattform-Marke** (Public Site, Admin, Platform, Staff) — Restaurant-Brands bleiben frei wählbar via `resolveBrand` |
| E3 | **i18n** | i18n-Aufrufe bleiben, aber 100 % Deutsch als Basis; EN-Ausbau nach Go-Live (Empfehlung angenommen, nicht separat abgefragt) |
| E4 | **Vergleichstabelle Homepage** | **Ersetzen** durch „Warum OrderIQ"-Sektion ohne Wettbewerbernamen (§ 6 UWG-Risiko eliminiert) |
| E5 | **Demo-Restaurant öffentlich** | **Ja** — „Live-Demo ansehen"-Link auf der Homepage. Voraussetzung: Demo-Restaurant mit guten Inhalten pflegen (Fotos, Menü, Landing) — Teil von Phase 4 |

---

## Teil 4 — Umsetzungsplan (6 Phasen, jede Phase = 1–3 PRs)

Reihenfolge folgt dem Demo-Pfad eines Kunden: Foundation → Gast → Dashboard-Kern → Public → Rest.

### Phase 1 — Design-Foundation (Basis für alles, ~1 Session)

**PR 1.1: Token-System** — `app/app/globals.css`
Tailwind-4-`@theme` mit festen Tokens; die bestehenden CSS-Variablen bleiben als semantische
Schicht, werden aber auf die Skala gezogen:

```css
@theme {
  /* Typo-Skala (einzige erlaubte Größen) */
  --text-xs: 0.75rem;   /* Meta, Badges */
  --text-sm: 0.8125rem; /* Sekundärtext, Tabellen */
  --text-base: 0.875rem;/* UI-Standard */
  --text-md: 1rem;      /* Fließtext Gast */
  --text-lg: 1.125rem;  /* Kartentitel */
  --text-xl: 1.5rem;    /* Seitentitel */
  --text-2xl: 2rem;     /* Hero klein */
  --text-3xl: 3rem;     /* Hero groß */
  /* Radius */
  --radius-sm: 6px;  --radius-md: 10px;  --radius-lg: 14px;  --radius-full: 9999px;
  /* Spacing: nur 4er-Raster (4/8/12/16/24/32/48/64) */
  /* Schatten: 3 Stufen statt ad-hoc rgba-Schatten */
}
```
Zusätzlich: `theme-color` fixen, Dark-Mode-Akzent = Light-Mode-Akzent (E2), Platform-Violett
in `p-btn-primary`/`p-input` durch Akzent ersetzen.

**PR 1.2: UI-Primitives** — `app/components/ui/` (jeweils mit Tailwind, CVA für Varianten;
CVA + `tailwind-merge` sind schon installiert):

| Komponente | Varianten/API |
|---|---|
| `Button` | variant: primary/secondary/ghost/danger · size: sm/md/lg · `loading`-Prop mit Spinner |
| `IconButton` | wie Button, quadratisch, Pflicht-`aria-label` |
| `Input`, `Textarea`, `Select` | label, hint, error-State eingebaut (nie wieder lose `<label>`) |
| `Card` | padding-Varianten, optional header/footer-Slots |
| `Badge` / `StatusPill` | Status-Farben aus Tokens (new/cooking/served + neutral/warn/danger) |
| `Modal` / `Sheet` | ersetzt die ≥5 Inline-Duplikate; Ark UI ist installiert → als Basis nutzen |
| `Table` | th/td-Styles, Zebra optional, sticky header |
| `Tabs` | für Marketing-Konsolidierung (Phase 5) |
| `EmptyState` | icon + Titel + Text + optionale Aktion — überall identisch |
| `Skeleton` | ersetzt SkeletonBlock-Duplikate |
| `StatCard` | Zahl + Label + optionaler Trend — ersetzt Inline-Versionen |
| `PageHeader` | Titel + Beschreibung + Aktionen rechts — jede Admin/Platform-Seite beginnt damit |
| `Toast` | Erfolgs-/Fehlermeldungen statt inline-Divs |

**PR 1.3: Housekeeping**
- Next-Starter-SVGs löschen, richtiges Favicon-Set (`icon.svg` + `apple-icon.png` via App-Router-Konvention)
- Globales `not-found.tsx`, `error.tsx`, `global-error.tsx` (gebrandet, mit Link zurück)
- Root-`metadata` vervollständigen (Name aus E1, description, OG-Defaults, `metadataBase`)

**Akzeptanz Phase 1:** Storybook light — eine interne Seite `/dev/ui` (nur dev) rendert alle
Primitives; kein neuer Code darf `style={{fontSize: …}}` einführen (ESLint-Regel
`react/forbid-dom-props` für `style` als warning, Allowlist für Brand-Farben-Komponenten).

### Phase 2 — Gast-Flächen (umsatz- & demo-kritisch, ~2 Sessions)

**PR 2.1: Tisch-App `order/[token]` (OrderV1, 1.549 Zeilen)**
- In Unterkomponenten schneiden: `MenuView`, `CartSheet`, `StatusView`, `ItemDetailSheet`
  (unter `order/[token]/_components/`), Styles auf Tokens + Brand-Farben
- Emojis raus (⭐-Overlay → Lucide `Star`, ⚠-Allergen → dezentes Badge)
- Confetti nur bei „Bestellung bestätigt", Bounce-Animationen halbieren
- Warenkorb als sticky Bottom-Bar mit Summe (Standard-Pattern aus Lieferando/Wolt — Gäste kennen es)
- `<img>` → `next/image` mit `sizes`, blur-Placeholder für Gerichte-Fotos

**PR 2.2: Online-App `bestellen/[slug]` (BestellenV1, 2.223 Zeilen)** — gleiche Behandlung;
V1-Dateien beider Apps teilen sich danach `_components/` wo identisch (Memory: getrennte Apps
bleiben getrennt gepflegt — geteilt wird nur über `components/`, nicht über Cross-Imports)

**PR 2.3: Restaurant-Landing `/[slug]/info` + SEO**
- `generateMetadata` pro Restaurant: Titel „{Name} — {Ort}", description aus Landing-Content,
  OG-Image = Hero-Bild (später: dynamisches OG via `ImageResponse`)
- `LandingPageSections`: Bilder auf `next/image`, Typo-Hierarchie auf Skala, Galerie mit festen
  `aspect-ratio` (kein CLS)
- Öffnungszeiten: „Heute geöffnet · 11–22 Uhr"-Logik schärfen (Feiertage/Ausnahmen egal, aber
  „Geschlossen"-Zustand muss stimmen)

**Akzeptanz Phase 2:** Playwright-Screenshots (mobile 390px) von Menü/Warenkorb/Status vorher/
nachher; Lighthouse mobile auf `/bestellen/[demo]` ≥ 90 Performance (aktuell ungemessen —
Baseline in PR 2.1 dokumentieren).

### Phase 3 — Betreiber-Dashboard Kern (~2 Sessions)

**PR 3.1: AdminLayout + Kernseiten** (`AdminLayoutInner`, `overview`, `orders`, `orders/history`, `kds`)
- Sidebar auf Primitives; alle Labels hartkodiert Deutsch (E3), einheitliche Icon-Größe
- IA-Straffung Stufe 1 (ohne Seiten zu löschen): „Tagesabschluss" unter Statistiken-Gruppe,
  Gruppen umbenennen: *Betrieb* (Übersicht, Bestellungen, Historie, Küchen-Display) · *Restaurant*
  (Speisekarte, Angebote, Tische, Reservierungen, Öffnungszeiten) · *Wachstum* (Marketing, Statistiken,
  Tagesabschluss) · *Verwaltung* (Personal, Lager, Lieferanten) · *Konto* (Design, Integrationen, Abo, Einstellungen)
- Jede Kernseite: `PageHeader` + `StatCard` + `Table`/`EmptyState` aus Primitives, Emojis → Lucide

**PR 3.2: Menü + Einstellungen** (`menu` 1.157 Z., `settings` 1.180 Z.)
- `settings` in Sektions-Komponenten schneiden (`_components/LoyaltySettings.tsx` etc.),
  Emoji-Überschriften (🎁⚠️📧🍳🔄) → Icon + Titel-Pattern aus `PageHeader`-Familie
- `menu`: Kartenliste auf `Card`/`Table`, Rezept-Toggle (🍳▲▼) → Chevron-Icons

**PR 3.3: Marketing-Bereich konsolidieren** (12 Unterseiten)
- Visuell vereinheitlichen (alle auf Primitives), „✨ Mit KI"-Buttons → einheitlicher
  `Button` mit `Sparkles`-Icon (Lucide, nicht Emoji) und Label „Mit KI erstellen"
- Optional (wenn Zeit): birthday/drip/referral/loyalty als Tabs unter „Automationen"

**Akzeptanz Phase 3:** 0 Emojis in `app/admin/**` (Grep-Check im PR), jede Seite beginnt mit
`PageHeader`, keine Inline-`Modal`-Definition mehr.

### Phase 4 — Public Site neu (~1 Session)

**PR 4.1: Homepage** (`app/app/page.tsx`)
- Struktur: Nav · Hero mit **echtem Produkt-Screenshot** (Dashboard + Handy-Mockup der Gast-App,
  als optimierte PNG/WebP in `public/marketing/`) · „Demo ansehen"-Button → Demo-Restaurant (E5)
  · 3 Kern-Nutzen (nicht 6 Features) mit Lucide-Icons · How-it-works (3 Schritte, behalten,
  ohne Gradient-Kreise) · Preis-Teaser · FAQ (5 echte Fragen: „Brauchen Gäste eine App?",
  „Was passiert bei Internetausfall?", „Wie lange dauert das Setup?", „DSGVO?", „Kündigungsfrist?")
  · ruhiger Abschluss-CTA
- Raus: „Das modernste"-Badge, Vergleichstabelle (E4), Gradient-Buttons/Glow, Emoji-Grid,
  erfundene Stats-Bar → ersetzen durch faktische („3 Apps · 1 System", „Setup < 5 Min" nur wenn belegbar)
- Typo: ein Font-Paar für die Marke (Geist ist geladen und passt — heading 600/800, keine 11 Fonts)
- Screenshots erstellen: Playwright gegen lokale Demo-Daten (webapp-testing), 2×-Retina
- Demo-Restaurant für E5 kuratieren: vollständige Speisekarte mit Fotos, gepflegte Landing,
  Öffnungszeiten — Qualitätsanker, denn dieser Link IST die Produktdemo

**PR 4.2: Pricing + ROI-Rechner + Register** — gleiche Sprache, Emojis (🔒💳🎯) → Icons,
Registrier-Flow: Feldvalidierung mit `Input`-error-States statt Alerts

**Akzeptanz Phase 4:** Homepage enthält ≥ 2 echte Produktbilder, 0 Emojis, 0 unbelegte
Superlative; OG-Preview in Slack/WhatsApp sauber (Titel, Description, Bild).

### Phase 5 — Systemweite Politur (~1 Session)

**PR 5.1: Fonts & Performance**
- Font-Diät: Root-Layout lädt nur Geist (Plattform-Font); die 6 Restaurant-Font-Paare werden
  **nur auf Gast-Routen** geladen (eigenes `layout.tsx` für `(guest)`-Route-Group oder
  `next/font` in den Gast-Layouts) → Admin lädt 1 Familie statt 11
- Weights ausdünnen (Geist 300–800 → 400/500/700)
- Route-Group-`loading.tsx` für admin/platform/gast (Skeleton aus Primitives)

**PR 5.2: A11y & Zustände**
- `IconButton` überall mit `aria-label` (Sweep), `focus-visible`-Ringe global (`:focus-visible`
  auf Token-Akzent), Kontrast-Fix: `--text-muted` `#888` auf `#F7F6F3` = 3.5:1 → auf `#6B6B6B` (4.6:1)
- Scrollbar-Hiding nur noch auf Gast-Mobile-Containern, nicht global
- Microcopy-Sweep mit fester Wortliste (siehe Teil 6): alle „!"-Sätze, „Wir vermissen dich! 🍕"-
  Platzhalter, gemischte Anreden

**PR 5.3: Naming-Vereinheitlichung** (E1)
- Grep-Sweep OrderIQ/RestaurantOS → ein Name in UI, Metadata, E-Mails (`lib/email-base-templates.ts`
  prüfen!), PWA-Manifeste (4 Stück), README

### Phase 6 — Platform-Admin (nur David sichtbar, niedrigste Prio, ~1 Session)
- Violett → Akzent (E2), `p-*`-Klassen auf Primitives mappen, Emojis raus (trials 🔴🟡🔵🟢 →
  `StatusPill`), Seiten behalten ihre Struktur — hier zählt Konsistenz, nicht Redesign

---

## Teil 5 — Was bewusst NICHT angefasst wird

- **Backend/API-Routen, Supabase-Schema, Zahlungslogik** — funktioniert, kein Design-Thema
- **Editor-Studio** (`admin/branding`) — frisch gebaut (Juli), nur Emoji-/Token-Sweep, kein Umbau
- **i18n-Ausbau** (E3), **Custom Domains**, **Spracheingabe** — bleiben zurückgestellt
- **V1-Redesign der Gast-Apps von Grund auf** — wir professionalisieren das Bestehende;
  Template-Bibliothek (#2, Luca) läuft parallel und bleibt unberührt

## Teil 6 — Copy-Richtlinien (für alle Phasen, im PR-Review prüfbar)

1. Keine Ausrufezeichen in UI-Text (Ausnahme: echte Warnungen)
2. Keine Emojis im UI-Chrome; ✨ ist als „KI"-Marker verboten, stattdessen `Sparkles`-Icon + Text
3. Keine Superlative ohne Beleg („modernste", „beste", „revolutionär")
4. Betreiber-Flächen: Du-Form, aktiv, kurz („Speisekarte hochladen" statt „Hier kannst du deine Speisekarte hochladen!")
5. Gast-Flächen: neutral-imperativ („Jetzt bestellen", „Zur Karte"), keine Anrede
6. Fehlertexte: Was ist passiert + was tun („Speichern fehlgeschlagen. Prüfe deine Verbindung und versuch es erneut.")
7. Zahlen konkret statt Marketing-rund („in 3 Schritten" ok, „1000+ Restaurants" verboten solange unwahr)

## Teil 7 — Definition of Done (pro Seite, als PR-Checkliste)

- [ ] 0 Emojis im UI-Chrome, 0 neue Inline-`fontSize`/`borderRadius`/Hex-Farben
- [ ] Nutzt `PageHeader`, `Button`, `Card`, `EmptyState` aus `components/ui/`
- [ ] Empty-, Loading-, Error-State vorhanden
- [ ] Bilder über `next/image` mit `sizes` + `alt`
- [ ] Interaktive Icons haben `aria-label`; Tastatur-Fokus sichtbar
- [ ] Copy folgt Teil 6
- [ ] Mobile 390px geprüft (Screenshot im PR)

## Teil 8 — Aufwand & Reihenfolge (Empfehlung)

| Phase | Inhalt | Aufwand | Warum diese Prio |
|---|---|---|---|
| 1 | Foundation (Tokens + Primitives) | ~1 Session | Ohne sie wird jede weitere Änderung wieder Drift |
| 2 | Gast-Flächen + Landing-SEO | ~2 Sessions | Das sehen Gäste + Kunden-Demos zuerst |
| 3 | Dashboard-Kern | ~2 Sessions | Zweiter Teil jeder Demo; größter Emoji-Bestand |
| 4 | Public Site | ~1 Session | Erster Eindruck für zahlende Betreiber |
| 5 | Politur (Fonts, A11y, Naming) | ~1 Session | Hebt alles auf ein Niveau |
| 6 | Platform-Admin | ~1 Session | Sieht nur David — zuletzt |

Jede Phase einzeln mergebar. Innerhalb einer Phase: PRs klein halten (max. ~500 Zeilen Diff),
`verify`-Lauf + Screenshot vor jedem Merge.
