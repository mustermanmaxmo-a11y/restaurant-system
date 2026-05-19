-- Email Templates — für KI-generierte branded HTML Emails
-- Wird von Automationen und KI-Berater genutzt

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text CHECK (trigger_type IN ('post_order','inactivity_14d','birthday','seasonal','scheduled','manual')),
  subject_template text NOT NULL,
  body_html text NOT NULL,
  is_active boolean DEFAULT true,
  created_by_ai boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_owners_only" ON public.email_templates;
CREATE POLICY "restaurant_owners_only" ON public.email_templates
  FOR ALL USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO service_role;

-- Automation kann ein Template referenzieren
ALTER TABLE public.marketing_automations
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL;
