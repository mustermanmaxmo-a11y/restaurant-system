# Track D — Datenfundament & Engine-Härtung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Datenfundament für die Marketing-Macht-Roadmap legen: `orders.customer_id` FK (opt-in only via DB-Trigger), generisches `marketing_events` Event-Log, Consent-Audit-Trail, Source-Attribution, Email-Send-Queue mit Retry.

**Architecture:** Schema-Änderungen in einer atomaren Migration `055_marketing_data_foundation.sql`. Linking + Event-Logging via PostgreSQL AFTER INSERT Trigger auf `orders` (kein Server-Endpoint-Refactor nötig). Email-Versand wird auf Queue + Cron-Retry umgestellt; bestehende Aufrufe enqueueen statt synchron senden (Ausnahme: User-getriebene Sends bleiben synchron).

**Tech Stack:** PostgreSQL/Supabase, Next.js 15 App Router, TypeScript, Resend, Vercel Cron, Sentry.

**Spec:** `docs/superpowers/specs/2026-05-23-track-d-datenfundament-design.md`

---

## File Structure

**Create:**
- `supabase/migrations/20260524_055_marketing_data_foundation.sql` — All schema changes, trigger, backfill, GRANTs
- `app/lib/marketing/events.ts` — `logEvent()` helper for non-order events (server-side, service_role)
- `app/lib/marketing/sendEmail.ts` — New queue-based send API (replaces direct Resend calls)
- `app/app/api/cron/marketing-retry/route.ts` — Worker that picks due queue entries, calls Resend, updates status

**Modify:**
- `app/app/order/[token]/_v1/OrderV1.tsx` — Add opt-in checkbox + `marketing_opt_in` field on insert
- `app/app/order/[token]/_v2/OrderV2.tsx` — Same
- `app/app/bestellen/[slug]/_v1/BestellenV1.tsx` — Same
- `app/app/bestellen/[slug]/_v2/BestellenV2.tsx` — Same
- `app/app/staff/StaffOrderPanel.tsx` — Optional checkbox (staff context — usually marketing_opt_in stays false)
- `app/vercel.json` — Add `/api/cron/marketing-retry` schedule
- `app/app/api/marketing/send/route.ts` — Switch to queue-based sendEmail
- `app/app/api/marketing/automation-run/route.ts` — Switch to queue
- `app/app/api/email/route.ts` — Switch to queue
- `app/app/api/crm/reengagement/route.ts` — Switch to queue

**No automated test framework exists in the repo** (no `test` script in `app/package.json`, no Vitest/Jest/Playwright deps). Verification uses **psql queries against the Supabase DB** and **curl against the Next.js dev server**. Each task includes explicit `Expected:` output for the verification commands.

---

## Task 1: Migration — Schema + Trigger + Backfill

**Files:**
- Create: `supabase/migrations/20260524_055_marketing_data_foundation.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260524_055_marketing_data_foundation.sql` with the full contents below:

