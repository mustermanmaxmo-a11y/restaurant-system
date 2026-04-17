-- Platform Team: Rollen & Rechte für das interne Team (nicht Restaurant-Staff)
-- Rollen: co_founder, developer, billing, support
-- Support kann nur auf zugewiesene Restaurants zugreifen
-- Co-Founder muss Rechtstext-Änderungen vom Owner genehmigen lassen

-- ─────────────────────────────────────────────
-- 1. Tabelle: platform_team
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_team (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('co_founder', 'developer', 'billing', 'support')),
  invited_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- ─────────────────────────────────────────────
-- 2. Tabelle: platform_team_restaurants
--    Welcher Support-User darf welches Restaurant bearbeiten
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_team_restaurants (
  team_member_id uuid NOT NULL REFERENCES public.platform_team(id) ON DELETE CASCADE,
  restaurant_id  uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  PRIMARY KEY (team_member_id, restaurant_id)
);

-- ─────────────────────────────────────────────
-- 3. Legal-Dokumente: Draft-Spalten für Co-Founder-Workflow
-- ─────────────────────────────────────────────
ALTER TABLE public.legal_documents
  ADD COLUMN IF NOT EXISTS draft_content    text,
  ADD COLUMN IF NOT EXISTS draft_by         uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS draft_updated_at timestamptz;

-- ─────────────────────────────────────────────
-- 4. RPC: get_platform_role()
--    Gibt die Rolle des aktuellen Users zurück:
--    'owner' | 'co_founder' | 'developer' | 'billing' | 'support' | null
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_platform_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'platform_owner'
    ) THEN 'owner'
    ELSE (
      SELECT role FROM public.platform_team
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_role() TO authenticated;

-- ─────────────────────────────────────────────
-- 5. RLS für platform_team
-- ─────────────────────────────────────────────
ALTER TABLE public.platform_team ENABLE ROW LEVEL SECURITY;

-- Owner darf alles lesen
CREATE POLICY "platform_team_owner_all"
  ON public.platform_team
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'platform_owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'platform_owner'
    )
  );

-- Team-Mitglieder dürfen ihren eigenen Eintrag lesen
CREATE POLICY "platform_team_self_read"
  ON public.platform_team
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- 6. RLS für platform_team_restaurants
-- ─────────────────────────────────────────────
ALTER TABLE public.platform_team_restaurants ENABLE ROW LEVEL SECURITY;

-- Owner darf alles
CREATE POLICY "team_restaurants_owner_all"
  ON public.platform_team_restaurants
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'platform_owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'platform_owner'
    )
  );

-- Support-User darf seine eigenen Zuweisungen lesen
CREATE POLICY "team_restaurants_self_read"
  ON public.platform_team_restaurants
  FOR SELECT
  TO authenticated
  USING (
    team_member_id IN (
      SELECT id FROM public.platform_team WHERE user_id = auth.uid()
    )
  );
