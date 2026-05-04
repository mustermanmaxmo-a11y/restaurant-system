-- Cook claiming: lets kitchen staff coordinate who cooks which order
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS claimed_by uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
