-- push_subscriptions: stores Web Push API subscriptions per device+context
CREATE TABLE push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_context   text NOT NULL CHECK (app_context IN ('dashboard', 'admin', 'platform')),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id       uuid,                   -- Supabase auth UID (admin/platform), NULL for staff
  staff_role    text,                   -- 'service' | 'kitchen' | 'delivery' (dashboard only)
  endpoint      text NOT NULL,
  p256dh        text NOT NULL,
  auth_key      text NOT NULL,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (endpoint)
);

CREATE INDEX push_subscriptions_restaurant_ctx
  ON push_subscriptions (restaurant_id, app_context);
CREATE INDEX push_subscriptions_context
  ON push_subscriptions (app_context);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
-- Only service role (server-side API) can read/write — no client-side RLS needed
CREATE POLICY "service_role_all" ON push_subscriptions
  USING (true) WITH CHECK (true);
