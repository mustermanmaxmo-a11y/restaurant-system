-- Verhindert doppelte Bewertungen pro Order (notwendig für upsert mit onConflict)
-- Falls bereits Duplikate existieren: nur den ersten Eintrag pro order_id behalten
DELETE FROM public.order_ratings a
USING public.order_ratings b
WHERE a.created_at > b.created_at
  AND a.order_id = b.order_id
  AND a.order_id IS NOT NULL;

ALTER TABLE public.order_ratings
  DROP CONSTRAINT IF EXISTS order_ratings_order_id_unique;
ALTER TABLE public.order_ratings
  ADD CONSTRAINT order_ratings_order_id_unique UNIQUE (order_id);

-- Gast soll sein Feedback nachreichen können (Update auf eigene Order)
DROP POLICY IF EXISTS "public_update_feedback" ON public.order_ratings;
CREATE POLICY "public_update_feedback" ON public.order_ratings
  FOR UPDATE USING (true) WITH CHECK (true);

-- Explicit grants
GRANT SELECT, INSERT, UPDATE ON public.order_ratings TO anon, authenticated, service_role;
