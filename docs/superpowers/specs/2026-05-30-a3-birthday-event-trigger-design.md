# A3 — Birthday + Event Trigger System

**Datum:** 2026-05-30
**Track:** Marketing-Macht → Track A (In-Product Killer-Features)
**Abhängigkeiten:** A2 (QStash-Pipeline, Resend, discount_codes), Track D (marketing_subscribers, email_send_queue)

---

## Ziel

Automatisierte, personalisierte Emails mit einmalig verwendbaren Gutschein-Codes — ausgelöst durch Geburtstage, Bestell-Jahrestage oder vom Betreiber erstellte Restaurant-Events. Jede Email enthält einen individuellen Code (nie denselben für mehrere Empfänger), sichtbar im Lieferando-Stil + Magic-Link Button.

---

## Zwei Trigger-Typen

### Typ 1 — Persönliche Trigger (pro Subscriber, täglich automatisch)
- **🎂 Geburtstag** — `marketing_subscribers.birthday` = heute (Tag + Monat, kein Jahr-Vergleich)
- **🗓 Erster-Bestellungs-Jahrestag** — früheste `orders.created_at` des Subscribers liegt genau 1 Jahr zurück

Beide laufen über einen täglichen Cron-Job (07:00 Uhr morgens).

### Typ 2 — Restaurant-Events (an alle Subscriber, vom Betreiber erstellt)
- Beliebige Anlässe: "50-jähriges Bestehen", "Sommer-Aktion", "Neues Menü"
- Betreiber legt Datum + Inhalt fest — manuell im Dashboard oder per KI-Chat
- Am konfigurierten `send_date` um 09:00 Uhr versendet der Cron-Job an alle Subscriber des Restaurants

---

## Datenmodell

### Neue Tabelle: `discount_codes`

```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE
subscriber_id   uuid REFERENCES marketing_subscribers(id) ON DELETE SET NULL
campaign_id     uuid REFERENCES campaigns(id) ON DELETE SET NULL
code            text NOT NULL UNIQUE  -- z.B. "BDAY-X7K2M9"
discount_type   text NOT NULL CHECK (discount_type IN ('percent', 'fixed'))
discount_value  numeric NOT NULL      -- 10 = 10% oder 10.00€
expires_at      timestamptz NOT NULL
used_at         timestamptz           -- null = noch gültig
used_order_id   uuid REFERENCES orders(id) ON DELETE SET NULL
created_at      timestamptz NOT NULL DEFAULT now()
```

### Neue Tabelle: `campaigns`

```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE
trigger_type    text NOT NULL CHECK (trigger_type IN ('birthday', 'first_order_anniversary', 'custom_event'))
send_date       date                  -- nur für custom_event
subject         text NOT NULL         -- Email-Betreff
headline        text NOT NULL         -- z.B. "Alles Gute zum Geburtstag 🎂"
body_text       text NOT NULL         -- individueller Fließtext
discount_type   text CHECK (discount_type IN ('percent', 'fixed'))
discount_value  numeric               -- null = kein Rabatt
expires_days    int NOT NULL DEFAULT 7
enabled         boolean NOT NULL DEFAULT true
created_at      timestamptz NOT NULL DEFAULT now()
sent_at         timestamptz           -- für custom_event: wann versendet
```

### Änderung: `orders` (Checkout-Integration)

```sql
ALTER TABLE orders ADD COLUMN discount_code text;
ALTER TABLE orders ADD COLUMN discount_amount_cents int;
```

---

## Code-Generierung

- Format: `BDAY-XXXXXXXX` (Birthday), `ANNI-XXXXXXXX` (Anniversary), `EVT-XXXXXXXX` (Custom Event)
- 8 zufällige Großbuchstaben + Zahlen (crypto.randomBytes basiert)
- Eindeutigkeit per DB UNIQUE Constraint garantiert
- Pro Subscriber + Campaign genau ein Code — dedupeId verhindert Doppelversand

---

## Email-Template (Lieferando-Stil)

```
[Restaurant Logo]
━━━━━━━━━━━━━━━━━━━━━
[Headline: "Alles Gute, Max! 🎂"]
[Subtext: individueller body_text]
[Restaurant Food-Foto (falls vorhanden)]
━━━━━━━━━━━━━━━━━━━━━
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
   BDAY-X7K2M9
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
*Gültig bis 05.06.2026*
[Button: "Jetzt einlösen →"]
━━━━━━━━━━━━━━━━━━━━━
[Abmelden-Link]
```

Button-URL: `https://getorderiq.de/bestellen/[slug]?code=BDAY-X7K2M9`

---

## Checkout-Integration

1. Bestellseite liest `?code=` URL-Parameter beim Load
2. Zeigt Banner: "🎉 Geburtstags-Rabatt aktiv: 10% Rabatt"
3. Validierung beim Submit (Server-side API Route):
   - Code existiert in `discount_codes`
   - `used_at IS NULL`
   - `expires_at > now()`
   - `restaurant_id` stimmt überein