```sql
-- Track D: Marketing Data Foundation
-- - orders.customer_id FK + marketing_opt_in
-- - marketing_events generic event log
-- - marketing_subscribers consent + source columns
-- - email_send_queue with retry
-- - AFTER INSERT trigger linking opt-in orders to subscribers + logging placed_order

BEGIN;

-- ===========================================================================
-- D1: orders FK + marketing_opt_in
-- ===========================================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES marketing_subscribers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false;

-- customer_email may already exist as runtime-set column without schema declaration; add if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='orders' AND column_name='customer_email'
  ) THEN
    ALTER TABLE orders ADD COLUMN customer_email text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id) WHERE customer_id IS NOT NULL;

-- ===========================================================================
-- D2: marketing_events
-- ===========================================================================

CREATE TABLE IF NOT EXISTS marketing_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  subscriber_id uuid REFERENCES marketing_subscribers(id) ON DELETE SET NULL,
  event_type    text NOT NULL,
  props         jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_events_restaurant_time
  ON marketing_events(restaurant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_events_subscriber
  ON marketing_events(subscriber_id, occurred_at DESC) WHERE subscriber_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_events_type
  ON marketing_events(restaurant_id, event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_events_props
  ON marketing_events USING GIN (props);

ALTER TABLE marketing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff sees own restaurant events" ON marketing_events;
CREATE POLICY "Staff sees own restaurant events" ON marketing_events
  FOR SELECT USING (
    restaurant_id IN (SELECT restaurant_id FROM staff_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Service role writes events" ON marketing_events;
CREATE POLICY "Service role writes events" ON marketing_events
  FOR INSERT WITH CHECK (true);

GRANT SELECT, INSERT ON marketing_events TO authenticated, service_role;
GRANT SELECT ON marketing_events TO anon;

-- ===========================================================================
-- D3: marketing_subscribers consent + source columns
-- ===========================================================================

ALTER TABLE marketing_subscribers
  ADD COLUMN IF NOT EXISTS consent_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS consent_version text DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS consent_source text,
  ADD COLUMN IF NOT EXISTS sms_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS push_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS push_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS acquisition_source text,
  ADD COLUMN IF NOT EXISTS referral_code text;

-- referral_code uniqueness only when non-null
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_subscribers_referral_code_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_subscribers_referral_code_unique
      ON marketing_subscribers(referral_code) WHERE referral_code IS NOT NULL;
  END IF;
END $$;

-- Backfill legacy consent_timestamp from opted_in_at
UPDATE marketing_subscribers
SET consent_timestamp = COALESCE(opted_in_at, created_at),
    consent_version = COALESCE(consent_version, 'v0-legacy'),
    consent_source = COALESCE(consent_source, source, 'unknown')
WHERE consent_timestamp IS NULL;

-- ===========================================================================
-- D4: email_send_queue
-- ===========================================================================

CREATE TABLE IF NOT EXISTS email_send_queue (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  from_email       text NOT NULL,
  from_name        text,
  to_email         text NOT NULL,
  to_subscriber_id uuid REFERENCES marketing_subscribers(id) ON DELETE SET NULL,
  reply_to         text,
  subject          text NOT NULL,
  html             text NOT NULL,
  campaign_id      uuid REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'pending',
  attempts         integer NOT NULL DEFAULT 0,
  next_retry_at    timestamptz NOT NULL DEFAULT now(),
  last_error       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  sent_at          timestamptz,
  CONSTRAINT email_send_queue_status_check CHECK (status IN ('pending','sending','sent','failed'))
);

CREATE INDEX IF NOT EXISTS idx_email_queue_due
  ON email_send_queue(next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_campaign
  ON email_send_queue(campaign_id) WHERE campaign_id IS NOT NULL;

ALTER TABLE email_send_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only queue" ON email_send_queue;
CREATE POLICY "Service role only queue" ON email_send_queue FOR ALL USING (false);

GRANT SELECT, INSERT, UPDATE ON email_send_queue TO service_role;

-- ===========================================================================
-- D6: AFTER INSERT trigger on orders
-- ===========================================================================

CREATE OR REPLACE FUNCTION fn_orders_marketing_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscriber_id uuid;
  v_total_cents integer;
  v_item_count integer;
BEGIN
  -- 1. Opt-in branch: upsert subscriber + set customer_id
  IF NEW.marketing_opt_in IS TRUE
     AND NEW.customer_email IS NOT NULL
     AND length(trim(NEW.customer_email)) > 0
  THEN
    INSERT INTO marketing_subscribers (
      restaurant_id, email, name, source,
      opted_in_at, consent_timestamp, consent_version, consent_source,
      acquisition_source
    )
    VALUES (
      NEW.restaurant_id,
      lower(trim(NEW.customer_email)),
      NEW.customer_name,
      'order',
      now(), now(), 'v1', 'order_checkout',
      CASE
        WHEN NEW.table_id IS NOT NULL THEN 'qr_table_' || NEW.table_id::text
        ELSE 'online_order'
      END
    )
    ON CONFLICT (restaurant_id, email)
    DO UPDATE SET
      opted_in_at       = COALESCE(marketing_subscribers.opted_in_at, EXCLUDED.opted_in_at),
      consent_timestamp = COALESCE(marketing_subscribers.consent_timestamp, EXCLUDED.consent_timestamp),
      consent_version   = COALESCE(marketing_subscribers.consent_version, EXCLUDED.consent_version),
      consent_source    = COALESCE(marketing_subscribers.consent_source, EXCLUDED.consent_source),
      unsubscribed_at   = NULL  -- re-opt-in clears prior unsubscribe
    RETURNING id INTO v_subscriber_id;

    -- Update the just-inserted order row with customer_id (separate UPDATE in trigger context)
    UPDATE orders SET customer_id = v_subscriber_id WHERE id = NEW.id;
  END IF;

  -- 2. Always log placed_order event (subscriber_id NULL if anonymous)
  -- Derive totals defensively (orders schema may vary)
  v_total_cents := COALESCE(NEW.total_cents, NULL);
  v_item_count  := NULL;
  BEGIN
    SELECT COUNT(*) INTO v_item_count FROM order_items WHERE order_id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    v_item_count := NULL;
  END;

  INSERT INTO marketing_events (restaurant_id, subscriber_id, event_type, props, occurred_at)
  VALUES (
    NEW.restaurant_id,
    v_subscriber_id,
    'placed_order',
    jsonb_build_object(
      'order_id', NEW.id,
      'total_cents', v_total_cents,
      'item_count', v_item_count,
      'table_id', NEW.table_id,
      'order_type', NEW.order_type
    ),
    now()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_marketing_link ON orders;
CREATE TRIGGER trg_orders_marketing_link
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_orders_marketing_link();

-- ===========================================================================
-- D5: Backfill customer_id for historical orders (idempotent)
-- ===========================================================================

UPDATE orders o
SET customer_id = s.id
FROM marketing_subscribers s
WHERE o.customer_id IS NULL
  AND o.customer_email IS NOT NULL
  AND lower(s.email) = lower(o.customer_email)
  AND s.restaurant_id = o.restaurant_id;

COMMIT;
```

