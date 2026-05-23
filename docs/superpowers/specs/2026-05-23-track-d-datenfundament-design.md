# Track D — Datenfundament & Engine-Härtung (Design Spec)

**Status:** Approved, ready for implementation plan
**Datum:** 2026-05-23
**Roadmap-Kontext:** Phase 1 von 4 in der "Marketing-Macht" Roadmap (`~/.claude/plans/wir-wollen-ja-aus-replicated-trinket.md`)

## Context

Die Bestandsaufnahme hat drei Foundation-Lücken im Marketing-Stack aufgedeckt:

1. **`orders` und `marketing_subscribers` sind nicht relational verbunden** — Verknüpfung läuft heute über Laufzeit-Matching von `customer_name`/`customer_email`. Das blockiert RFM-Scoring, exakte LTV-Berechnung und präzise Win-Back-Sequenzen (Track A4).
2. **Keine Event-Log-Infrastruktur** — Nur Order-Status-Änderungen werden persistiert. Mikro-Verhalten (Menü-Ansicht, Cart-Abandonment, Email-Open) ist unsichtbar. Track A (Loyalty, Win-Back, Reviews) braucht solche Trigger.
3. **Email-Send ist Fire-and-Forget** — Bei Resend-Outage oder Rate-Limit gehen Mails still verloren. Kein Retry, kein Alert, keine Sichtbarkeit.

Track D legt das Fundament für alle späteren Tracks. Migration jetzt = einmal. Migration später = mehrfach + Production-Risiko.

## Design Decisions (vom User bestätigt)

| Entscheidung | Wahl | Begründung |
|---|---|---|
| Linking-Strategie | **Opt-in only** | DSGVO-sicher; `marketing_subscribers` nur bei expliziter Einwilligung |
| Event-Schema | **Generic Event Log** (`event_type` + `props jsonb`) | Flexibel für neue Events ohne Migration |
| Retry-Queue | **Supabase-Tabelle + Vercel-Cron** | Einfach, auditierbar, kein neuer Stack |
| Backfill-Scope | **Nur bestehende Subscriber matchen** | Konsistent mit Opt-in-Policy |

## Schema-Änderungen

Datei: `supabase/migrations/20260524_048_marketing_data_foundation.sql`

### D1. `orders.customer_id` FK

```sql
ALTER TABLE orders
  ADD COLUMN customer_id uuid REFERENCES marketing_subscribers(id) ON DELETE SET NULL;
CREATE INDEX idx_orders_customer_id ON orders(customer_id) WHERE customer_id IS NOT NULL;
```

- **Nullable** — anonyme Tisch-Bestellungen ohne Opt-in bleiben weiterhin gültig
- **ON DELETE SET NULL** — Subscriber-Löschung (DSGVO Recht auf Vergessen) macht Bestellungen nicht kaputt
- **Partial Index** — spart Index-Space für die vielen NULL-Rows

### D2. `marketing_events` Tabelle

```sql
CREATE TABLE marketing_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  subscriber_id uuid REFERENCES marketing_subscribers(id) ON DELETE SET NULL,
  event_type    text NOT NULL,        -- viewed_menu, added_to_cart, abandoned_cart, opened_email, clicked_email, used_qr, redeemed_loyalty, referred_friend
  props         jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_events_restaurant_time ON marketing_events(restaurant_id, occurred_at DESC);
CREATE INDEX idx_marketing_events_subscriber ON marketing_events(subscriber_id, occurred_at DESC) WHERE subscriber_id IS NOT NULL;
CREATE INDEX idx_marketing_events_type ON marketing_events(restaurant_id, event_type, occurred_at DESC);
CREATE INDEX idx_marketing_events_props ON marketing_events USING GIN (props);

-- RLS: nur Restaurant-Owner/Staff sehen eigene Events
ALTER TABLE marketing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff sees own restaurant events" ON marketing_events
  FOR SELECT USING (restaurant_id IN (SELECT restaurant_id FROM staff_members WHERE user_id = auth.uid()));
CREATE POLICY "Service role writes events" ON marketing_events
  FOR INSERT WITH CHECK (true);  -- Writes via service_role only

-- GRANTs (Pflicht, siehe project_supabase_grants)
GRANT SELECT, INSERT ON marketing_events TO authenticated, service_role;
GRANT SELECT ON marketing_events TO anon;  -- für Tracking-Pixel auf anonymen Surfaces
```

