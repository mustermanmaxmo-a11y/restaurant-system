-- Platform-wide settings (single row, managed by platform admin)
CREATE TABLE IF NOT EXISTS platform_settings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anthropic_api_key text,
  updated_at     timestamptz DEFAULT now()
);

-- Seed the single row
INSERT INTO platform_settings (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- RLS: no public read access (service role bypasses RLS and reads server-side)
-- Authenticated platform admin can update
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_can_update_platform_settings"
  ON platform_settings FOR UPDATE
  USING (auth.role() = 'authenticated');