- [ ] **Step 2: Lint the migration SQL syntax**

Run:
```bash
cd c:/Users/David/Desktop/restaurant-system
npx supabase db lint --file supabase/migrations/20260524_055_marketing_data_foundation.sql 2>&1 | tail
```

Expected: No syntax errors. If `supabase db lint` is not available, run a dry-run with `psql --set ON_ERROR_STOP=1 -f` against a local copy.

- [ ] **Step 3: Apply migration to local dev DB**

Run:
```bash
cd c:/Users/David/Desktop/restaurant-system
npx supabase db push 2>&1 | tail -20
```

Expected: `Linked project ...` then `Applying migration 20260524_055_marketing_data_foundation.sql...` ending with success. If the project is not linked locally, push to the staging/dev project per existing workflow.

- [ ] **Step 4: Verify schema landed**

Run via Supabase Studio SQL Editor or `psql`:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name IN ('customer_id','marketing_opt_in','customer_email')
ORDER BY column_name;

SELECT COUNT(*) AS event_table_exists
FROM information_schema.tables WHERE table_name='marketing_events';

SELECT COUNT(*) AS queue_table_exists
FROM information_schema.tables WHERE table_name='email_send_queue';

SELECT trigger_name FROM information_schema.triggers WHERE event_object_table='orders';
```

Expected:
- Three rows for orders columns (customer_id uuid YES, marketing_opt_in boolean NO, customer_email text YES)
- event_table_exists = 1
- queue_table_exists = 1
- trigger_name includes `trg_orders_marketing_link`

- [ ] **Step 5: Verify trigger fires correctly with opt-in**

Run:
```sql
-- Pick any restaurant_id from your dev DB:
WITH r AS (SELECT id FROM restaurants LIMIT 1)
INSERT INTO orders (restaurant_id, customer_name, customer_email, marketing_opt_in, status, order_type)
SELECT id, 'Test Trigger', 'trigger-test@example.com', true, 'new', 'dine_in' FROM r
RETURNING id, customer_id, customer_email, marketing_opt_in;
```

Then:
```sql
SELECT s.email, s.consent_source, s.consent_version, s.acquisition_source
FROM marketing_subscribers s WHERE s.email='trigger-test@example.com';

SELECT event_type, props->>'order_id' AS order_id, subscriber_id IS NOT NULL AS linked
FROM marketing_events ORDER BY occurred_at DESC LIMIT 1;
```

Expected:
- The returned order has `customer_id` set (not NULL)
- Subscriber row with `consent_source='order_checkout'`, `consent_version='v1'`
- marketing_events has `event_type='placed_order'` with `linked=true`

- [ ] **Step 6: Verify trigger logs event without subscriber when opt_in=false**

```sql
WITH r AS (SELECT id FROM restaurants LIMIT 1)
INSERT INTO orders (restaurant_id, customer_name, marketing_opt_in, status, order_type)
SELECT id, 'Anonymous Test', false, 'new', 'dine_in' FROM r
RETURNING id, customer_id;

SELECT event_type, subscriber_id FROM marketing_events
ORDER BY occurred_at DESC LIMIT 1;
```

Expected:
- Returned order has `customer_id IS NULL`
- New marketing_events row with `event_type='placed_order'`, `subscriber_id IS NULL`

- [ ] **Step 7: Clean up test rows**

```sql
DELETE FROM orders WHERE customer_email='trigger-test@example.com' OR customer_name IN ('Test Trigger','Anonymous Test');
DELETE FROM marketing_subscribers WHERE email='trigger-test@example.com';
```

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260524_055_marketing_data_foundation.sql
git commit -m "feat(db): marketing data foundation — orders↔subscriber linking via trigger, events log, send queue"
```

---

## Task 2: Add opt-in checkbox + payload field — OrderV1 (Tisch-App V1)

**Files:**
- Modify: `app/app/order/[token]/_v1/OrderV1.tsx`

- [ ] **Step 1: Locate the checkout form + order insert call**

Run:
```bash
grep -n "insert\|opt_in\|Marketing\|Newsletter" app/app/order/[token]/_v1/OrderV1.tsx | head -30
```

Expected: Lines showing the existing `orders.insert(...)` call. Note line numbers.

