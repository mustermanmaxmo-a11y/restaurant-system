# KI-Roadmap Design — RestaurantOS

**Datum:** 2026-04-26
**Status:** Approved

---

## Kontext

Bereits live (main branch):
- `inventory-suggestions` — KI-Lagerbestandsempfehlungen
- `menu-extract` — Menü-Import aus PDF/Foto

Auf `feature/ki-features` (noch nicht gemergt):
- KI-Schichtübergabe, KI-Kostenanalyse, KI-Vorbereitungsliste

Diese Roadmap baut darauf auf und erweitert das System um 6 neue KI-Features.

---

## Phase 1 — Quick Wins

### 1. KI-Wochenbericht

**Ziel:** Betreiber bekommt automatisch einen strukturierten Wochenbericht ohne manuelle Arbeit.

**Wo:** Neuer Tab/Sektion in `/admin/stats`

**Inhalt des Reports:**
- Gesamtumsatz der Woche + Vergleich zur Vorwoche (%)
- Top 5 meistbestellte Gerichte
- Schwächste 5 Gerichte (wenig bestellt, niedrige Marge)
- Tisch-Auslastung pro Tag
- 2–3 KI-Empfehlungen in natürlicher Sprache

**Technisch:**
- API Route: `POST /api/ai/weekly-report`
- Modell: Claude Haiku (günstig, reicht für Datenauswertung)
- Datenquellen: `orders`, `menu_items`, `tables`, `reservations`
- Nur Pro/Enterprise (via `resolveAiKey`)

**E-Mail opt-in:**
- Toggle in `/admin/settings`: "Wöchentlichen Report per E-Mail erhalten"
- Schreibt Flag in `restaurant_settings` Tabelle
- n8n Cron-Job liest Flag vor Versand — sendet nur wenn aktiviert
- Dashboard-Ansicht ist immer verfügbar, unabhängig vom E-Mail-Toggle

---

### 2. Smarte Menüempfehlung

**Ziel:** Gast tippt Präferenzen/Allergien, KI filtert das Menü und markiert passende Gerichte.

**Wo:** `/bestellen/[slug]` (beide Design-Versionen v1 + v2) und `/order/[token]`

**UX:**
- Kleines Textfeld oberhalb der Menü-Liste: "Allergien oder Vorlieben? (z.B. vegan, keine Nüsse)"
- Kein Modal — direkt in bestehende Filter-UI integriert
- Passende Gerichte: grün markiert / highlighted
- Ungeeignete Gerichte: ausgegraut mit Hinweis warum

**Technisch:**
- API Route: `POST /api/ai/menu-filter`
- Input: `{ restaurantId, query: string, menuItems: [...] }`
- Output: `{ suitable: string[], unsuitable: { id: string, reason: string }[] }`
- Modell: Claude Haiku (Latenz-kritisch, muss schnell sein)
- Nur für Pro-Restaurants sichtbar

---

## Phase 2 — Mittlere Features

### 3. Umsatzprognose

**Ziel:** Betreiber sieht eine KI-Prognose für die nächsten 7 Tage mit Begründung.

**Wo:** `/admin/stats` — neue Karte "Prognose nächste 7 Tage"

**Inhalt:**
- Geschätzter Umsatz pro Tag (Wert in €)
- Kurzer KI-Text warum (z.B. "Freitag +20% — hohe Reservierungsquote, historisch stark")
- Konfidenz-Indikator (niedrig/mittel/hoch je nach Datenlage)

**Datenquellen:**
- `orders` (historische Umsätze nach Wochentag/Datum)
- `reservations` (kommende Reservierungen)
- Wochentag-Muster aus den letzten 4 Wochen

**Technisch:**
- API Route: `POST /api/ai/revenue-forecast`
- Modell: Claude Haiku
- Wird on-demand berechnet (Button "Prognose aktualisieren"), nicht permanent gecacht

---

### 4. KI-Wartezeitschätzung (ETA)

**Ziel:** Gast sieht nach der Bestellung eine realistische Wartezeit, Personal sieht ETA pro Tisch/Bestellung.

#### Staff Check-in System

Neue DB-Tabelle `staff_presence`:
```sql
id            uuid primary key
restaurant_id uuid references restaurants(id)
staff_id      uuid references staff(id)
role          text  -- kitchen / waiter / delivery
checked_in_at timestamptz
checked_out_at timestamptz nullable
```

- Personal klickt "Ich bin da" beim Login ins Dashboard → Insert in `staff_presence`
- "Schicht beendet" → `checked_out_at` wird gesetzt
- System zählt aktive Kitchen-Staff (wo `checked_out_at IS NULL`) für ETA-Formel

#### ETA-Berechnung

