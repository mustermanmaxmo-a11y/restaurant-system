# A4 — Multi-Step Win-Back Drip

**Datum:** 2026-05-30
**Track:** Marketing-Macht → Track A (In-Product Killer-Features)
**Abhängigkeiten:** A3 (generateDiscountCode, buildCampaignEmail, sendEmail), Track D (marketing_subscribers, email_send_queue)

---

## Ziel

Automatische mehrstufige Email-Serie die startet wenn ein Gast zu lange nicht bestellt hat. Betreiber konfiguriert beliebig viele Steps mit individuellen Texten, Zeitabständen und optionalen Rabatt-Codes. Drip stoppt automatisch sobald der Gast zurückkommt.

---

## Trigger & Stop-Bedingungen

**Start:** Subscriber hat `marketing_opt_in = true` UND `last_order_at` liegt mehr als `trigger_days` zurück UND ist noch nicht in einer aktiven Enrollment.

**Stop (automatisch):**
- Gast bestellt erneut → `stop_reason = 'ordered'`
- Gast löst Rabatt-Code ein → `stop_reason = 'code_redeemed'`
- Gast meldet sich ab → `stop_reason = 'unsubscribed'`
- Alle Steps abgeschlossen → `stop_reason = 'completed'`

**Stop (manuell):** Betreiber kann einzelne Enrollments im Dashboard stoppen → `stop_reason = 'manual'`

---

## Datenmodell

### `drip_sequences`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE
name            text NOT NULL DEFAULT 'Win-Back Drip'
trigger_days    int NOT NULL DEFAULT 14
enabled         boolean NOT NULL DEFAULT true
created_at      timestamptz NOT NULL DEFAULT now()
```

### `drip_steps`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
sequence_id     uuid NOT NULL REFERENCES drip_sequences(id) ON DELETE CASCADE
position        int NOT NULL            -- Reihenfolge: 1, 2, 3...
delay_days      int NOT NULL DEFAULT 7  -- Tage nach vorherigem Step (Step 1 = nach trigger_days)
subject         text NOT NULL
headline        text NOT NULL
body_text       text NOT NULL
discount_type   text CHECK (discount_type IN ('percent', 'fixed'))
discount_value  numeric
expires_days    int NOT NULL DEFAULT 7
```

### `drip_enrollments`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
sequence_id     uuid NOT NULL REFERENCES drip_sequences(id) ON DELETE CASCADE
subscriber_id   uuid NOT NULL REFERENCES marketing_subscribers(id) ON DELETE CASCADE
current_step    int NOT NULL DEFAULT 0  -- Index des nächsten zu sendenden Steps (0-basiert)
next_due_at     date NOT NULL
enrolled_at     timestamptz NOT NULL DEFAULT now()
completed_at    timestamptz
stop_reason     text CHECK (stop_reason IN ('ordered','code_redeemed','unsubscribed','manual','completed'))
UNIQUE (sequence_id, subscriber_id)     -- kein doppeltes Enrollment
```

---

## Cron-Job: `/api/cron/drip-trigger`

**Schedule:** Täglich 08:00 (`0 8 * * *` in vercel.json)

### Phase 1 — Neu enrollen

```
Für jede enabled drip_sequence:
  Lade alle marketing_subscribers des Restaurants:
    - marketing_opt_in = true
    - unsubscribed_at IS NULL
    - last_order_at IS NOT NULL
    - last_order_at <= NOW() - trigger_days * INTERVAL '1 day'
    - KEIN aktives Enrollment (completed_at IS NULL) für diese Sequenz
  → INSERT INTO drip_enrollments (sequence_id, subscriber_id, current_step=0, next_due_at=TODAY)
  → ON CONFLICT DO NOTHING
```

### Phase 2 — Fällige Steps versenden

```
Lade alle Enrollments:
  - completed_at IS NULL
  - next_due_at <= TODAY