- [ ] **Step 2: Add opt-in state + checkbox**

Add a `marketingOptIn` boolean state in the component (near other form state). Add a checkbox in the checkout JSX right before the submit button:

```tsx
const [marketingOptIn, setMarketingOptIn] = useState(false);

// In JSX, before submit button:
<label className="flex items-start gap-2 text-xs text-gray-600 mt-3">
  <input
    type="checkbox"
    checked={marketingOptIn}
    onChange={(e) => setMarketingOptIn(e.target.checked)}
    className="mt-0.5"
  />
  <span>
    Ja, ich möchte gelegentlich Angebote und News per E-Mail erhalten (jederzeit abbestellbar).
  </span>
</label>
```

- [ ] **Step 3: Pass `marketing_opt_in` + `customer_email` into the insert**

In the `.from('orders').insert({...})` call, add fields:

```ts
.insert({
  // ...existing fields
  customer_email: customerEmail || null,
  marketing_opt_in: marketingOptIn,
})
```

If `customerEmail` is not yet collected in this component, add an optional email input field in the checkout form (only shown when opt-in is checked) — required to make opt-in meaningful.

- [ ] **Step 4: Manual verify in dev**

```bash
cd app && npm run dev
```

Open `http://localhost:3000/order/<a-valid-token>` in browser. Add item to cart, enter email, check the opt-in box, submit. Then SQL:

```sql
SELECT id, customer_email, marketing_opt_in, customer_id FROM orders ORDER BY created_at DESC LIMIT 1;
SELECT event_type, subscriber_id IS NOT NULL AS linked FROM marketing_events ORDER BY occurred_at DESC LIMIT 1;
```

Expected: order has `marketing_opt_in=true`, `customer_id` is set, marketing_events shows `placed_order` with `linked=true`.

- [ ] **Step 5: Commit**

```bash
git add app/app/order/[token]/_v1/OrderV1.tsx
git commit -m "feat(order): marketing opt-in checkbox + customer_email passthrough (V1 Tisch-App)"
```

---

## Task 3: Add opt-in checkbox + payload field — OrderV2 (Tisch-App V2)

**Files:**
- Modify: `app/app/order/[token]/_v2/OrderV2.tsx`

Repeat all 5 steps of Task 2 against the V2 component. The UI structure differs; place the checkbox in the V2 checkout sheet/dialog before the submit button, styled to match V2 design tokens.

- [ ] **Step 1: Locate insert call** — `grep -n "insert" app/app/order/[token]/_v2/OrderV2.tsx`
- [ ] **Step 2: Add `marketingOptIn` state + checkbox** (same logic as Task 2 Step 2, V2 styling)
- [ ] **Step 3: Pass `marketing_opt_in` + `customer_email` into insert**
- [ ] **Step 4: Manual verify** — repeat Task 2 Step 4 verification, this time using a V2 token
- [ ] **Step 5: Commit**
  ```bash
  git add app/app/order/[token]/_v2/OrderV2.tsx
  git commit -m "feat(order): marketing opt-in checkbox + customer_email passthrough (V2 Tisch-App)"
  ```

---

## Task 4: Add opt-in checkbox — BestellenV1 (Online-App V1)

**Files:**
- Modify: `app/app/bestellen/[slug]/_v1/BestellenV1.tsx`

Repeat the same 5 steps as Task 2 against the online-ordering V1 file. The customer_email field likely already exists here (delivery/pickup needs an email), so Step 3 may only need the `marketing_opt_in` addition.

- [ ] **Step 1: Locate insert call** — `grep -n "insert\|customer_email" app/app/bestellen/[slug]/_v1/BestellenV1.tsx`
- [ ] **Step 2: Add `marketingOptIn` state + checkbox**
- [ ] **Step 3: Add `marketing_opt_in: marketingOptIn` to insert payload** (customer_email already passed — verify)
- [ ] **Step 4: Manual verify via dev `/bestellen/<slug>` flow**
- [ ] **Step 5: Commit**
  ```bash
  git add app/app/bestellen/[slug]/_v1/BestellenV1.tsx
  git commit -m "feat(bestellen): marketing opt-in checkbox (V1 Online-App)"
  ```

---

## Task 5: Add opt-in checkbox — BestellenV2 (Online-App V2)

**Files:**
- Modify: `app/app/bestellen/[slug]/_v2/BestellenV2.tsx`

Same 5 steps as Task 4.

- [ ] **Step 1: Locate insert call**
- [ ] **Step 2: Add state + checkbox (V2 styled)**
- [ ] **Step 3: Add `marketing_opt_in` to insert payload**
- [ ] **Step 4: Manual verify**
- [ ] **Step 5: Commit**
  ```bash
  git add app/app/bestellen/[slug]/_v2/BestellenV2.tsx
  git commit -m "feat(bestellen): marketing opt-in checkbox (V2 Online-App)"
  ```

