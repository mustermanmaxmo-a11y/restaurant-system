-- Migration 059: Rating-Email Automation
-- - orders.served_at + rating_email_sent_at
-- - restaurants.rating_email_enabled + rating_email_delay_hours
-- - BEFORE trigger to auto-set served_at on status transitions
-- - Index for stats queries

BEGIN;

-- 1) orders: served_at + dedup column
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS served_at timestamptz,
  ADD COLUMN IF NOT EXISTS rating_email_sent_at timestamptz;

-- 2) restaurants: per-restaurant config
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS rating_email_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rating_email_delay_hours int DEFAULT 4
    CHECK (rating_email_delay_hours BETWEEN 1 AND 72);

-- 3) BEFORE-Trigger: auto-set served_at when status transitions to 'served'
CREATE OR REPLACE FUNCTION public.set_served_at() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'served' AND OLD.status IS DISTINCT FROM 'served' THEN
    NEW.served_at := COALESCE(NEW.served_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_served_at ON public.orders;
CREATE TRIGGER trg_set_served_at
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_served_at();

-- 4) Index for stats queries (pending rating emails)
CREATE INDEX IF NOT EXISTS idx_orders_served_at_pending_rating
  ON public.orders (served_at)
  WHERE served_at IS NOT NULL AND rating_email_sent_at IS NULL;

-- 5) Backfill: existing served orders get served_at = created_at as best approximation
-- (so historical orders don't trigger Email when feature is enabled)
UPDATE public.orders
  SET served_at = created_at,
      rating_email_sent_at = created_at
  WHERE status = 'served' AND served_at IS NULL;

-- GRANTs (laut feedback_supabase_grants)
-- New columns inherit existing table grants — no extra GRANT needed for ALTERed tables.
-- Confirm: anon can SELECT restaurants (for client-side rating_email_delay lookup is not needed,
-- but rating_email_enabled stays anon-readable via existing restaurants SELECT grant)

COMMIT;
