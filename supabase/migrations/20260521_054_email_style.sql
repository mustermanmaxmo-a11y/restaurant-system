-- Brand-synced email styles: pro Template wählbar, per Restaurant Override
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS style text;
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS uses_style boolean NOT NULL DEFAULT true;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS email_style_override text;

-- Explicit grants (siehe feedback_supabase_grants memory)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates
  TO authenticated, service_role;
GRANT SELECT ON public.email_templates
  TO anon;
