-- Migration 058: Loyalty Anon Support + Reward Redemption
-- - loyalty_members: subscriber_id FK + user_id nullable
-- - loyalty_programs: reward_value_cents
-- - orders: reward_applied jsonb
-- - RPCs: get_loyalty_status, redeem_loyalty_reward
-- - Trigger: credit_loyalty_on_served

BEGIN;

-- 1) loyalty_members: subscriber_id als neuer primärer Anker
ALTER TABLE public.loyalty_members
  ADD COLUMN IF NOT EXISTS subscriber_id uuid REFERENCES public.marketing_subscribers(id) ON DELETE CASCADE,
  ALTER COLUMN user_id DROP NOT NULL;

-- Backfill aus auth.users via Email
UPDATE public.loyalty_members lm
SET subscriber_id = ms.id
FROM auth.users au, public.marketing_subscribers ms
WHERE lm.user_id = au.id
  AND au.email = ms.email
  AND ms.restaurant_id = lm.restaurant_id
  AND lm.subscriber_id IS NULL;

-- Unique-Constraint umstellen
ALTER TABLE public.loyalty_members
  DROP CONSTRAINT IF EXISTS loyalty_members_user_id_restaurant_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_members_subscriber_unique
  ON public.loyalty_members (subscriber_id, restaurant_id)
  WHERE subscriber_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loyalty_members_restaurant
  ON public.loyalty_members (restaurant_id);

-- 2) loyalty_programs: Reward-Wert in Cents
ALTER TABLE public.loyalty_programs
  ADD COLUMN IF NOT EXISTS reward_value_cents int DEFAULT 400;

-- 3) orders: Reward-Application tracken
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS reward_applied jsonb;

-- GRANTs (Pflicht laut feedback_supabase_grants)
GRANT SELECT ON public.loyalty_programs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_programs TO authenticated;
GRANT ALL ON public.loyalty_programs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_members TO authenticated;
GRANT ALL ON public.loyalty_members TO service_role;
-- Anon hat KEIN direct table access — geht nur über RPCs (Task 3 + 4)

-- RPC: Loyalty-Status für anonyme oder registrierte Gäste
-- Sucht subscriber_id zuerst direkt, fallback via email
CREATE OR REPLACE FUNCTION public.get_loyalty_status(
  p_restaurant_id uuid,
  p_subscriber_id uuid DEFAULT NULL,
  p_email text DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH resolved AS (
    SELECT COALESCE(
      p_subscriber_id,
      (SELECT id FROM marketing_subscribers
         WHERE restaurant_id = p_restaurant_id
           AND lower(email) = lower(p_email)
         LIMIT 1)
    ) AS subscriber_id
  )
  SELECT jsonb_build_object(
    'program', to_jsonb(lp.*),
    'member', to_jsonb(lm.*),
    'subscriber_id', (SELECT subscriber_id FROM resolved)
  )
  FROM loyalty_programs lp
  LEFT JOIN loyalty_members lm
    ON lm.restaurant_id = lp.restaurant_id
   AND lm.subscriber_id = (SELECT subscriber_id FROM resolved)
  WHERE lp.restaurant_id = p_restaurant_id AND lp.enabled = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_loyalty_status(uuid, uuid, text) TO anon, authenticated;

COMMIT;
