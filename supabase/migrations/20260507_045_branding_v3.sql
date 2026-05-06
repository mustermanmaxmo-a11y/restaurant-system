-- Branding V3: Design Templates, Design Requests, Template Access, Landing Pages

-- 1. New tables

CREATE TABLE IF NOT EXISTS public.design_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  slug         text UNIQUE NOT NULL,
  category     text NOT NULL, -- 'fast-food'|'fine-dining'|'casual'|'bar'|'cafe'|'asian'|'italian'|'street-food'|'bavarian'|'scandinavian'
  style_tags   text[] DEFAULT '{}',
  plan_tier    text NOT NULL DEFAULT 'basic', -- 'basic'|'pro'|'premium'
  is_public    boolean NOT NULL DEFAULT true,
  preview_url  text,
  config       jsonb NOT NULL DEFAULT '{}',
  sort_order   int DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

-- Redesign design_requests table (replacing old schema from migration 020)
-- Old table had user_id/message/admin_note; new schema uses restaurant_id/description/screenshot_url/result_template_id
DROP TABLE IF EXISTS public.design_requests CASCADE;
CREATE TABLE public.design_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id      uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  description        text,
  screenshot_url     text,
  status             text NOT NULL DEFAULT 'pending',
  result_template_id uuid REFERENCES public.design_templates(id),
  admin_notes        text,
  created_at         timestamptz DEFAULT now(),
  CONSTRAINT design_requests_status_check CHECK (status IN ('pending', 'building', 'done', 'rejected'))
);

CREATE TABLE IF NOT EXISTS public.template_access (
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  template_id   uuid REFERENCES public.design_templates(id) ON DELETE CASCADE,
  granted_by    text NOT NULL DEFAULT 'plan', -- 'plan'|'manual'
  created_at    timestamptz DEFAULT now(),
  PRIMARY KEY (restaurant_id, template_id)
);

CREATE TABLE IF NOT EXISTS public.landing_pages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE UNIQUE,
  template_slug text NOT NULL DEFAULT 'minimal-dark',
  content       jsonb NOT NULL DEFAULT '{}',
  is_published  boolean NOT NULL DEFAULT false,
  custom_domain text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- 2. Add design_config JSONB column to restaurants

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS design_config jsonb NOT NULL DEFAULT '{}';

-- 3. Migrate existing design values into design_config

UPDATE public.restaurants
SET design_config = jsonb_strip_nulls(jsonb_build_object(
  'primary_color',  primary_color,
  'surface_color',  surface_color,
  'bg_color',       bg_color,
  'header_color',   header_color,
  'button_color',   button_color,
  'card_color',     card_color,
  'text_color',     text_color,
  'font_pair',      font_pair,
  'layout_variant', layout_variant,
  'design_package', design_package,
  'border_radius',  'rounded',
  'hover_effect',   'scale',
  'animation_style','fade',
  'card_style',     'elevated'
))
WHERE design_config = '{}' AND (
  primary_color IS NOT NULL OR font_pair IS NOT NULL OR design_package IS NOT NULL
);

-- 4. Enable RLS on all new tables

ALTER TABLE public.design_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- design_templates: public read, service role write
DROP POLICY IF EXISTS "design_templates_public_read" ON public.design_templates;
CREATE POLICY "design_templates_public_read" ON public.design_templates
  FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "design_templates_service_all" ON public.design_templates;
CREATE POLICY "design_templates_service_all" ON public.design_templates
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "design_templates_granted_read" ON public.design_templates;
CREATE POLICY "design_templates_granted_read" ON public.design_templates
  FOR SELECT USING (
    id IN (
      SELECT ta.template_id FROM public.template_access ta
      JOIN public.restaurants r ON r.id = ta.restaurant_id
      WHERE r.owner_id = auth.uid()
    )
  );

-- design_requests: owners manage their own, service role full access
DROP POLICY IF EXISTS "design_requests_owner_all" ON public.design_requests;
CREATE POLICY "design_requests_owner_all" ON public.design_requests
  FOR ALL USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "design_requests_service_all" ON public.design_requests;
CREATE POLICY "design_requests_service_all" ON public.design_requests
  FOR ALL USING (auth.role() = 'service_role');

-- template_access: service role only
DROP POLICY IF EXISTS "template_access_service_all" ON public.template_access;
CREATE POLICY "template_access_service_all" ON public.template_access
  FOR ALL USING (auth.role() = 'service_role');

-- landing_pages: owners manage their own, public read published, service role full access
DROP POLICY IF EXISTS "landing_pages_owner_all" ON public.landing_pages;
CREATE POLICY "landing_pages_owner_all" ON public.landing_pages
  FOR ALL USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "landing_pages_public_read" ON public.landing_pages;
CREATE POLICY "landing_pages_public_read" ON public.landing_pages
  FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "landing_pages_service_all" ON public.landing_pages;
CREATE POLICY "landing_pages_service_all" ON public.landing_pages
  FOR ALL USING (auth.role() = 'service_role');

-- 6. Indexes for performance

CREATE INDEX IF NOT EXISTS idx_design_templates_category ON public.design_templates(category);
CREATE INDEX IF NOT EXISTS idx_design_templates_plan_tier ON public.design_templates(plan_tier);
CREATE INDEX IF NOT EXISTS idx_design_templates_slug ON public.design_templates(slug);
CREATE INDEX IF NOT EXISTS idx_design_requests_restaurant ON public.design_requests(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_design_requests_status ON public.design_requests(status);
CREATE INDEX IF NOT EXISTS idx_template_access_restaurant ON public.template_access(restaurant_id);
