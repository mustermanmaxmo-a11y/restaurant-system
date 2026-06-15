-- Unify Brand (#1): Altdaten bereinigen.
-- Idempotent. Legacy-Spalten bleiben als Rollback erhalten.

-- 1. Leeres design_config mit Default-Look (modern-classic) befüllen.
UPDATE public.restaurants
SET design_config = jsonb_build_object(
  'primary_color',  '#FF6B2C',
  'bg_color',       '#080808',
  'surface_color',  '#131313',
  'header_color',   '#080808',
  'button_color',   '#FF6B2C',
  'card_color',     '#131313',
  'text_color',     '#f0ede8',
  'font_pair',      'syne-dmsans',
  'layout_variant', 'cards',
  'border_radius',  'rounded',
  'hover_effect',   'scale',
  'animation_style','fade',
  'card_style',     'elevated',
  'design_package', 'modern-classic'
)
WHERE design_config IS NULL OR design_config = '{}'::jsonb;

-- 2. lp_design_package aus landing_pages.content entfernen
--    (Farben/Fonts kommen jetzt aus dem Brand-Kern). Nur dieser Key.
UPDATE public.landing_pages
SET content = content - 'lp_design_package'
WHERE content ? 'lp_design_package';

-- 3. Default lp_layout setzen, falls keiner existiert (Overrides bleiben).
UPDATE public.landing_pages
SET content = jsonb_set(content, '{lp_layout}', '"classic-hero"', true)
WHERE NOT (content ? 'lp_layout');
