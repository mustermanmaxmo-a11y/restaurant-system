-- Remove the V1/V2 design-version columns (V2 fully decommissioned).
-- Columns are unused after the code removal. CHECK constraints + column-level
-- grants drop automatically with the columns. No RLS policy references them.
-- Idempotent: DROP COLUMN IF EXISTS is a no-op on re-run.

ALTER TABLE public.platform_settings
  DROP COLUMN IF EXISTS platform_design_version,
  DROP COLUMN IF EXISTS restaurants_default_version;

ALTER TABLE public.restaurants
  DROP COLUMN IF EXISTS admin_design_version,
  DROP COLUMN IF EXISTS guest_design_version;
