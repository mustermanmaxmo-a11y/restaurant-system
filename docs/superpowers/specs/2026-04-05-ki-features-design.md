# Design: 3 KI-Features für RestaurantOS

**Datum:** 2026-04-05  
**Status:** Approved  
**Features:** KI-Schichtübergabe, KI-Kostenanalyse, KI-Vorbereitungsliste

---

## Kontext

Das RestaurantOS hat bereits zwei KI-Features:
- `menu-assistant` API: Gast-seitiger Chat (Empfehlungen, Allergene, Upselling)
- `inventory-suggestions` API: Inventar-Analyse (dringende Bestellungen, Anomalien, Spartipps)

Beide nutzen Claude Haiku über `resolveAiKey` (plan-basiertes API-Key-System). Die neuen Features bauen auf derselben Infrastruktur auf.

---

## Navigation (Hybrid-Ansatz)

- **Neue Seite `/admin/ki-tools`** mit 3 Tabs: Schichtübergabe | Kostenanalyse | Vorbereitungsliste
- **KI-Shortcut-Buttons auf bestehenden Seiten:**
  - `/admin/orders` → Button „Schicht übergeben" → leitet zu `/admin/ki-tools?tab=schicht`
  - `/admin/inventory` → Button „Kostenanalyse" → leitet zu `/admin/ki-tools?tab=kosten`
  - `/admin/menu` → Button „Vorbereitungsliste" → leitet zu `/admin/ki-tools?tab=vorbereitung`

---

## Feature 1: KI-Schichtübergabe

### Was es tut
Personal gibt am Schichtende kurze Stichpunkte ein. Die KI kombiniert diese mit den automatisch geladenen Schichtdaten (Bestellungen, Service Calls) und generiert einen strukturierten Übergabebericht für die nächste Schicht.

### Neue DB-Tabelle: `shift_handovers`

```sql
CREATE TABLE shift_handovers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id),
  shift_date      date NOT NULL,
  shift_type      text NOT NULL CHECK (shift_type IN ('morning', 'evening', 'full')),
  raw_notes       text,
  orders_summary  jsonb,  -- automatisch befüllt: Anzahl Bestellungen, Umsatz, häufigste Items
  ai_report       jsonb,  -- { highlights: [], issues: [], open_items: [], recommendation: "" }
  created_at      timestamptz DEFAULT now()
);
```

### Neue API Route: `POST /api/ai/shift-handover`

**Input:**
```json
{
  "restaurantId": "uuid",
  "shiftDate": "2026-04-05",
  "shiftType": "evening",
  "rawNotes": "Tisch 4 hatte Beschwerden, Lieferung Tomaten fehlt noch"
}
```

**Automatisch hinzugefügter Kontext (aus DB):**
- Bestellungen des Tages: Anzahl, Umsatz, meistbestellte Items
- Service Calls (waiter/bill) des Tages
- Letzte 3 Schichtübergaben (für Mustererkennung)

**AI Output (JSON):**
```json
{
  "highlights": ["80 Bestellungen, Umsatz +12% vs. letzter Freitag"],
  "issues": ["Tisch 4: Gast beschwerte sich über Wartezeit"],
  "open_items": ["Tomatenlieferung steht noch aus — Lieferant anrufen"],
  "recommendation": "Morgen früh Lagerbestand Tomaten prüfen, Freitag erfahrungsgemäß stark"
}
```

**Nach KI-Aufruf:** Bericht wird in `shift_handovers` gespeichert.

### UI
- Textarea für Stichpunkte (vorausgefüllt mit Schichtdatum/-typ)
- „Bericht generieren" Button
- Strukturierter Bericht mit farbigen Abschnitten (Highlights grün, Issues rot, Offene Punkte gelb)
- Verlauf der letzten Übergaben (klappbar)

---

## Feature 2: KI-Kostenanalyse

### Was es tut
Erweitert die bestehende `inventory-suggestions` API. Neu: Mehrere Lieferantenpreise pro Zutat, Margenberechnung pro Gericht, CSV-Import für Preislisten, KI-Lieferantenvergleich mit Empfehlungen.

### Neue DB-Tabelle: `supplier_prices`

```sql
CREATE TABLE supplier_prices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id),
  supplier_id    uuid NOT NULL REFERENCES suppliers(id),
  ingredient_id  uuid NOT NULL REFERENCES ingredients(id),
  price_per_unit numeric(10,4) NOT NULL,
  source         text NOT NULL CHECK (source IN ('manual', 'csv')),
  updated_at     timestamptz DEFAULT now(),
  created_at     timestamptz DEFAULT now(),
  UNIQUE(supplier_id, ingredient_id)
);
```