**Zubereitungszeiten:**
- Betreiber trägt pro Gericht eine Ø-Zubereitungszeit ein (Minuten) im Menü-Editor
- System lernt parallel aus echten Daten: Ø-Zeit zwischen `order.status = cooking` und `order.status = served` pro Gericht
- Nach 1 Monat fließen echte Daten gewichtet ein (neuere Daten > ältere), manueller Wert verliert schrittweise Einfluss — kontinuierliches Lernen

**Formeln:**

```
dine_in / pickup:
  ETA = (Σ Zubereitungszeit aller offenen Gerichte vor dieser Bestellung) / Anzahl aktive Köche

delivery:
  ETA = Küchen-ETA + gelernter Liefer-Puffer
  Liefer-Puffer: Betreiber setzt Startwert (z.B. 25 Min)
  System lernt aus: Zeitdifferenz out_for_delivery → served
  Nach 1 Monat: gewichteter Durchschnitt (echte Daten überwiegen zunehmend)
```

**Wo wird ETA angezeigt:**
- `/order/[token]` — Tischgast sieht Live-ETA nach Bestellung (Realtime via Supabase)
- `/bestellen/[slug]` — Pickup/Delivery-Gast sieht ETA auf Status-Seite nach Bestellung
- `/dashboard` — Personal sieht ETA pro Tisch/Bestellung in der Bestellliste

**Technisch:**
- `estimated_time` Feld existiert bereits in `orders` — wird beim INSERT befüllt
- ETA-Berechnung in Server Action oder API Route: `POST /api/orders/calculate-eta`
- Kein Claude-Modell für die Berechnung (pure Arithmetik + SQL)
- Claude Haiku optional für Erklärungstext ("Küche aktuell gut ausgelastet")
- Realtime-Updates via bestehende Supabase-Subscription auf `orders`

---

### 5. Menü-Profitabilität

**Ziel:** Betreiber sieht auf einen Blick welche Gerichte profitabel sind und welche gestrichen werden sollten.

**Wo:** `/admin/menu` — neuer "Profitabilität" Button / Tab

**Ampel-System:**
- Grün: Top-Seller + gute Marge
- Gelb: Beliebt aber teuer (Zutatenkosten hoch)
- Rot: Selten bestellt + niedrige Marge → Streichkandidat

**Datenquellen:**
- `orders.items` (Bestellhäufigkeit pro Gericht)
- `menu_item_ingredients` + `ingredients.purchase_price` (Zutatenkosten)
- `supplier_prices` (aus ki-features Branch — alternative Lieferantenpreise)

**KI-Output:**
- Ampel-Status pro Gericht
- 1-Satz-Begründung ("Wird 3x pro Woche bestellt, Marge 68%")
- 2–3 übergreifende Empfehlungen (z.B. "Überdenke Gerichte in der roten Zone")

**Technisch:**
- API Route: `POST /api/ai/menu-profitability`
- Modell: Claude Haiku
- Nur Pro/Enterprise

---

## Phase 3 — Strategisch

### 6. KI-Personalplanung

**Ziel:** KI schlägt Schichtpläne vor basierend auf historischer Auslastung — reduziert Über- und Unterbesetzung.

**Wo:** `/admin/staff` — neuer Tab "Schichtplanung"

**Funktionsweise:**
- KI analysiert: Bestellvolumen pro Wochentag + Uhrzeit (letzte 4 Wochen), Reservierungen, historische Schichtdaten aus `staff_presence`
- Output: Empfohlene Besetzung pro Schicht (z.B. "Freitag 18–22 Uhr: 2 Köche + 2 Kellner")
- Betreiber kann Vorschlag anpassen und als Plan speichern
- Export als PDF

**Technisch:**
- API Route: `POST /api/ai/staff-planning`
- Modell: Claude Haiku (strukturierte Datenanalyse)
- Neue DB-Tabelle `shift_plans` für gespeicherte Pläne
- Nur Pro/Enterprise

---

## Übersicht

| Phase | Feature | Aufwand | Nutzer | Plan |
|-------|---------|---------|--------|------|
| 1 | KI-Wochenbericht | ~2 Tage | Betreiber | Pro/Enterprise |
| 1 | Smarte Menüempfehlung | ~2 Tage | Gast | Pro |
| 2 | Umsatzprognose | ~3 Tage | Betreiber | Pro/Enterprise |
| 2 | KI-Wartezeitschätzung | ~4 Tage | Gast + Personal | Pro |
| 2 | Menü-Profitabilität | ~3 Tage | Betreiber | Pro/Enterprise |
| 3 | KI-Personalplanung | ~5 Tage | Betreiber | Pro/Enterprise |

**Gesamt-Aufwand:** ~19 Tage
