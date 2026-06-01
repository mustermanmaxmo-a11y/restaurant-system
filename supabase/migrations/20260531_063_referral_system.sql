-- Migration 063: A5 Referral System
-- restaurants: referral config columns
-- orders: referred_by_code attribution
-- referral_conversions: conversion tracking
-- fn_orders_marketing_link: auto-generate referral_code on subscriber upsert

-- ===========================================================================
-- 1. Restaurant referral config
-- ===========================================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS referral_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_reward_type text NOT NULL DEFAULT 'points'
    CHECK (referral_reward_type IN ('points', 'discount', 'both')),
  ADD COLUMN IF NOT EXISTS referral_reward_points int NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS referral_reward_discount_percent int NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS referral_referred_discount_percent int NOT NULL DEFAULT 10;

-- ===========================================================================
-- 2. Orders: track referral attribution
-- ===========================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS referred_by_code text;

-- ===========================================================================
-- 3. Referral conversions table
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.referral_conversions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  referrer_subscriber_id  uuid NOT NULL REFERENCES public.marketing_subscribers(id) ON DELETE CASCADE,
  referred_order_id       uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  reward_type             text NOT NULL,
  reward_discount_code_id uuid REFERENCES public.discount_codes(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_order_id)  -- one conversion per order, ensures idempotency
);

CREATE INDEX IF NOT EXISTS idx_referral_conversions_restaurant
  ON public.referral_conversions(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_conversions_referrer
  ON public.referral_conversions(referrer_subscriber_id);

ALTER TABLE public.referral_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY referral_conversions_owner_read ON public.referral_conversions
  FOR SELECT TO authenticated
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()));

GRANT SELECT, INSERT ON public.referral_conversions TO service_role;
GRANT SELECT ON public.referral_conversions TO authenticated;

-- ===========================================================================
-- 4. Update fn_orders_marketing_link — auto-generate referral_code
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
  v_referral_code text;
BEGIN
  -- 1. Opt-in branch: upsert subscriber + set customer_id
  IF NEW.marketing_opt_in IS TRUE
     AND NEW.customer_email IS NOT NULL
     AND length(trim(NEW.customer_email)) > 0
  THEN
    -- gen_random_uuid() statt gen_random_bytes: pgcrypto liegt in extensions schema,
    -- nicht in public — wäre mit SET search_path = public nicht erreichbar.
    v_referral_code := 'REF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

    INSERT INTO marketing_subscribers (
      restaurant_id, email, name, source,
      opted_in_at, consent_timestamp, consent_version, consent_source,
      acquisition_source, referral_code
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
      END,
      v_referral_code
    )
    ON CONFLICT (restaurant_id, email)
    DO UPDATE SET
      opted_in_at       = COALESCE(marketing_subscribers.opted_in_at, EXCLUDED.opted_in_at),
      consent_timestamp = COALESCE(marketing_subscribers.consent_timestamp, EXCLUDED.consent_timestamp),
      consent_version   = COALESCE(marketing_subscribers.consent_version, EXCLUDED.consent_version),
      consent_source    = COALESCE(marketing_subscribers.consent_source, EXCLUDED.consent_source),
      unsubscribed_at   = NULL,
      referral_code     = COALESCE(marketing_subscribers.referral_code, EXCLUDED.referral_code)
    RETURNING id INTO v_subscriber_id;

    -- Update the just-inserted order row with customer_id
    UPDATE orders SET customer_id = v_subscriber_id WHERE id = NEW.id;
  END IF;

  -- 2. Always log placed_order event (subscriber_id NULL if anonymous)
  v_total_cents := COALESCE(ROUND(NEW.total * 100)::integer, NULL);
  v_item_count  := COALESCE(jsonb_array_length(NEW.items), NULL);

  INSERT INTO marketing_events (restaurant_id, subscriber_id, event_type, props, occurred_at)
  VALUES (
    NEW.restaurant_id,
    v_subscriber_id,
    'placed_order',
    jsonb_build_object(
      'order_id',   NEW.id,
      'total_cents', v_total_cents,
      'item_count', v_item_count,
      'table_id',   NEW.table_id,
      'order_type', NEW.order_type
    ),
    now()
  );

  RETURN NEW;
END;
$$;

-- Trigger already exists from migration 055 — recreate to pick up new function body
DROP TRIGGER IF EXISTS trg_orders_marketing_link ON orders;
CREATE TRIGGER trg_orders_marketing_link
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_orders_marketing_link();

-- ===========================================================================
-- 5. RPC: credit_referral_points
-- Credits stamp_count or points to a loyalty_member when a referral converts.
-- Creates the member row if it doesn't exist yet.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.credit_referral_points(
  p_subscriber_id uuid,
  p_restaurant_id uuid,
  p_points int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mechanic text;
BEGIN
  SELECT mechanic INTO v_mechanic
  FROM loyalty_programs
  WHERE restaurant_id = p_restaurant_id
    AND enabled = true;

  IF v_mechanic IS NULL THEN
    RETURN; -- loyalty not enabled, skip silently
  END IF;

  INSERT INTO loyalty_members (restaurant_id, subscriber_id, stamp_count, points)
  VALUES (p_restaurant_id, p_subscriber_id,
          CASE WHEN v_mechanic = 'stamps' THEN p_points ELSE 0 END,
          CASE WHEN v_mechanic = 'points' THEN p_points ELSE 0 END)
  ON CONFLICT (subscriber_id, restaurant_id)
    WHERE subscriber_id IS NOT NULL
  DO UPDATE SET
    stamp_count = loyalty_members.stamp_count +
                  CASE WHEN v_mechanic = 'stamps' THEN p_points ELSE 0 END,
    points      = loyalty_members.points +
                  CASE WHEN v_mechanic = 'points' THEN p_points ELSE 0 END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_referral_points(uuid, uuid, int) TO service_role;
