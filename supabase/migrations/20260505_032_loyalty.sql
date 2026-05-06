-- Feature #2: Digitale Stempelkarte / Loyalty

-- Loyalty-Konfiguration pro Restaurant
CREATE TABLE IF NOT EXISTS public.loyalty_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE UNIQUE,
  enabled boolean DEFAULT false,
  mechanic text DEFAULT 'stamps' CHECK (mechanic IN ('stamps','points')),
  goal int DEFAULT 10,
  points_per_euro int DEFAULT 10,
  reward_text text DEFAULT 'Gratis-Getränk',
  show_banner boolean DEFAULT false,
  email_link_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Gast-Mitglieder (verknüpft mit Supabase Auth user)
CREATE TABLE IF NOT EXISTS public.loyalty_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  stamp_count int DEFAULT 0,
  points int DEFAULT 0,
  total_redeemed int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, restaurant_id)
);

-- RLS: loyalty_programs
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_manage" ON public.loyalty_programs;
CREATE POLICY "owner_manage" ON public.loyalty_programs
  FOR ALL USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "public_read_enabled" ON public.loyalty_programs;
CREATE POLICY "public_read_enabled" ON public.loyalty_programs
  FOR SELECT USING (enabled = true);

-- RLS: loyalty_members
ALTER TABLE public.loyalty_members ENABLE ROW LEVEL SECURITY;

-- Gast kann eigene Daten lesen und schreiben
DROP POLICY IF EXISTS "member_own" ON public.loyalty_members;
CREATE POLICY "member_own" ON public.loyalty_members
  FOR ALL USING (user_id = auth.uid());

-- Owner kann alle Mitglieder seines Restaurants lesen
DROP POLICY IF EXISTS "owner_read" ON public.loyalty_members;
CREATE POLICY "owner_read" ON public.loyalty_members
  FOR SELECT USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );
