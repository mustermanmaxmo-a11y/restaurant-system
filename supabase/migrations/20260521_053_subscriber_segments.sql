-- Subscriber-Segmentierung: order_count + total_spent für Klassifizierung
ALTER TABLE public.marketing_subscribers
  ADD COLUMN IF NOT EXISTS order_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.marketing_subscribers
  ADD COLUMN IF NOT EXISTS total_spent numeric(10,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS ms_segment_idx
  ON public.marketing_subscribers(restaurant_id, order_count);

-- Automations können auf Segment gefiltert werden
-- Werte: 'all' (default/null), 'new' (0 orders), 'occasional' (1-3),
--        'loyal' (4+), 'lapsed' (>30d kein Order), 'vip' (>10 orders OR >300€)
ALTER TABLE public.marketing_automations
  ADD COLUMN IF NOT EXISTS segment text;

-- Atomic increment helper (verhindert race conditions bei parallelen Orders)
CREATE OR REPLACE FUNCTION public.bump_subscriber_stats(
  p_restaurant_id uuid,
  p_email text,
  p_spent numeric
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.marketing_subscribers
  SET order_count = order_count + 1,
      total_spent = total_spent + COALESCE(p_spent, 0),
      last_order_at = now()
  WHERE restaurant_id = p_restaurant_id
    AND email = p_email;
$$;

GRANT EXECUTE ON FUNCTION public.bump_subscriber_stats(uuid, text, numeric)
  TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON public.marketing_subscribers
  TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_automations
  TO authenticated, service_role;
