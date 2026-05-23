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

DROP POLICY IF EXISTS "owner_read_events" ON marketing_events;
CREATE POLICY "owner_read_events" ON marketing_events
  FOR SELECT USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
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

-- Backfill legacy consent_timestamp from opted_in_at (opted_in_at has DEFAULT now() so it's always set)
UPDATE marketing_subscribers
SET consent_timestamp = COALESCE(opted_in_at, now()),
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
    RAISE NOTICE 'orders.customer_email not found - skipping email-based backfill';
  END IF;
END $$;

COMMIT;
