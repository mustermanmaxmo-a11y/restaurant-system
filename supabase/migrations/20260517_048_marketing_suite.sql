-- Marketing Suite — DB Migration
-- New tables: marketing_knowledge, restaurant_knowledge, marketing_automations, campaign_events
-- Extends: marketing_campaigns, marketing_subscribers

-- ============================================================
-- EXTEND EXISTING TABLES
-- ============================================================

-- marketing_campaigns: add tracking + AI + scheduling columns
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS template_type text;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS tracking_pixel_id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS open_count int DEFAULT 0;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS click_count int DEFAULT 0;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS conversion_revenue decimal(10,2) DEFAULT 0;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS generated_by_ai boolean DEFAULT false;
ALTER TABLE public.marketing_campaigns ADD COLUMN IF NOT EXISTS social_post_generated boolean DEFAULT false;

-- marketing_subscribers: add behavioural + segmentation columns
ALTER TABLE public.marketing_subscribers ADD COLUMN IF NOT EXISTS last_order_at timestamptz;
ALTER TABLE public.marketing_subscribers ADD COLUMN IF NOT EXISTS birthday date;
ALTER TABLE public.marketing_subscribers ADD COLUMN IF NOT EXISTS order_type_preference text CHECK (order_type_preference IN ('dine-in','delivery','pickup'));
ALTER TABLE public.marketing_subscribers ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
ALTER TABLE public.marketing_subscribers ALTER COLUMN source SET DEFAULT 'manual';

-- ============================================================
-- marketing_knowledge — Platform-wide knowledge base
-- Written by platform admin, read server-side by AI (service_role only)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketing_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL CHECK (category IN ('email-strategy','seasonal','psychology','dsgvo','trends')),
  tags text[] DEFAULT '{}',
  language text DEFAULT 'de' CHECK (language IN ('de','en')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.marketing_knowledge ENABLE ROW LEVEL SECURITY;

-- No anon or authenticated access — platform admin uses service_role only
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_knowledge TO service_role;
REVOKE ALL ON public.marketing_knowledge FROM anon, authenticated;

-- ============================================================
-- restaurant_knowledge — Restaurant-specific facts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.restaurant_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  fact text NOT NULL,
  category text DEFAULT 'other' CHECK (category IN ('audience','specialty','success','other')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.restaurant_knowledge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_owners_only" ON public.restaurant_knowledge;
CREATE POLICY "restaurant_owners_only" ON public.restaurant_knowledge
  FOR ALL USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_knowledge TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_knowledge TO service_role;

-- ============================================================
-- marketing_automations — Automation rules per restaurant
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketing_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  trigger_type text NOT NULL CHECK (trigger_type IN ('post_order','inactivity_14d','birthday','seasonal','scheduled')),
  trigger_config jsonb DEFAULT '{}',
  template_type text DEFAULT 'discount',
  subject_template text,
  body_template text,
  discount_code_prefix text,
  discount_percent int DEFAULT 10,
  active boolean DEFAULT false,
  last_run_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.marketing_automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_owners_only" ON public.marketing_automations;
CREATE POLICY "restaurant_owners_only" ON public.marketing_automations
  FOR ALL USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_automations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_automations TO service_role;

-- ============================================================
-- campaign_events — Aggregated tracking (no PII)
-- Written by server-side tracking endpoint via service_role only
-- ============================================================

CREATE TABLE IF NOT EXISTS public.campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('open','click','conversion')),
  count int DEFAULT 1,
  revenue decimal(10,2) DEFAULT 0,
  tracked_at date DEFAULT CURRENT_DATE
);

ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;

-- No anon or authenticated access — server tracking endpoint uses service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_events TO service_role;
REVOKE ALL ON public.campaign_events FROM anon, authenticated;
