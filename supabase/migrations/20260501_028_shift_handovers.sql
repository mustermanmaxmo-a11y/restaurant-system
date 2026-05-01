DROP TABLE IF EXISTS shift_handovers CASCADE;

CREATE TABLE shift_handovers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  staff_id      uuid NOT NULL,
  staff_name    text NOT NULL,
  raw_notes     text NOT NULL,
  summary       text NOT NULL,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX shift_handovers_restaurant_idx ON shift_handovers(restaurant_id, created_at DESC);

ALTER TABLE shift_handovers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON shift_handovers USING (true) WITH CHECK (true);
