-- Feature #9: Revenue Benchmarking

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS benchmark_opt_in boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS restaurant_category text,
  ADD COLUMN IF NOT EXISTS seating_capacity int;

CREATE TABLE IF NOT EXISTS public.benchmark_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  daily_revenue numeric,
  order_count int,
  avg_order_value numeric,
  UNIQUE(restaurant_id, snapshot_date)
);

-- RLS: owner reads own snapshots, system writes all (via service role)
ALTER TABLE public.benchmark_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_read" ON public.benchmark_snapshots;
CREATE POLICY "owner_read" ON public.benchmark_snapshots
  FOR SELECT USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
  );
