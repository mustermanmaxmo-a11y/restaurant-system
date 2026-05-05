-- Feature #6: Email Marketing

-- Email-Abonnenten pro Restaurant
CREATE TABLE IF NOT EXISTS public.marketing_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  opted_in_at timestamptz DEFAULT now(),
  unsubscribed_at timestamptz,
  source text DEFAULT 'order',
  UNIQUE(restaurant_id, email)
);

-- Kampagnen
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text NOT NULL,
  target text DEFAULT 'all',
  status text DEFAULT 'draft',
  sent_at timestamptz,
  recipient_count int,
  created_at timestamptz DEFAULT now()
);

-- RLS: nur Owner
ALTER TABLE public.marketing_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON public.marketing_subscribers
  FOR ALL USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
  );

CREATE POLICY "owner_all" ON public.marketing_campaigns
  FOR ALL USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
  );

-- Email Marketing aktiviert Flag
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS email_marketing_enabled boolean DEFAULT false;
