-- Registrierungsanfragen von /team-register
-- Status: pending = wartet, approved = angenommen, rejected = abgelehnt

CREATE TABLE IF NOT EXISTS public.team_registration_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.team_registration_requests ENABLE ROW LEVEL SECURITY;

-- Owner darf alles
CREATE POLICY "team_requests_owner_all"
  ON public.team_registration_requests
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

-- Eigener Eintrag lesbar (damit /team-register Status prüfen kann)
CREATE POLICY "team_requests_self_read"
  ON public.team_registration_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Eigenen Eintrag anlegen (Insert bei Registrierung)
CREATE POLICY "team_requests_self_insert"
  ON public.team_registration_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
