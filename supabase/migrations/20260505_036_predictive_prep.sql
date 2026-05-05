-- Feature #8: Predictive Prep

CREATE TABLE IF NOT EXISTS public.daily_prep_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  plan_date date NOT NULL,
  plan_data jsonb NOT NULL,
  generated_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, plan_date)
);

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS prep_show_in_kds boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS prep_push_enabled boolean DEFAULT false;

-- RLS: nur Owner
ALTER TABLE public.daily_prep_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage" ON public.daily_prep_plans
  FOR ALL USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
  );
