-- Feature #10: Stammgast-CRM + Re-Engagement

CREATE TABLE IF NOT EXISTS public.reengagement_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.loyalty_members(id) ON DELETE CASCADE,
  rule text NOT NULL,
  sent_at timestamptz DEFAULT now()
);

-- Unique: max 1x per day per member per rule
CREATE UNIQUE INDEX IF NOT EXISTS reengagement_log_daily
  ON public.reengagement_log (member_id, rule, (sent_at::date));

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS crm_rule_inactive boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS crm_rule_almost_goal boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS crm_rule_welcome boolean DEFAULT false;

-- RLS: nur Owner
ALTER TABLE public.reengagement_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_read" ON public.reengagement_log
  FOR SELECT USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
  );
