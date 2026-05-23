-- Fix: trg_orders_marketing_link referenced wrong column names.
-- Real orders schema (from 20260327_001_schema.sql):
--   total numeric(10,2) NOT NULL  (NOT total_cents)
--   items jsonb NOT NULL          (no separate order_items table)
-- Previous trigger raised "column total_cents does not exist" on every INSERT.

BEGIN;

CREATE OR REPLACE FUNCTION fn_orders_marketing_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscriber_id uuid;
  v_total numeric(10,2);
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
      unsubscribed_at   = NULL
    RETURNING id INTO v_subscriber_id;

    UPDATE orders SET customer_id = v_subscriber_id WHERE id = NEW.id;
  END IF;

  -- 2. Always log placed_order event (subscriber_id NULL if anonymous)
  -- Real column is `total` (numeric), items are in `items jsonb` array
  v_total := NEW.total;
  BEGIN
    v_item_count := jsonb_array_length(NEW.items);
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
      'total', v_total,
      'item_count', v_item_count,
      'table_id', NEW.table_id,
      'order_type', NEW.order_type
    ),
    now()
  );

  RETURN NEW;
END;
$$;

COMMIT;
