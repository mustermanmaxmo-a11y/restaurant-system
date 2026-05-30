-- Migration 061: A3 Birthday + Event Trigger
-- campaigns: per-restaurant trigger configs
-- discount_codes: unique per-subscriber codes
-- orders: discount tracking columns

-- 1) campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  trigger_type    text NOT NULL CHECK (trigger_type IN ('birthday', 'first_order_anniversary', 'custom_event')),
  send_date       date,
  subject         text NOT NULL,
  headline        text NOT NULL,
  body_text       text NOT NULL,
  discount_type   text CHECK (discount_type IN ('percent', 'fixed')),
  discount_value  numeric,
  expires_days    int NOT NULL DEFAULT 7,
  enabled         boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz
);

-- 2) discount_codes
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  subscriber_id   uuid REFERENCES public.marketing_subscribers(id) ON DELETE SET NULL,
  campaign_id     uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  code            text NOT NULL UNIQUE,
  discount_type   text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value  numeric NOT NULL,
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz,
  used_order_id   uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 3) orders: discount tracking
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_code text,
  ADD COLUMN IF NOT EXISTS discount_amount_cents int;

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_restaurant ON public.campaigns(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_send_date ON public.campaigns(send_date) WHERE trigger_type = 'custom_event';
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON public.discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_subscriber ON public.discount_codes(subscriber_id, campaign_id);

-- 5) GRANTs — nur service_role hat vollen Zugriff
-- Client-seitige Validierung läuft über API-Routes (service_role), nicht direkt
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_codes TO service_role;

-- RLS aktivieren
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- campaigns: Owner kann eigene lesen (für Dashboard)
CREATE POLICY campaigns_owner_read ON public.campaigns
  FOR SELECT TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
  ));

-- discount_codes: kein direkter Client-Zugriff — nur via service_role API-Routes
-- (validate-code + use-code endpoints nutzen createSupabaseAdmin())