4. Bei Erfolg: Rabatt auf `total` anwenden, `discount_code` + `discount_amount_cents` in `orders` schreiben
5. Nach Order-Erstellung: `discount_codes.used_at` + `used_order_id` setzen (atomisch)
6. Gast kann Code auch manuell ins Checkout-Formular eingeben (optionales Code-Feld)

---

## Cron-Job: `/api/cron/birthday-trigger`

Täglich 07:00 Uhr via `vercel.json` Cron.

**Ablauf:**
```
1. Lade alle Restaurants mit aktivem birthday-Campaign
2. Für jedes Restaurant:
   a. Subscriber mit birthday = heute (Monat + Tag) → Birthday-Email
   b. Subscriber deren erste Order genau 365 Tage her ist → Anniversary-Email
3. Lade alle custom_event Campaigns mit send_date = heute + sent_at IS NULL
4. Für jede: alle Subscriber des Restaurants → Event-Email
5. Pro Subscriber + Campaign: prüfe ob bereits Code existiert (dedup)
6. Code generieren → in discount_codes speichern → Email via sendEmail()
7. campaign.sent_at setzen (für custom_event)
```

Skip-Conditions (analog A2):
- Subscriber hat `unsubscribed_at IS NOT NULL` → skip
- Code für diese Subscriber+Campaign Kombination existiert bereits → skip
- Kein `campaign.enabled` → skip

---

## KI-Chat Integration

Betreiber schreibt im Admin-Chat z.B.:
> "Erstelle eine Kampagne für unser 50-jähriges Bestehen am 15. Juli mit 15% Rabatt"

KI antwortet mit Preview:
```json
{
  "trigger_type": "custom_event",
  "send_date": "2026-07-15",
  "subject": "🎉 Wir feiern 50 Jahre – dein Geschenk wartet!",
  "headline": "50 Jahre Leidenschaft für gutes Essen",
  "body_text": "Wir feiern unser goldenes Jubiläum...",
  "discount_type": "percent",
  "discount_value": 15,
  "expires_days": 7
}
```

Betreiber sagt "Bestätigen" → KI ruft `/api/admin/campaigns` auf → Campaign wird angelegt.

KI-Chat nutzt das bestehende `AdminChatWidget` — neues Tool `create_campaign` wird dem System-Prompt hinzugefügt.

---

## Owner-Dashboard: `/admin/marketing/birthday`

### Abschnitt 1 — Persönliche Trigger
- Toggle: Geburtstags-Emails aktiv
- Discount-Typ (% / €) + Wert
- Gültigkeitsdauer (Tage)
- Vorschau der Email

- Toggle: Jahrestags-Emails aktiv
- Eigene Einstellungen (Discount, Gültigkeit)

### Abschnitt 2 — Restaurant-Events
- "+ Neue Kampagne" Button (öffnet Formular oder KI-Chat)
- Tabelle: alle Campaigns (Datum, Headline, Status: geplant/gesendet, Empfänger-Anzahl)

### Abschnitt 3 — Stats
- Codes verschickt (30 Tage)
- Codes eingelöst + Einlösungsrate
- Umsatz durch Kampagnen (sum `discount_amount_cents` auf eingelösten Orders)

---

## Datenschutz (DSGVO)

- Geburtsdatum ist freiwillig — explizite Info beim Eingabe-Feld: "Für deinen Geburtstags-Rabatt"
- Wird in `marketing_subscribers.birthday` gespeichert (bereits DSGVO-konform via Opt-In)
- Nutzer kann Geburtstag im Profil-Tab jederzeit löschen
- Beim Account-Delete (`/api/profile/delete`) wird `birthday` mitgelöscht
- Kein Jahrgang gespeichert — nur Monat + Tag (kein Alter ableitbar)

---

## Dateiübersicht

### Neue Dateien
- `supabase/migrations/20260530_061_campaigns_and_discount_codes.sql`
- `app/lib/marketing/generateDiscountCode.ts`
- `app/lib/marketing/birthdayEmail.ts`
- `app/app/api/cron/birthday-trigger/route.ts`
- `app/app/api/admin/campaigns/route.ts`
- `app/app/api/checkout/validate-code/route.ts`
- `app/app/admin/marketing/birthday/page.tsx`

### Geänderte Dateien
- `app/components/bestellen/LoyaltyWidget.tsx` — Geburtsdatum-Feld im Profil-Tab + Registrierungs-Formular
- `app/app/bestellen/[slug]/_v2/BestellenV2.tsx` — Code-Feld im Checkout + `?code=` URL-Param
- `app/app/bestellen/[slug]/_v1/BestellenV1.tsx` — idem
- `vercel.json` — neuer Cron-Eintrag 07:00 täglich
- `app/lib/marketing-system-prompt.ts` — `create_campaign` Tool für KI-Chat