---

## Task 6: Staff-created orders default to opt_in=false

**Files:**
- Modify: `app/app/staff/StaffOrderPanel.tsx`

Staff creating orders on behalf of guests cannot collect a valid opt-in. The DB column already defaults to `false`, but we must NOT silently change that. Explicitly pass `marketing_opt_in: false` for clarity, and add a brief comment so the next reader doesn't add a checkbox here.

- [ ] **Step 1: Locate insert**
  ```bash
  grep -n "insert\|orders" app/app/staff/StaffOrderPanel.tsx | head -20
  ```

- [ ] **Step 2: Add explicit field**

In the `.from('orders').insert({...})` call:
```ts
.insert({
  // ...existing fields
  // Staff-created order: no valid customer opt-in possible, force false.
  marketing_opt_in: false,
})
```

- [ ] **Step 3: Commit**
  ```bash
  git add app/app/staff/StaffOrderPanel.tsx
  git commit -m "chore(staff): explicit marketing_opt_in=false on staff-created orders"
  ```

---

## Task 7: Events helper — `app/lib/marketing/events.ts`

**Files:**
- Create: `app/lib/marketing/events.ts`

This helper is for events the DB trigger cannot capture: client-side `viewed_menu`, `added_to_cart`, `opened_email`, etc. The helper is server-side (service_role) and called from API routes that already receive such telemetry.

- [ ] **Step 1: Create the helper**

Create `app/lib/marketing/events.ts`:

```ts
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export type MarketingEventType =
  | 'viewed_menu'
  | 'added_to_cart'
  | 'abandoned_cart'
  | 'opened_email'
  | 'clicked_email'
  | 'unsubscribed'
  | 'used_qr_code'
  | 'scanned_loyalty'
  | 'redeemed_reward'
  | 'signed_up'
  | 'verified_email'
  | 'gave_rating'
  | 'referred_friend';

export interface LogEventInput {
  restaurantId: string;
  eventType: MarketingEventType | (string & {});
  subscriberId?: string | null;
  props?: Record<string, unknown>;
  occurredAt?: Date;
}

export async function logEvent(input: LogEventInput): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from('marketing_events').insert({
    restaurant_id: input.restaurantId,
    subscriber_id: input.subscriberId ?? null,
    event_type: input.eventType,
    props: input.props ?? {},
    occurred_at: (input.occurredAt ?? new Date()).toISOString(),
  });
  if (error) {
    // Non-fatal: marketing telemetry failure must not break the calling request.
    console.warn('[marketing/events] logEvent failed:', error.message);
  }
}
```

- [ ] **Step 2: Verify import path resolves**

```bash
cd app && npx tsc --noEmit 2>&1 | grep "events.ts" || echo "OK no errors"
```

Expected: `OK no errors`.

- [ ] **Step 3: Smoke-test via a temporary script**

Create `app/scripts/test-log-event.ts`:
```ts
import { logEvent } from '@/lib/marketing/events';
(async () => {
  await logEvent({
    restaurantId: 'REPLACE_WITH_DEV_RESTAURANT_UUID',
    eventType: 'viewed_menu',
    props: { source: 'smoke-test' },
  });
  console.log('logged');
})();
```

Run: `cd app && npx tsx scripts/test-log-event.ts`. Expected: `logged`. Then SQL:
```sql
SELECT event_type, props FROM marketing_events ORDER BY occurred_at DESC LIMIT 1;
```
Expected: row with `event_type='viewed_menu'`, `props->>'source'='smoke-test'`.

Delete the script after verifying: `rm app/scripts/test-log-event.ts`.

- [ ] **Step 4: Commit**
  ```bash
  git add app/lib/marketing/events.ts
  git commit -m "feat(marketing): generic logEvent helper for marketing_events"
  ```

---

## Task 8: sendEmail refactor — queue-based API

**Files:**
- Create: `app/lib/marketing/sendEmail.ts`

- [ ] **Step 1: Inspect current Resend usage to preserve options**

```bash
grep -n "resend\.emails\.send" app/app/api/marketing/send/route.ts app/app/api/marketing/automation-run/route.ts app/app/api/email/route.ts app/app/api/crm/reengagement/route.ts
```

Note the fields used (`from`, `to`, `subject`, `html`, `reply_to`, `headers`).

- [ ] **Step 2: Create the queue-based API**

Create `app/lib/marketing/sendEmail.ts`:

