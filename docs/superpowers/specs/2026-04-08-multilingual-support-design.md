# Multilingual Support — Design Spec

**Date:** 2026-04-08  
**Scope:** Admin Dashboard + Gäste-Bestellseiten  
**Approach:** Custom LanguageContext (analog zu ThemeProvider)

---

## Sprachen

| Code | Sprache     | Flag |
|------|-------------|------|
| de   | Deutsch     | 🇩🇪  |
| en   | English     | 🇬🇧  |
| es   | Español     | 🇪🇸  |
| it   | Italiano    | 🇮🇹  |
| tr   | Türkçe      | 🇹🇷  |
| fr   | Français    | 🇫🇷  |
| pl   | Polski      | 🇵🇱  |
| ru   | Русский     | 🇷🇺  |

Default: `de`. Persistenz: `localStorage` (Key: `language`).

---

## Architektur

### Neue Dateien

**`app/lib/translations.ts`**  
Verschachteltes Objekt mit allen 8 Sprachen. Struktur:
```ts
type Translations = { [key: string]: string | Translations }
const translations: Record<Lang, Translations> = { de: {...}, en: {...}, ... }
export default translations
```

Schlüssel-Namespaces:
- `nav` — Sidebar-Navigation (Übersicht, Bestellungen, Menü, etc.)
- `order` — Bestellseite (Warenkorb, Bestellen, Status-Labels, etc.)
- `admin` — Admin-spezifische Strings (Speichern, Bearbeiten, Löschen, etc.)
- `common` — Shared (Laden, Fehler, Abmelden, etc.)
- `auth` — Login/Register-Seiten

**`app/components/providers/language-provider.tsx`**  
```ts
type Lang = 'de' | 'en' | 'es' | 'it' | 'tr' | 'fr' | 'pl' | 'ru'
interface LanguageContextType {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string  // dot-notation: t('nav.overview')
}
```
- Liest aus `localStorage` beim Mount, Default `'de'`
- `t()` löst dot-notation Keys auf, Fallback auf deutschen Text wenn Key fehlt

**`app/components/ui/language-selector.tsx`**  
- Kompakter Button: Flagge + Kürzel (z.B. `🇩🇪 DE`)
- Klick öffnet Dropdown mit allen 8 Sprachen (Flagge + Name)
- Schließt bei Klick außerhalb
- Gleicher visueller Stil wie ThemeToggle (rounded-full, border, surface-2)

### Geänderte Dateien

**`app/app/layout.tsx`**  
`LanguageProvider` wird um `ThemeProvider` herum gewrappt (oder innen).

**`app/app/admin/layout.tsx`**  
`LanguageSelector` in Sidebar-Bottom-Section, unter dem Theme-Toggle-Button.

**`app/app/bestellen/[slug]/page.tsx`**  
- `useLanguage()` importieren
- Alle harkodierten deutschen Strings durch `t('...')` ersetzen
- Language-Selector oben rechts neben Theme-Toggle

**`app/app/order/[token]/page.tsx`**  
- Gleich wie `/bestellen/[slug]`
- STATUS_LABELS, DIETARY_FILTERS, ALLERGEN_FILTERS übersetzt

**Weitere Pages (geringer Aufwand):**
- `app/app/login/page.tsx`
- `app/app/owner-login/page.tsx`
- `app/app/register/page.tsx`
- `app/app/admin/orders/page.tsx`
- `app/app/admin/menu/page.tsx`
- `app/app/admin/tables/page.tsx`
- `app/app/admin/staff/page.tsx`
- Alle weiteren Admin-Pages

---

## Übersetzungsumfang

**Wird übersetzt:**
- Alle UI-Strings (Buttons, Labels, Navigationspunkte, Fehlermeldungen, Platzhalter)
- Status-Labels (`new`, `cooking`, `served`, `cancelled`)
- Dietary-Filter-Labels
- Allergen-Namen

**Wird NICHT übersetzt:**
- Restaurant-Name (aus Supabase)
- Kategorie-Namen (aus Supabase)
- Tisch-Namen (aus Supabase)

---

## Automatische Inhaltsübersetzung (WordPress-Ansatz)

Menüpunkt-Namen und -Beschreibungen werden **einmalig beim Speichern automatisch übersetzt** — analog zu WPML/Polylang in WordPress.

### DB-Schema-Erweiterung

`menu_items` bekommt eine neue JSONB-Spalte:
```sql
ALTER TABLE menu_items ADD COLUMN translations JSONB DEFAULT '{}';
```

Struktur der `translations`-Spalte:
```json
{
  "en": { "name": "Margherita Pizza", "description": "Tomato, mozzarella, basil" },
  "es": { "name": "Pizza Margarita", "description": "Tomate, mozzarella, albahaca" },
  "fr": { "name": "Pizza Margherita", "description": "Tomate, mozzarella, basilic" },
  ...
}
```

### Übersetzungs-Flow

1. Admin öffnet Menü-Editor und speichert ein Gericht (neu oder bearbeitet)
2. **Supabase Edge Function** `translate-menu-item` wird getriggert
3. Edge Function ruft **Claude API** auf mit dem deutschen Original-Text
4. Alle 8 Sprachen werden in einem einzigen API-Call generiert
5. `translations`-Spalte wird in Supabase aktualisiert
6. Ab sofort liest die Gästeseite `item.translations[lang]?.name ?? item.name`

### Neue Datei: `supabase/functions/translate-menu-item/index.ts`
- Empfängt `{ item_id, name, description }`
- Ruft Claude API auf: `claude-haiku-4-5` (günstig, schnell)
- Gibt JSON mit allen 8 Sprachen zurück
- Schreibt Ergebnis in `menu_items.translations`

### Admin-Menü-Editor (`app/app/admin/menu/page.tsx`)
- Nach erfolgreichem Speichern: Toast "Wird übersetzt..." → Edge Function call
- Kein Blocking — Übersetzung läuft im Hintergrund
- Optional: "Neu übersetzen"-Button pro Gericht

### Gästeseiten
```ts
const name = item.translations?.[lang]?.name ?? item.name
const description = item.translations?.[lang]?.description ?? item.description
```
Fallback immer auf deutschen Originaltext wenn Übersetzung fehlt.

---

## Language Selector — Platzierung

| Bereich | Position |
|---------|----------|
| Admin Sidebar | Unter Theme-Toggle, Sidebar-Bottom-Section |
| Admin Mobile Header | Nicht sichtbar (Platz zu eng) — im Sidebar-Drawer |
| Gästeseite `/bestellen/[slug]` | Oben rechts, neben Theme-Toggle |
| Gästeseite `/order/[token]` | Oben rechts, neben Theme-Toggle |
| Login / Register | Oben rechts als freistehender Button |

---

## Persistenz & Initialisierung

- `localStorage` Key: `language`
- Default wenn kein Wert: `'de'`
- Kein SSR-Mismatch-Problem da der Wert erst im `useEffect` geladen wird (gleiche Pattern wie Theme)
- `html lang` Attribut wird bei Sprachwechsel aktualisiert: `document.documentElement.lang = lang`

---

## Nicht in Scope

- URL-basiertes i18n-Routing (kein `/en/admin`)
- Automatische Browser-Spracherkennung
- Arabisch / RTL-Sprachen
- Übersetzungs-Management-System (alle Strings sind direkt in `translations.ts`)
- Automatische Übersetzung von Kategorienamen, Tischnamen, Restaurant-Name
- Übersetzung von Bestellnotizen oder Sonderanforderungen der Gäste
