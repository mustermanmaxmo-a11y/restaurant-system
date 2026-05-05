-- Feature #3: Engpass-Alert

-- Alert-Konfiguration pro Restaurant
CREATE TABLE IF NOT EXISTS public.alert_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE UNIQUE,
  alerts_enabled boolean DEFAULT false,
  push_kitchen boolean DEFAULT false,
  push_admin boolean DEFAULT false,
  kds_visual boolean DEFAULT false,
  show_sold_out_label boolean DEFAULT false,
  auto_hide_item boolean DEFAULT false,
  default_threshold int DEFAULT 5,
  created_at timestamptz DEFAULT now()
);

-- Schwellwert pro Menü-Item (null = globalen Wert nutzen)
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS alert_threshold int;

-- Direkter Portionsbestand pro Menü-Item (null = unbegrenzt, 0 = ausverkauft)
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS stock_count int;

-- RLS: nur Owner
ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage" ON public.alert_settings
  FOR ALL USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );

-- Guests need to read alert settings to apply sold-out logic on ordering page
CREATE POLICY "public_read" ON public.alert_settings
  FOR SELECT USING (alerts_enabled = true);