```ts
import { Resend } from 'resend';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

export interface QueueEmailInput {
  restaurantId: string;
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  toSubscriberId?: string | null;
  replyTo?: string;
  subject: string;
  html: string;
  campaignId?: string | null;
}

export interface ImmediateEmailInput extends QueueEmailInput {
  /** Send synchronously, bypassing the queue. Use only for user-blocking flows (verification, order confirmation). */
  immediate: true;
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(input: QueueEmailInput | ImmediateEmailInput): Promise<{ queued: boolean; id?: string }> {
  if ((input as ImmediateEmailInput).immediate) {
    const result = await resend.emails.send({
      from: input.fromName ? `${input.fromName} <${input.fromEmail}>` : input.fromEmail,
      to: input.toEmail,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
    });
    if (result.error) throw new Error(result.error.message);
    return { queued: false, id: result.data?.id };
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('email_send_queue')
    .insert({
      restaurant_id: input.restaurantId,
      from_email: input.fromEmail,
      from_name: input.fromName ?? null,
      to_email: input.toEmail,
      to_subscriber_id: input.toSubscriberId ?? null,
      reply_to: input.replyTo ?? null,
      subject: input.subject,
      html: input.html,
      campaign_id: input.campaignId ?? null,
      status: 'pending',
      next_retry_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw new Error(`queue insert failed: ${error.message}`);
  return { queued: true, id: data?.id };
}
```

- [ ] **Step 3: Type-check**

```bash
cd app && npx tsc --noEmit 2>&1 | grep -E "sendEmail\.ts|error TS" | head
```
Expected: empty output or no errors mentioning `sendEmail.ts`.

- [ ] **Step 4: Smoke-test queue path**

Create `app/scripts/test-send-email.ts`:
```ts
import { sendEmail } from '@/lib/marketing/sendEmail';
(async () => {
  const r = await sendEmail({
    restaurantId: 'REPLACE_WITH_DEV_RESTAURANT_UUID',
    fromEmail: 'onboarding@resend.dev',
    toEmail: 'queue-test@example.com',
    subject: 'queue test',
    html: '<p>hi</p>',
  });
  console.log(r);
})();
```

Run: `cd app && npx tsx scripts/test-send-email.ts`. Expected: `{ queued: true, id: '<uuid>' }`. Then:
```sql
SELECT status, to_email, attempts FROM email_send_queue ORDER BY created_at DESC LIMIT 1;
```
Expected: `status='pending'`, `to_email='queue-test@example.com'`, `attempts=0`. Delete script.

- [ ] **Step 5: Commit**
  ```bash
  git add app/lib/marketing/sendEmail.ts
  git commit -m "feat(marketing): queue-based sendEmail API + immediate-mode fallback"
  ```

---

## Task 9: Retry cron worker

**Files:**
- Create: `app/app/api/cron/marketing-retry/route.ts`

- [ ] **Step 1: Check existing cron auth pattern**

```bash
cat app/app/api/cron/marketing-automations/route.ts | head -30
```

Note the bearer-token auth pattern (`Authorization: Bearer ${process.env.CRON_SECRET}`).

- [ ] **Step 2: Create the worker**

Create `app/app/api/cron/marketing-retry/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

const BACKOFF_SECONDS = [60, 300, 1500, 7500]; // 1m, 5m, 25m, 2h05
const MAX_ATTEMPTS = 4;
const BATCH_SIZE = 50;

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('unauthorized', { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const nowIso = new Date().toISOString();

  const { data: due, error: dueErr } = await supabase
    .from('email_send_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('next_retry_at', nowIso)
    .order('next_retry_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (dueErr) {
    return NextResponse.json({ error: dueErr.message }, { status: 500 });
  }
  if (!due || due.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let sent = 0;
  let failed = 0;
  let retried = 0;

  for (const row of due) {
    // Claim the row
    const { error: claimErr } = await supabase
      .from('email_send_queue')
      .update({ status: 'sending' })
      .eq('id', row.id)
      .eq('status', 'pending');
    if (claimErr) continue;

    try {
      const result = await resend.emails.send({
        from: row.from_name ? `${row.from_name} <${row.from_email}>` : row.from_email,
        to: row.to_email,
        subject: row.subject,
        html: row.html,
        replyTo: row.reply_to ?? undefined,
      });
      if (result.error) throw new Error(result.error.message);

      await supabase
        .from('email_send_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
        .eq('id', row.id);
      sent++;
    } catch (e) {
      const attempts = row.attempts + 1;
      const message = e instanceof Error ? e.message : String(e);

      if (attempts >= MAX_ATTEMPTS) {
        await supabase
          .from('email_send_queue')
          .update({ status: 'failed', attempts, last_error: message })
          .eq('id', row.id);
        failed++;
      } else {
        const delaySec = BACKOFF_SECONDS[attempts - 1] ?? BACKOFF_SECONDS[BACKOFF_SECONDS.length - 1];
        const nextRetry = new Date(Date.now() + delaySec * 1000).toISOString();
        await supabase
          .from('email_send_queue')
          .update({ status: 'pending', attempts, last_error: message, next_retry_at: nextRetry })
          .eq('id', row.id);
        retried++;
      }
    }
  }

  return NextResponse.json({ processed: due.length, sent, failed, retried });
}
```

