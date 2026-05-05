-- Feature #14: White-Label für Agenturen

CREATE TABLE IF NOT EXISTS public.agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  wholesale_price_cents int DEFAULT 2500,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agency_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE UNIQUE,
  logo_url text,
  primary_color text DEFAULT '#EA580C',
  accent_color text DEFAULT '#F5F5F7',
  domain text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id);

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency_owner" ON public.agencies
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "agency_owner_branding" ON public.agency_branding
  FOR ALL USING (
    agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid())
  );

-- Public read for branding (guests need to fetch it)
CREATE POLICY "public_branding_read" ON public.agency_branding
  FOR SELECT USING (true);

CREATE POLICY "public_agencies_read" ON public.agencies
  FOR SELECT USING (true);
