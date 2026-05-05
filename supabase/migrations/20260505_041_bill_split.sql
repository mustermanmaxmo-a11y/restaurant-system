-- Feature #13: Echtes Bill-Splitting

CREATE TABLE IF NOT EXISTS public.bill_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  share_token text UNIQUE DEFAULT gen_random_uuid()::text,
  persons jsonb NOT NULL DEFAULT '[]',
  item_assignments jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Public: anyone with the token can read/update the split
ALTER TABLE public.bill_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON public.bill_splits
  FOR SELECT USING (true);

CREATE POLICY "public_update" ON public.bill_splits
  FOR UPDATE USING (true);

CREATE POLICY "public_insert" ON public.bill_splits
  FOR INSERT WITH CHECK (true);
