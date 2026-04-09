-- Menu Item Translations: auto-translated name/description per language
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}';

COMMENT ON COLUMN menu_items.translations IS
  'Auto-translated name/description per language. Keys: en, es, it, tr, fr, pl, ru. Value: { name: string, description: string }';
