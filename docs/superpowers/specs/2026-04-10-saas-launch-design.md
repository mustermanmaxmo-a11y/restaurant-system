# RestaurantOS — SaaS Launch Design

## Zusammenfassung

Umbau des Restaurant-Systems von einem Einzelprojekt zu einem verkaufsfertigen SaaS-Produkt. Umfasst: Trial-Modus, Preispakete mit Feature-Gating, QR-Code PDF-Export, geführtes Onboarding und PWA fürs Personal-Dashboard. Gleichzeitig wird Gast-Payment (Stripe Connect) entfernt und Statistiken ehrlich als "Bestellanalyse" positioniert.

---

## Grundsätzliche Entscheidungen

### Kein Gast-Payment
Das System ist ein **digitales Bestellsystem**, kein Kassensystem. Gäste bestellen per QR-Code, bezahlt wird traditionell (Karte/Cash am Tisch). Gründe:
- Stripe Connect wäre regulatorisch komplex (Zahlungsplattform, KYC/AML)
- Kassenpflicht in DE: Alle Transaktionen müssen durch ein zertifiziertes Kassensystem (TSE-Pflicht)
- Restaurants haben bereits ein Kassensystem — wir ergänzen es, ersetzen es nicht

### Statistiken = Bestellanalyse
Das System sieht nur QR-Bestellungen, nicht den gesamten Umsatz. Statistiken werden ehrlich als "Bestellanalyse" positioniert: Bestellanzahl, Top-Gerichte, Stoßzeiten, Tisch-Aktivität. Kein Umsatz-Versprechen.

---

## 1. Trial-Modus

### Mechanik
- Bei Registrierung: `trial_ends_at = NOW() + 14 Tage` in `restaurants`-Tabelle
- `plan = 'trial'` — alle Pro-Features freigeschaltet
- Keine Kreditkarte erforderlich

### Nach 14 Tagen
- Dashboard: Banner "Testphase abgelaufen — Plan wählen"
- Gast-Bestellseite (`/bestellen/[slug]`): deaktiviert, zeigt "Restaurant aktuell offline"
- Admin-Dashboard bleibt zugänglich (damit Besitzer zahlen kann)
- Daten werden nicht gelöscht

### Plan wählen
- "Plan wählen"-Button im Dashboard, jederzeit klickbar (auch vor Trial-Ende)
- Bei Planwahl vor Trial-Ende: sofortige Aktivierung
- Kein Stripe-Schritt im Onboarding-Wizard

### Abo-Kuendigung
- Bei Kuendigung: `plan` wird auf `'expired'` gesetzt (neuer Status)
- Gleiches Verhalten wie abgelaufener Trial: Dashboard zugaenglich, Gast-Seite offline
- Daten bleiben erhalten, Besitzer kann jederzeit neuen Plan waehlen

---

## 2. Preispakete

### 3 Pläne

| | Starter (29 EUR/Monat) | Professional (59 EUR/Monat) | Enterprise (auf Anfrage) |
|---|---|---|---|
| Tische | max 15 | unbegrenzt | unbegrenzt |
| Mitarbeiter | max 3 | unbegrenzt | unbegrenzt |
| Speisekarte + QR-Bestellung | ja | ja | ja |
| Realtime Bestellstatus | ja | ja | ja |
| Tagesgerichte / Specials | ja | ja | ja |
| Bestellanalyse | letzte 7 Tage | voller Zeitraum + Trends | voll |
| KI-Menuassistent (Chat) | nein | ja | ja |
| Reservierungen | nein | ja | ja |
| Branding (Logo + Farben) | nein | ja | ja |
| Mehrere Standorte | nein | nein | ja |
| POS-Integration | nein | nein | ja |

### Datenbank
- `plan`-Feld in `restaurants`: `'trial'` | `'starter'` | `'pro'` | `'enterprise'` | `'expired'`
- `trial_ends_at`: timestamp, nullable

### Stripe
- 2 Stripe-Produkte: `STRIPE_PRICE_STARTER` + `STRIPE_PRICE_PRO`
- Enterprise: kein Self-Service, manueller Kontakt
- Webhook synct `plan`-Feld bei Abo-Start, Wechsel, Kuendigung

### Feature-Gating
- Zentrale Funktion `getPlanLimits(plan)` in `lib/plan-limits.ts`
- API-Routen pruefen Limits serverseitig (z.B. Tisch anlegen -> Limit-Check)
- Gesperrte Features im Dashboard: sichtbar mit Upgrade-Hinweis, nicht versteckt
- UI-Komponente `<UpgradeHint feature="ki-chat" />` fuer gesperrte Features

---

## 3. QR-Code PDF

### Layout (1 QR-Code pro A4-Seite)

