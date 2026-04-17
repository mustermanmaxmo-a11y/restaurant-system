-- Design-Anfragen von Restaurant-Admins an den Platform Owner
-- Status: pending = neu, in_progress = in Bearbeitung, done = fertig

CREATE TABLE IF NOT EXISTS public.design_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message       text NOT NULL CHECK (char_length(message) >= 10 AND char_length(message) <= 1000),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done')),
  admin_note    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.design_requests ENABLE ROW LEVEL SECURITY;

-- Platform Owner darf alles
CREATE POLICY "design_requests_owner_all"
  ON public.design_requests FOR ALL TO authenticated
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

-- Restaurant-Admin darf eigene Anfragen lesen + anlegen
CREATE POLICY "design_requests_self_read"
  ON public.design_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "design_requests_self_insert"
  ON public.design_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
