-- Add notification email for design-request alerts
ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS notification_email text;