```
+-------------------------------+
|                               |
|       [Restaurant-Logo]       |
|       Restaurant Name         |
|                               |
|    +---------------------+    |
|    |                     |    |
|    |     QR-CODE         |    |
|    |     (~8cm)          |    |
|    |                     |    |
|    +---------------------+    |
|                               |
|         Tisch 5               |
|                               |
|   - - - - - - - - - - - - -   |
|                               |
|   Scannen Sie den Code, um    |
|   die Speisekarte zu oeffnen  |
|   und zu bestellen.           |
|                               |
|   Scan the QR code to open    |
|   the menu and place your     |
|   order.                      |
|                               |
+-------------------------------+
```

### Details
- Logo aus Branding-Bereich (Pro-Plan), ohne Logo nur Restaurant-Name
- Tischnummer prominent unter QR-Code
- Anleitung zweisprachig (DE + EN)
- QR-Code URL: `https://[domain]/bestellen/[slug]?tisch=[nr]`
- Generierung clientseitig mit `jsPDF` + `qrcode`-Library
- "Alle QR-Codes herunterladen" -> ein PDF, jeder Tisch eine Seite

### Starter-Plan
- Kein Logo, nur Restaurant-Name als Text
- Ansonsten gleiches Layout

---

## 4. Onboarding-Wizard

### 5 Schritte (erweitert bestehende `/admin/setup`)

**Schritt 1 — Restaurant-Info** (existiert bereits)
- Name + automatischer Slug
- Restaurant wird angelegt: `plan: 'trial'`, `trial_ends_at: +14 Tage`

**Schritt 2 — Speisekarte**
- Mindestens 1 Kategorie + 1 Gericht anlegen (Pflicht)
- Vereinfachter Editor: Name, Preis, optional Beschreibung
- Hinweis: "Kann spaeter im Dashboard vervollstaendigt werden"

**Schritt 3 — Tische**
- Eingabefeld: "Wie viele Tische hat dein Restaurant?"
- Automatische Nummerierung (Tisch 1, Tisch 2, ...)
- Spaetere Anpassung im Dashboard moeglich

**Schritt 4 — QR-Codes herunterladen**
- Vorschau der generierten QR-Code-Seiten
- "PDF herunterladen"-Button
- Hinweis: "Drucke die Codes aus und platziere sie auf deinen Tischen"
- Ueberspringen moeglich

**Schritt 5 — Go-Live**
- Zusammenfassung: "X Gerichte, Y Tische — alles bereit"
- "Restaurant aktivieren"-Button -> `active: true`
- Kurze Erfolgsanimation
- Weiterleitung zum Dashboard

### Technisch
- Eine Page-Komponente mit Step-State
- Daten werden bei jedem Schritt direkt in Supabase gespeichert
- Bei Abbruch und Rueckkehr: Start beim letzten unvollstaendigen Schritt

---

## 5. PWA (Personal-Dashboard)

### Scope
Nur Admin/Personal-Dashboard. Nicht die Gast-Bestellseite.

### Umsetzung
- `manifest.json`: App-Name, Icons, Theme-Color, `display: standalone`
- Service Worker: nur App-Shell-Caching (schnellerer Start), keine Offline-Logik
- Meta-Tags fuer iOS (`apple-mobile-web-app-capable`)
- "App installieren"-Hinweis im Dashboard beim ersten Mobile-Besuch

### Grenzen
- Keine Offline-Funktionalitaet (Realtime braucht Internet)
- Kein App Store (Browser-basierte Installation)
- Keine Push-Notifications im MVP (spaeteres Feature)

---

## 6. Bestehenden Code anpassen

### Gast-Payment entfernen
- `/api/stripe/table-checkout`, `/api/stripe/order-checkout`, `/api/stripe/group-checkout` entfernen
- `/app/bestellen/[slug]/GroupPayView.tsx` entfernen
- Bezahl-Buttons in der Gast-Bestellseite entfernen
- `/api/stripe/checkout` bleibt (SaaS-Abo)

### Statistiken -> Bestellanalyse
- `/admin/stats` anpassen: Bestellanzahl, Top-Gerichte, Stosszeiten, Tisch-Aktivitaet
- Keine Umsatzzahlen
- Starter: letzte 7 Tage, Pro: voller Zeitraum + Trendvergleich

### Datenbank-Aenderungen
- `restaurants` Tabelle: `trial_ends_at` (timestamp) hinzufuegen
- `plan`-Feld: `'trial'` und `'expired'` als neue Werte, `'basic'` wird zu `'starter'` migriert
- Bestehende Restaurants ohne `trial_ends_at`: bekommen `NULL` (kein Trial, bestandskunden)
- Neue Env-Vars: `STRIPE_PRICE_STARTER` (ersetzt `STRIPE_PRICE_BASIC`), `STRIPE_PRICE_PRO` bleibt

### Neue Dateien
- `lib/plan-limits.ts` — zentrale Plan-Limits
- `components/UpgradeHint.tsx` — Upgrade-Hinweis Komponente
- `public/manifest.json` — PWA Manifest
- Service Worker Datei
