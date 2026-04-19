-- 20260419_021_design_versions.sql
-- V2 Theme-System: Platform- und Restaurant-level design version preferences

-- ─────────────────────────────────────────────
-- 1. Tabelle: platform_settings (Singleton — genau eine Row)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id                            int PRIMARY KEY DEFAULT 1,
  platform_design_version       text NOT NULL DEFAULT 'v1'
    CHECK (platform_design_version IN ('v1', 'v2')),
  restaurants_default_version   text NOT NULL DEFAULT 'v1'
    CHECK (restaurants_default_version IN ('v1', 'v2')),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);

-- Genau eine Row seeden
INSERT INTO public.platform_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 2. Restaurants: optional Override für Admin- und Gast-Theme
-- ─────────────────────────────────────────────
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS admin_design_version text
    CHECK (admin_design_version IS NULL OR admin_design_version IN ('v1', 'v2')),
  ADD COLUMN IF NOT EXISTS guest_design_version text
    CHECK (guest_design_version IS NULL OR guest_design_version IN ('v1', 'v2'));

-- ─────────────────────────────────────────────
-- 3. RLS: platform_settings — nur Platform-Team lesend, nur Owner schreibend
-- ─────────────────────────────────────────────
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated users (restaurant owners need to see the default theme version)
-- platform_settings contains only non-sensitive design preferences, no PII
CREATE POLICY platform_settings_read
  ON public.platform_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY platform_settings_write_owner
  ON public.platform_settings
  FOR UPDATE
  USING (public.is_platform_owner());

-- Gast-Seiten (anonymer Zugriff) brauchen Lesezugriff auf restaurants.guest_design_version
-- Das ist bereits durch bestehende restaurants-Policies abgedeckt (public.restaurants SELECT)

COMMENT ON TABLE  public.platform_settings              IS 'Globale Platform-Konfiguration (Singleton, id=1)';
COMMENT ON COLUMN public.platform_settings.platform_design_version     IS 'Theme für /platform/* UI';
COMMENT ON COLUMN public.platform_settings.restaurants_default_version IS 'Default-Theme für alle Restaurants, wenn kein Override gesetzt';
COMMENT ON COLUMN public.restaurants.admin_design_version  IS 'NULL = Platform-Default verwenden, sonst v1 | v2';
COMMENT ON COLUMN public.restaurants.guest_design_version  IS 'NULL = Platform-Default verwenden, sonst v1 | v2';
