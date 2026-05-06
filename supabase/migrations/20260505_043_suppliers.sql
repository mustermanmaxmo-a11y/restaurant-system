-- Feature #15: Lieferanten-Verzeichnis (erweitert bestehende suppliers-Tabelle)

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS category text;  -- 'meat','vegetables','drinks','other'

-- Produkte pro Lieferant
CREATE TABLE IF NOT EXISTS public.supplier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text,
  price_per_unit numeric,
  created_at timestamptz DEFAULT now()
);

-- Bevorzugter Lieferant pro Zutat (ingredients = Lagerbestand-Tabelle)
ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS preferred_supplier_id uuid REFERENCES public.suppliers(id);

-- RLS für supplier_products (suppliers-Tabelle hat bereits RLS via migration 009)
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all" ON public.supplier_products;
CREATE POLICY "owner_all" ON public.supplier_products
  FOR ALL USING (
    supplier_id IN (
      SELECT id FROM public.suppliers WHERE restaurant_id IN (
        SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
      )
    )
  );
