-- Feature #1: Google Review Automation

-- Google Review URL pro Restaurant
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS google_review_url text;

-- Bewertungen-Tabelle
CREATE TABLE IF NOT EXISTS public.order_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  stars int NOT NULL CHECK (stars BETWEEN 1 AND 5),
  feedback text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.order_ratings ENABLE ROW LEVEL SECURITY;

-- Owner kann Ratings seines Restaurants lesen
CREATE POLICY "owner_read" ON public.order_ratings
  FOR SELECT USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );

-- Gast kann Rating ohne Login einreichen
CREATE POLICY "public_insert" ON public.order_ratings
  FOR INSERT WITH CHECK (true);
