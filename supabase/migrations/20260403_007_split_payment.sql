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
  USING (
    group_id IN (
      SELECT id FROM order_groups WHERE status != 'cancelled'
    )
  );

CREATE POLICY "service_role_all_group_payments"
  ON group_payments FOR ALL
  TO service_role
  WITH CHECK (true);

CREATE POLICY "owner_all_group_payments"
  ON group_payments FOR ALL
  USING (
    group_id IN (
      SELECT id FROM order_groups
      WHERE restaurant_id = get_owner_restaurant_id()
    )
  )
  WITH CHECK (
    group_id IN (
      SELECT id FROM order_groups
      WHERE restaurant_id = get_owner_restaurant_id()
    )
  );

-- Anon kann group_payments einfügen wenn die Gruppe 'submitted' ist
CREATE POLICY "anon_insert_group_payments"
  ON group_payments FOR INSERT
  TO anon
  WITH CHECK (
    group_id IN (
      SELECT id FROM order_groups WHERE status IN ('submitted', 'ordering')
    )
  );

-- Anon kann group_payments aktualisieren (eigene Zeile: covered_by, amount)
CREATE POLICY "anon_update_group_payments"
  ON group_payments FOR UPDATE
  TO anon
  USING (
    group_id IN (
      SELECT id FROM order_groups WHERE status IN ('submitted', 'ordering')
    )
  )
  WITH CHECK (
    group_id IN (
      SELECT id FROM order_groups WHERE status IN ('submitted', 'ordering')
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.group_payments;

-- Allow 'ordering' status on order_groups to prevent race conditions
ALTER TABLE order_groups DROP CONSTRAINT IF EXISTS order_groups_status_check;
ALTER TABLE order_groups ADD CONSTRAINT order_groups_status_check
  CHECK (status IN ('active', 'submitted', 'ordering', 'cancelled'));