Für jedes Enrollment:
  1. Lade drip_steps WHERE sequence_id = ? ORDER BY position
  2. Wenn current_step >= Anzahl Steps → completed_at setzen, stop_reason='completed', skip
  3. Lade Step[current_step]
  4. Prüfe Dedup: wurde dieser Step bereits gesendet? (via discount_codes.campaign_id = step.id)
  5. Falls Discount: generateDiscountCode('EVT') → INSERT discount_codes
  6. buildCampaignEmail() → sendEmail(immediate: true)
  7. UPDATE enrollment: current_step++, next_due_at = TODAY + next_step.delay_days
  8. Falls kein nächster Step: completed_at setzen, stop_reason='completed'
```

---

## Auto-Stop bei Bestellung

In `BestellenV1` und `BestellenV2`, nach erfolgreichem Order-Insert:

```typescript
// Non-blocking fire-and-forget
if (subscriber?.id) {
  fetch('/api/drip/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscriberId: subscriber.id, reason: 'ordered' }),
  }).catch(() => {})
}
```

**`/api/drip/stop` Route:**
```
POST { subscriberId, reason }
→ UPDATE drip_enrollments
  SET completed_at = NOW(), stop_reason = reason
  WHERE subscriber_id = subscriberId AND completed_at IS NULL
```

---

## Owner Dashboard: `/admin/marketing/drip`

### Layout

**Sequenz-Übersicht:**
- Name + trigger_days + enabled Toggle
- Steps-Liste mit Position + Delay + Betreff-Preview
- ↑↓ Buttons zum Umsortieren
- "+ Step hinzufügen" Button

**Step-Editor (Bottom-Sheet):**
- Delay (Tage nach vorherigem Step)
- Betreff, Headline, Body-Text
- Rabatt: Typ + Wert + Gültigkeitsdauer
- Löschen

**Stats-Karte (30 Tage):**
- Enrolled gesamt
- Emails versendet
- Zurückgewonnen (Enrollments mit stop_reason='ordered' oder 'code_redeemed')
- Rückgewinnungsrate (%)

**KI-Generator:** "✨ Mit KI generieren" → Betreiber beschreibt Ziel → `/api/ai/create-drip-sequence` → alle Steps auf einmal vorausgefüllt

### API-Routen

- `GET/POST/PATCH/DELETE /api/admin/drip/sequences` — CRUD für Sequenzen
- `GET/POST/PATCH/DELETE /api/admin/drip/steps` — CRUD für Steps
- `POST /api/admin/drip/enrollments/stop` — manueller Stop einzelner Enrollments

---

## KI-Generator: `/api/ai/create-drip-sequence`

Wie `/api/ai/create-campaign` aus A3 — nimmt eine natürlichsprachliche Beschreibung und gibt ein strukturiertes JSON-Objekt zurück:

```json
{
  "name": "Win-Back Drip",
  "trigger_days": 14,
  "steps": [
    { "position": 1, "delay_days": 0, "subject": "...", "headline": "...", "body_text": "...", "discount_type": null },
    { "position": 2, "delay_days": 7, "subject": "...", "headline": "...", "body_text": "...", "discount_type": "percent", "discount_value": 5 },
    { "position": 3, "delay_days": 7, "subject": "...", "headline": "...", "body_text": "...", "discount_type": "percent", "discount_value": 10 }
  ]
}
```

---

## Datenschutz (DSGVO)

- Nur Subscribers mit `marketing_opt_in = true` werden enrolled
- Jede Email enthält Abmelden-Link → setzt `unsubscribed_at` + stoppt Enrollment
- Enrollments werden bei Account-Delete mitgelöscht (CASCADE)

---

## Dateiübersicht

### Neu
- `supabase/migrations/20260530_062_drip_sequences.sql`
- `app/app/api/cron/drip-trigger/route.ts`
- `app/app/api/drip/stop/route.ts`
- `app/app/api/admin/drip/sequences/route.ts`
- `app/app/api/admin/drip/steps/route.ts`
- `app/app/api/ai/create-drip-sequence/route.ts`
- `app/app/admin/marketing/drip/page.tsx`

### Geändert
- `app/vercel.json` — Cron 08:00 für drip-trigger
- `app/app/bestellen/[slug]/_v2/BestellenV2.tsx` — drip/stop nach Order-Insert
- `app/app/bestellen/[slug]/_v1/BestellenV1.tsx` — idem
- `app/app/admin/marketing/layout.tsx` — "💧 Win-Back Drip" in Sidebar
