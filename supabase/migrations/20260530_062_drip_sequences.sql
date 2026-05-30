-- Migration 062: A4 Win-Back Drip
-- drip_sequences: pro-Restaurant Drip-Konfiguration
-- drip_steps: einzelne Steps einer Sequenz
-- drip_enrollments: trackt Subscriber-Fortschritt
-- discount_codes: drip_step_id Spalte ergänzt

-- 1) drip_sequences
CREATE TABLE IF NOT EXISTS public.drip_sequences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name          text NOT NULL DEFAULT 'Win-Back Drip',
  trigger_days  int NOT NULL DEFAULT 14,
  enabled       boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 2) drip_steps
CREATE TABLE IF NOT EXISTS public.drip_steps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id   uuid NOT NULL REFERENCES public.drip_sequences(id) ON DELETE CASCADE,
  position      int NOT NULL,
  delay_days    int NOT NULL DEFAULT 7,
  subject       text NOT NULL,
  headline      text NOT NULL,
  body_text     text NOT NULL,
  discount_type text CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric,
  expires_days  int NOT NULL DEFAULT 7
);

-- 3) drip_enrollments
CREATE TABLE IF NOT EXISTS public.drip_enrollments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id   uuid NOT NULL REFERENCES public.drip_sequences(id) ON DELETE CASCADE,
  subscriber_id uuid NOT NULL REFERENCES public.marketing_subscribers(id) ON DELETE CASCADE,
  current_step  int NOT NULL DEFAULT 0,
  next_due_at   date NOT NULL,
  enrolled_at   timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  stop_reason   text CHECK (stop_reason IN ('ordered','code_redeemed','unsubscribed','manual','completed')),
  UNIQUE (sequence_id, subscriber_id)
);

-- 4) discount_codes: drip_step_id für Tracking
ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS drip_step_id uuid REFERENCES public.drip_steps(id) ON DELETE SET NULL;

-- 5) Indexes
CREATE INDEX IF NOT EXISTS idx_drip_sequences_restaurant ON public.drip_sequences(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_drip_steps_sequence ON public.drip_steps(sequence_id, position);
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_due ON public.drip_enrollments(next_due_at) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_subscriber ON public.drip_enrollments(subscriber_id) WHERE completed_at IS NULL;

-- 6) GRANTs + RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drip_sequences TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drip_steps TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drip_enrollments TO service_role;

ALTER TABLE public.drip_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drip_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drip_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY drip_sequences_owner_read ON public.drip_sequences
  FOR SELECT TO authenticated
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()));
