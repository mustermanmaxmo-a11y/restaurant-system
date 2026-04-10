-- Add auto_translate_enabled flag to restaurants
-- Defaults to true so existing restaurants keep current behavior
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS auto_translate_enabled BOOLEAN DEFAULT true;