- [ ] **Step 3: Type-check**

```bash
cd app && npx tsc --noEmit 2>&1 | grep -E "marketing-retry|error TS" | head
```
Expected: no errors.

- [ ] **Step 4: Local smoke-test**

```bash
cd app && npm run dev
# in another shell:
curl -sS -H "Authorization: Bearer $env:CRON_SECRET" http://localhost:3000/api/cron/marketing-retry
```
Expected: `{"processed":1,"sent":1,"failed":0,"retried":0}` if the test row from Task 8 Step 4 still exists in the queue with status=pending.

Verify:
```sql
SELECT status, attempts, last_error FROM email_send_queue ORDER BY created_at DESC LIMIT 1;
```
Expected: `status='sent'` (or `pending` with `attempts=1` if Resend rejected the invalid recipient).

- [ ] **Step 5: Negative test (retry path)**

Insert a row with invalid `from_email` (e.g. unverified domain) and run the cron again. Expected: row's `attempts=1`, `status='pending'`, `last_error` populated, `next_retry_at` ~60s in future.

- [ ] **Step 6: Commit**

```bash
git add app/app/api/cron/marketing-retry/route.ts
git commit -m "feat(cron): email send retry worker — exponential backoff, max 4 attempts"
```

---

## Task 10: Wire retry cron into Vercel schedule

**Files:**
- Modify: `app/vercel.json`

- [ ] **Step 1: Update vercel.json**

Replace the contents of `app/vercel.json` with:

```json
{
  "crons": [
    { "path": "/api/cron/marketing-automations", "schedule": "0 7 * * *" },
    { "path": "/api/cron/marketing-retry", "schedule": "*/5 * * * *" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add app/vercel.json
git commit -m "chore(vercel): schedule marketing-retry cron every 5 minutes"
```

---

## Task 11: Migrate existing send sites to queue

**Files:**
- Modify: `app/app/api/marketing/send/route.ts`
- Modify: `app/app/api/marketing/automation-run/route.ts`
- Modify: `app/app/api/email/route.ts`
- Modify: `app/app/api/crm/reengagement/route.ts`

For each file, replace direct `resend.emails.send({...})` calls with `sendEmail({...})` from `@/lib/marketing/sendEmail`. Order-confirmation emails and login-verification emails should pass `immediate: true`; campaign/automation/reengagement sends should NOT (use queue).

- [ ] **Step 1: Migrate `app/app/api/marketing/send/route.ts`**

This is the manual campaign send endpoint. Find the `resend.emails.send` call, replace with:

```ts
import { sendEmail } from '@/lib/marketing/sendEmail';

// inside the handler, where resend.emails.send was called:
const result = await sendEmail({
  restaurantId,
  fromEmail: fromAddress,        // existing variable
  fromName: restaurantName,       // existing variable
  toEmail: recipient.email,
  toSubscriberId: recipient.id,
  subject,
  html,
  campaignId,
});
```

Remove the now-unused `import { Resend } from 'resend'` and `new Resend(...)` lines if no remaining direct use.

- [ ] **Step 2: Migrate `app/app/api/marketing/automation-run/route.ts`**

Same pattern. Automations are non-blocking → queue, no `immediate`.

- [ ] **Step 3: Migrate `app/app/api/email/route.ts`**

This is the generic email endpoint. If it serves user-blocking flows (e.g. login verification), pass `immediate: true`. Otherwise queue.

Check the route's callers first:
```bash
grep -rn "/api/email" app/ | grep -v node_modules | head
```

If callers are user-blocking (auth, password reset), use `immediate: true`. Else queue.

- [ ] **Step 4: Migrate `app/app/api/crm/reengagement/route.ts`**

Reengagement is automation → queue.

- [ ] **Step 5: Type-check all changes together**

```bash
cd app && npx tsc --noEmit 2>&1 | grep "error TS" | head
```
Expected: empty or unrelated to these files.

- [ ] **Step 6: Manual smoke-test a campaign send through the queue**

Use the dashboard at `/admin/marketing/campaigns` to send a test campaign to one subscriber. Verify:
```sql
SELECT status, attempts FROM email_send_queue ORDER BY created_at DESC LIMIT 5;
```
Expected: row(s) with `status='pending'` initially, becoming `status='sent'` after the next cron run (or within ~5 minutes in deployed env).

- [ ] **Step 7: Commit per file (4 commits)**

