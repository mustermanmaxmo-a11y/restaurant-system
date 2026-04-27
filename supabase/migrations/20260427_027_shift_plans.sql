CREATE TABLE IF NOT EXISTS shift_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  week_start    date NOT NULL,
  plan          jsonb NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shift_plans_restaurant_week
  ON shift_plans (restaurant_id, week_start DESC);