**Erlaubte event_type-Werte** (Convention, nicht hart enforced — bewusst, damit neue Events ohne Migration eingeführt werden können):
- `viewed_menu` `added_to_cart` `abandoned_cart` `placed_order` `cancelled_order`
- `opened_email` `clicked_email` `unsubscribed`
- `used_qr_code` `scanned_loyalty` `redeemed_reward`
- `signed_up` `verified_email` `gave_rating`

### D3. `marketing_subscribers` neue Spalten

```sql
ALTER TABLE marketing_subscribers
  ADD COLUMN consent_timestamp timestamptz,
  ADD COLUMN consent_version text DEFAULT 'v1',
  ADD COLUMN consent_source text,             -- 'order_checkout' | 'reservation' | 'qr_signup' | 'manual_import' | 'referral'
  ADD COLUMN sms_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN sms_consent_at timestamptz,
  ADD COLUMN push_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN push_consent_at timestamptz,
  ADD COLUMN acquisition_source text,         -- z.B. 'qr_table_5', 'online_order', 'referral_abc123'
  ADD COLUMN referral_code text UNIQUE;       -- für Track A5 vorbereitet

CREATE INDEX idx_subscribers_referral_code ON marketing_subscribers(referral_code) WHERE referral_code IS NOT NULL;

-- Backfill: bestehende Subscriber bekommen consent_timestamp = opted_in_at
UPDATE marketing_subscribers
SET consent_timestamp = opted_in_at,
    consent_version = 'v0-legacy',
    consent_source = COALESCE(source, 'unknown')
WHERE consent_timestamp IS NULL;
```

### D4. `email_send_queue` Tabelle

```sql
CREATE TABLE email_send_queue (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  from_email       text NOT NULL,    -- vom Restaurant abgeleitet oder RESEND_FROM Default
  from_name        text,             -- optional Anzeigename (Restaurant-Name)
  to_email         text NOT NULL,
  to_subscriber_id uuid REFERENCES marketing_subscribers(id) ON DELETE SET NULL,
  reply_to         text,
  subject          text NOT NULL,
  html             text NOT NULL,
  campaign_id      uuid REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'pending',  -- pending | sending | sent | failed
  attempts         integer NOT NULL DEFAULT 0,
  next_retry_at    timestamptz NOT NULL DEFAULT now(),
  last_error       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  sent_at          timestamptz,
  CONSTRAINT email_send_queue_status_check CHECK (status IN ('pending','sending','sent','failed'))
);

CREATE INDEX idx_email_queue_due ON email_send_queue(next_retry_at) WHERE status = 'pending';
CREATE INDEX idx_email_queue_campaign ON email_send_queue(campaign_id) WHERE campaign_id IS NOT NULL;

ALTER TABLE email_send_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON email_send_queue FOR ALL USING (false);
GRANT SELECT, INSERT, UPDATE ON email_send_queue TO service_role;
```

**Retry-Logik** (in `app/lib/marketing/sendEmail.ts`):
- Bei Send: schreibe in Queue mit `status='pending', next_retry_at=now()`
- Worker (Cron): pickt due Einträge, setzt `status='sending'`, ruft Resend
- Bei Erfolg: `status='sent', sent_at=now()`
- Bei Fehler: `attempts++`, Backoff `next_retry_at = now() + (60 * 5^attempts) seconds` (1m → 5m → 25m → 2h05)
- Bei `attempts >= 4`: `status='failed'`, Sentry-Alert

### D5. `orders.customer_id` Backfill

**Voraussetzung (in Migration prüfen):** Existiert `orders.customer_email`? Laut Audit unklar — möglicherweise nur via API gesetzt, aber nicht in Schema deklariert. Migration prüft mit `information_schema`:

```sql
DO $$
DECLARE has_email boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='orders' AND column_name='customer_email'
  ) INTO has_email;

  IF has_email THEN
    UPDATE orders o
    SET customer_id = s.id
    FROM marketing_subscribers s
    WHERE o.customer_id IS NULL
      AND o.customer_email IS NOT NULL
      AND lower(s.email) = lower(o.customer_email)
      AND s.restaurant_id = o.restaurant_id;
  ELSE
    -- Fallback: Match per customer_phone wenn vorhanden + Subscriber Phone gepflegt
    -- TODO: Phone-Spalte auf marketing_subscribers existiert noch nicht — siehe Out-of-Scope.
    -- Wenn weder Email noch Phone matchbar: kein Backfill, alle bleiben NULL.
    RAISE NOTICE 'orders.customer_email not found — skipping email-based backfill';
  END IF;
END $$;
```

