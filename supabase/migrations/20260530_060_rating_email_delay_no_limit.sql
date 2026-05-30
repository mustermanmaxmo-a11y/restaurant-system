-- Migration 060: Remove rating_email_delay_hours constraint
-- Restaurant owners can now set any delay (no min/max restriction)
ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_rating_email_delay_hours_check;

ALTER TABLE public.restaurants
  ALTER COLUMN rating_email_delay_hours SET DEFAULT 4;
