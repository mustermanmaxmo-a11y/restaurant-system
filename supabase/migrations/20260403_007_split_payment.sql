-- Split Payment: Zahlung pro Gruppenmitglied tracken

CREATE TABLE IF NOT EXISTS group_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES order_groups(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  stripe_session_id text,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'covered', 'cash', 'terminal')),
  covered_by text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, member_name)
);

CREATE INDEX IF NOT EXISTS idx_group_payments_group
  ON group_payments (group_id);

CREATE INDEX IF NOT EXISTS idx_group_payments_session
  ON group_payments (stripe_session_id);

ALTER TABLE group_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_group_payments"
  ON group_payments FOR SELECT
  USING (true);

CREATE POLICY "service_role_all_group_payments"
  ON group_payments FOR ALL
  TO service_role
  WITH CHECK (true);