### Neue API Route: `POST /api/ai/cost-analysis`

**Automatisch geladener Kontext:**
- Alle `supplier_prices` pro Zutat (mehrere Lieferanten)
- `menu_item_ingredients` + `menu_items` für Margenberechnung
- `stock_movements` der letzten 30 Tage
- Bestehende `ingredients` mit `purchase_price`

**AI Output (JSON):**
```json
{
  "supplier_recommendations": [
    { "ingredient": "Tomaten", "best_supplier": "Transgourmet", "saving": "0.30€/kg", "reason": "22% günstiger als METRO" }
  ],
  "margin_alerts": [
    { "dish": "Pasta Bolognese", "current_margin": "18%", "issue": "Rinderhack +30% seit Jan" }
  ],
  "price_trends": ["Olivenöl +15% in 60 Tagen — Alternativen prüfen"],
  "savings_potential": "Durch Lieferantenwechsel bei 3 Produkten: ~120€/Monat"
}
```

### CSV-Import
- Modal mit Drag & Drop für CSV-Dateien
- Format: `Zutat,Preis pro Einheit` (einfach, kein festes Lieferantenformat)
- KI-gestütztes Parsen: erkennt Spalten automatisch
- Nach Import: Preise in `supplier_prices` mit `source: 'csv'` gespeichert

### UI
- Tabelle: Zutat × Lieferant mit Preis-Matrix
- Farbige Highlights: günstigster Preis pro Zeile grün
- „Preisliste importieren" Button (CSV)
- KI-Analyse Panel mit Empfehlungen

---

## Feature 3: KI-Vorbereitungsliste

### Was es tut
Schätzt die erwartete Gästezahl basierend auf Reservierungen + historischen Bestelldaten. Personal kann die Zahl korrigieren. KI generiert daraus eine Mise en Place Liste pro Zutat.

### Keine neue DB-Tabelle nötig
Nutzt bestehende Tabellen:
- `reservations` (für heutige/morgige Buchungen)
- `orders` (historische Daten für diesen Wochentag)
- `menu_items` + `menu_item_ingredients` + `ingredients` (für Rezeptmengen)
- `daily_specials` (für Tagesangebote)

### Neue API Route: `POST /api/ai/prep-list`

**Input:**
```json
{
  "restaurantId": "uuid",
  "targetDate": "2026-04-06",
  "guestCountOverride": 85
}
```

**Automatisch geladener Kontext:**
- Reservierungen für `targetDate`
- Ø Bestellungen der letzten 4 gleichen Wochentage
- Alle aktiven Menüpunkte mit Zutatenmengen
- Aktive Tagesangebote

**Gästeschätzung-Logik:**
1. Reservierungen für den Tag (Gästeanzahl summiert)
2. Ø Walk-in-Faktor aus letzten 4 gleichen Wochentagen
3. Kombination → Schätzung (vom Personal überschreibbar)

**AI Output (JSON):**
```json
{
  "estimated_guests": 75,
  "confidence": "high",
  "reasoning": "12 Reservierungen + Freitag Ø 63 Walk-ins",
  "prep_items": [
    { "ingredient": "Pasta", "unit": "kg", "quantity": 8.5, "note": "inkl. 10% Puffer" },
    { "ingredient": "Rinderhack", "unit": "kg", "quantity": 4.2, "note": "für Bolognese + Burger" }
  ],
  "specials_note": "Tagesangebot Lachsfilet: 15 Portionen empfohlen"
}
```

### UI
- Datums-Picker (Standard: morgen)
- KI-Schätzung mit Begründung anzeigen
- Editierbares Zahlenfeld für Gästeanzahl
- „Liste neu berechnen" Button
- Druckbare Vorbereitungsliste (Tabelle)

---

## Technische Rahmenbedingungen

- **KI-Modell:** Claude Haiku (`claude-haiku-4-5-20251001`) — konsistent mit bestehenden Features
- **Auth:** `resolveAiKey` — nutzt plan-basiertes Key-System (kein neues Setup)
- **Sicherheit:** Kein PII in KI-Prompts (wie bestehende Routes)
- **Plan-Gate:** Alle 3 Features nur für `pro` und `enterprise` Plan (wie `inventory-suggestions`)

---

## Migrations-Übersicht

```sql
-- 1. shift_handovers Tabelle
-- 2. supplier_prices Tabelle
-- RLS Policies für beide Tabellen (restaurant_id check)
```

---

## Out of Scope

- Vollautomatischer Live-Preis-Abruf von Lieferanten (keine öffentlichen APIs)
- Spracheingabe für Schichtübergabe (zurückgestellt nach Go-Live)
- Push-Notifications bei Schichtübergabe