**Wichtig:** Wenn Backfill nicht greift, sammelt sich der Link automatisch über neue Bestellungen ab Migration. Das ist akzeptabel; LTV/RFM-Reports werden nur Daten ab Migrationsdatum nutzen.

## Application-Code-Änderungen

### Subscriber-Match beim Order-Insert
Datei: `app/app/api/orders/route.ts`

Heute: Insert legt nur Order an. Neu:
1. Order-Insert wie bisher
2. **Nur wenn `marketing_opt_in === true` im Order-Payload**: Subscriber upserten (per email/restaurant_id), `consent_timestamp` setzen, `acquisition_source` ableiten (`qr_table_<n>` oder `online_order`), Order's `customer_id` setzen
3. `marketing_events` Insert mit `event_type='placed_order'`, `props={ order_id, total_cents, item_count }`

### Event-Logging-Helper
Datei: `app/lib/marketing/events.ts` (neu)
- Export `logEvent({ restaurantId, subscriberId?, eventType, props? })` — server-side, service_role client
- Call-Sites in V1+V2 beider Guest-Apps: bei Menü-Aufruf, Cart-Add, Order-Submit

### Retry-Worker
Datei: `app/app/api/cron/marketing-retry/route.ts` (neu)
- Bearer-Auth wie bestehende Crons
- Pickt max 50 due Einträge, Loop mit Resend-Aufruf, Status-Update
- Schedule in `vercel.json`: alle 5 Minuten

### sendEmail-Refactor
Datei: `app/lib/marketing/sendEmail.ts` (neu/erweitern)
- Public API bleibt `sendEmail({...})`, schreibt aber jetzt in Queue
- Optional `immediate: true` Flag für synchrone Sends (z.B. Login-Verifikation, Order-Confirmation), umgeht Queue

## DSGVO-Hardening
- Migration `20260520_xxx_gdpr_delete_subscriber.sql` (separate Task, hier nur referenziert) sollte `email_send_queue` und `marketing_events` in Delete-Cascade aufnehmen
- `consent_timestamp` als Audit-Trail bei Datenschutzanfragen verwendbar
- Default `consent_version='v1'` — wenn AGB/Privacy-Text später geändert, Subscriber müssen re-opted werden (Track Z, später)

## Out of Scope (bewusst nicht in D)
- A/B-Testing-Infrastruktur — gehört zu Track A6 oder Track B
- SMS/Push-**Versand** — nur die Consent-Spalten, keine Sende-Logik (Track A)
- CRM-Sync (Hubspot/Klaviyo) — nicht geplant
- Externe Job-Queue (Upstash QStash, BullMQ) — bewusst Supabase-only zum Start

## Verifikation
- **Migration läuft sauber**: `supabase db reset` + `supabase db push` ohne Fehler, alle GRANTs vorhanden
- **Backfill korrekt**: `SELECT COUNT(*) FROM orders WHERE customer_id IS NOT NULL` > 0 nach Backfill, alle gelinkten Orders haben passenden Subscriber-Email
- **Event-Logging E2E**: Test-Bestellung mit Opt-in → `marketing_events` hat `placed_order` Eintrag mit korrekter `subscriber_id`; Test-Bestellung ohne Opt-in → Event existiert mit `subscriber_id=NULL`
- **Retry-Test**: Resend-Key temporär ungültig setzen → Email landet in Queue, nach Cron-Lauf wird sie retried, nach 4 Fehlern als `failed` markiert + Sentry-Event
- **Consent-Audit**: `SELECT consent_timestamp, consent_source FROM marketing_subscribers WHERE consent_timestamp IS NULL` → 0 rows nach Backfill
- **RLS-Test**: User von Restaurant A versucht `marketing_events` von Restaurant B zu lesen → 0 rows

## Aufwand
- Migration + Backfill: 0.5 Tag
- Application-Code-Refactor (orders, sendEmail, events.ts): 1.5 Tage
- Retry-Cron + Tests: 1 Tag
- E2E-Verifikation + Rollback-Plan: 0.5 Tag
- **Total: ~3.5 Tage**

## Nächster Schritt
Implementierungs-Plan via `superpowers:writing-plans` Skill — übersetzt dieses Spec in eine TDD-Step-by-Step-Checkliste.
