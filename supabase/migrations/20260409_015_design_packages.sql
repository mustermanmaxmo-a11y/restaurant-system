-- Add design customization columns to restaurants
-- Supports design packages, layout variants, font pairs, and granular color control
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS design_package  text DEFAULT 'modern-classic',
  ADD COLUMN IF NOT EXISTS layout_variant  text DEFAULT 'cards',
  ADD COLUMN IF NOT EXISTS font_pair       text DEFAULT 'syne-dmsans',
  ADD COLUMN IF NOT EXISTS header_color    text,
  ADD COLUMN IF NOT EXISTS button_color    text,
  ADD COLUMN IF NOT EXISTS card_color      text,
  ADD COLUMN IF NOT EXISTS text_color      text,
  ADD COLUMN IF NOT EXISTS bg_color        text;
