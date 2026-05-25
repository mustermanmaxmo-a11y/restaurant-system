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

-- RPC: Race-safe Reward-Einlösung
CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward(
  p_subscriber_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_program loyalty_programs%ROWTYPE;
  v_member loyalty_members%ROWTYPE;
  v_current int;
BEGIN
  SELECT * INTO v_program FROM loyalty_programs
    WHERE restaurant_id = p_restaurant_id AND enabled = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_program'; END IF;

  -- Lock member row (verhindert Double-Spend bei parallelen Calls)
  SELECT * INTO v_member FROM loyalty_members
    WHERE subscriber_id = p_subscriber_id AND restaurant_id = p_restaurant_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_member'; END IF;

  v_current := CASE v_program.mechanic
                 WHEN 'stamps' THEN v_member.stamp_count
                 ELSE v_member.points
               END;
  IF v_current < v_program.goal THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  IF v_program.mechanic = 'stamps' THEN
    UPDATE loyalty_members
      SET stamp_count = stamp_count - v_program.goal,
          total_redeemed = total_redeemed + 1
      WHERE id = v_member.id;
  ELSE
    UPDATE loyalty_members
      SET points = points - v_program.goal,
          total_redeemed = total_redeemed + 1
      WHERE id = v_member.id;
  END IF;

  UPDATE orders
    SET reward_applied = jsonb_build_object(
      'reward_text', v_program.reward_text,
      'value_cents', v_program.reward_value_cents,
      'member_id', v_member.id,
      'redeemed_at', now()
    )
    WHERE id = p_order_id;

  INSERT INTO marketing_events (restaurant_id, subscriber_id, event_type, props)
    VALUES (p_restaurant_id, p_subscriber_id, 'redeemed_reward',
            jsonb_build_object('order_id', p_order_id,
                               'reward_text', v_program.reward_text,
                               'value_cents', v_program.reward_value_cents));

  RETURN jsonb_build_object('success', true,
                            'reward_text', v_program.reward_text,
                            'value_cents', v_program.reward_value_cents);
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_loyalty_reward(uuid, uuid, uuid) TO anon, authenticated;

-- Trigger: server-side point/stamp crediting bei status='served'
CREATE OR REPLACE FUNCTION public.credit_loyalty_on_served() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_program loyalty_programs%ROWTYPE;
  v_member_id uuid;
BEGIN
  IF NEW.status = 'served'
     AND OLD.status IS DISTINCT FROM 'served'
     AND NEW.customer_id IS NOT NULL THEN

    SELECT * INTO v_program FROM loyalty_programs
      WHERE restaurant_id = NEW.restaurant_id AND enabled = true;
    IF NOT FOUND THEN RETURN NEW; END IF;

    INSERT INTO loyalty_members (subscriber_id, restaurant_id)
      VALUES (NEW.customer_id, NEW.restaurant_id)
      ON CONFLICT (subscriber_id, restaurant_id) DO NOTHING;

    SELECT id INTO v_member_id FROM loyalty_members
      WHERE subscriber_id = NEW.customer_id AND restaurant_id = NEW.restaurant_id;

    IF v_program.mechanic = 'stamps' THEN
      UPDATE loyalty_members SET stamp_count = stamp_count + 1 WHERE id = v_member_id;
    ELSE
      UPDATE loyalty_members
        SET points = points + FLOOR(NEW.total * v_program.points_per_euro)
        WHERE id = v_member_id;
    END IF;

    INSERT INTO marketing_events (restaurant_id, subscriber_id, event_type, props)
      VALUES (NEW.restaurant_id, NEW.customer_id, 'loyalty_credited',
              jsonb_build_object('order_id', NEW.id,
                                 'mechanic', v_program.mechanic,
                                 'order_total', NEW.total));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loyalty_credit_on_served ON public.orders;
CREATE TRIGGER trg_loyalty_credit_on_served
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.credit_loyalty_on_served();

COMMIT;
