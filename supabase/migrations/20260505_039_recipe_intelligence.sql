-- Feature #11: Inventory Intelligence — Rezept-System

CREATE TABLE IF NOT EXISTS public.recipe_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE CASCADE UNIQUE,
  preparation_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: nur Staff + Owner können Rezepte lesen (nie Gäste)
ALTER TABLE public.recipe_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage" ON public.recipe_notes
  FOR ALL USING (
    menu_item_id IN (
      SELECT id FROM public.menu_items WHERE restaurant_id IN (
        SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
      )
    )
  );

-- menu_item_ingredients existiert bereits, nur Falls noch nicht vorhanden:
CREATE TABLE IF NOT EXISTS public.menu_item_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE CASCADE,
  ingredient_name text NOT NULL,
  quantity numeric,
  unit text,
  ai_uncertain boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.menu_item_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manage" ON public.menu_item_ingredients
  FOR ALL USING (
    menu_item_id IN (
      SELECT id FROM public.menu_items WHERE restaurant_id IN (
        SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
      )
    )
  );