```bash
git add app/app/api/marketing/send/route.ts
git commit -m "refactor(marketing/send): use queue-based sendEmail"

git add app/app/api/marketing/automation-run/route.ts
git commit -m "refactor(marketing/automation-run): use queue-based sendEmail"

git add app/app/api/email/route.ts
git commit -m "refactor(api/email): use sendEmail (immediate where user-blocking, queue otherwise)"

git add app/app/api/crm/reengagement/route.ts
git commit -m "refactor(crm/reengagement): use queue-based sendEmail"
```

---

## Task 12: End-to-end verification + sign-off

- [ ] **Step 1: Full migration verification**

```sql
-- All schema present
SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='customer_id';
SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='marketing_opt_in';
SELECT 1 FROM information_schema.tables  WHERE table_name='marketing_events';
SELECT 1 FROM information_schema.tables  WHERE table_name='email_send_queue';
SELECT 1 FROM information_schema.triggers WHERE trigger_name='trg_orders_marketing_link';

-- Consent backfilled for all legacy subscribers
SELECT COUNT(*) FROM marketing_subscribers WHERE consent_timestamp IS NULL;
```
Expected: First five queries return 1 row each. Last query returns 0.

- [ ] **Step 2: Trigger E2E happy path**

Use the live dev app: place an order via `/order/<token>` (V2) with email + opt-in checked. Verify:
```sql
SELECT o.id, o.customer_id, o.marketing_opt_in,
       s.email, s.consent_source,
       (SELECT count(*) FROM marketing_events WHERE props->>'order_id' = o.id::text) AS event_count
FROM orders o LEFT JOIN marketing_subscribers s ON s.id = o.customer_id
ORDER BY o.created_at DESC LIMIT 1;
```
Expected: `customer_id` not null, `s.email` matches what was entered, `consent_source='order_checkout'`, `event_count >= 1`.

- [ ] **Step 3: Trigger E2E anonymous path**

Place an order without opt-in. Expected: `customer_id IS NULL`, `marketing_opt_in=false`, but still one `placed_order` event row.

- [ ] **Step 4: Email queue E2E**

Send a test campaign from the dashboard. Wait ≤5 min for cron. Verify queue row went `pending → sent`. Check inbox for the actual email.

- [ ] **Step 5: Retry-failure E2E**

Insert a queue row with a bogus `from_email` (`bogus@nonexistent-domain.invalid`). Wait for 2 cron cycles. Expected: row's `attempts` increments, `status` remains `pending` until 4th attempt, then `failed`. Sentry should show 4 captured exceptions.

- [ ] **Step 6: RLS sanity check**

As an authenticated user from Restaurant A, attempt to read `marketing_events` from Restaurant B's UUID via Supabase JS client. Expected: 0 rows returned, no error.

- [ ] **Step 7: Document open follow-ups in roadmap memory**

Append to `~/.claude/projects/c--Users-David-Desktop-restaurant-system/memory/project_marketing_roadmap.md`: "Track D abgeschlossen am YYYY-MM-DD. Nächster Track: A (Killer-Features). Bekannte Folge-Aufgaben: …"

- [ ] **Step 8: Final commit + push**

```bash
git push origin main
```

---

## Open Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Trigger swallows insert errors silently | Trigger uses `SECURITY DEFINER` + only logs to `marketing_events`/upserts; any failure throws and rolls back the order insert (acceptable: order must succeed or fail atomically). If `marketing_events` insert fails (e.g. missing GRANT), the order insert fails too — caught in Task 1 Step 5 verification. |
| `orders.total_cents` column may not exist | Trigger uses `COALESCE(NEW.total_cents, NULL)` defensively. If the column is named differently (e.g. `total_amount`), the `props.total_cents` value will be NULL — fix by adjusting the trigger reference once the actual column name is confirmed in Task 1 Step 4. |
| `order_items` table reference may not exist | Trigger wraps the count in an `EXCEPTION WHEN OTHERS` block — `item_count` stays NULL if the table is absent. |
| Resend rate-limit hits when queue accumulates | `BATCH_SIZE = 50` per 5-min cron = max 600/hour. Resend free tier = 100/day, paid = 100/sec. Adjust BATCH_SIZE downward if needed. |
| Multiple cron instances claim same row | `UPDATE ... WHERE status='pending'` is atomic — second instance's claim returns 0 rows and skips. No double-send. |
| Backfill matches wrong subscriber (e.g. two restaurants share customer email) | Backfill query joins on `s.restaurant_id = o.restaurant_id` — scoped correctly. |
| `marketing_opt_in` checkbox missed in one of the 5 client files | Task 12 Step 2-3 E2E tests both opt-in and anonymous paths through real flows. |

---

## Done When
- All 12 tasks complete with green verification at each step
- `git log --oneline` shows ~15 atomic commits, all on `main`
- Memory entry `project_marketing_roadmap.md` updated with Track-D-completion date
- Roadmap status moves to Track A
