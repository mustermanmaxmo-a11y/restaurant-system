-- Premium Template Library: 5 startup-level restaurant templates
-- Each config sets all design tokens including the new hero_layout field

INSERT INTO public.design_templates (name, slug, category, config, plan_tier, style_tags, sort_order)
VALUES
  (
    'Rustico',
    'premium-rustico',
    'italian',
    '{
      "bg_color": "#F5EDE0",
      "surface_color": "#FFFFFF",
      "header_color": "#3D2010",
      "primary_color": "#C4622D",
      "button_color": "#C4622D",
      "card_color": "#FFFFFF",
      "text_color": "#3D2010",
      "font_pair": "playfair-lato",
      "layout_variant": "cards",
      "hero_layout": "classic-overlay",
      "border_radius": "rounded",
      "hover_effect": "scale",
      "animation_style": "fade",
      "card_style": "elevated"
    }',
    'free',
    ARRAY['warm', 'italian', 'classic', 'family'],
    100
  ),
  (
    'Strada',
    'premium-strada',
    'fastcasual',
    '{
      "bg_color": "#111111",
      "surface_color": "#1E1E1E",
      "header_color": "#111111",
      "primary_color": "#FF3B30",
      "button_color": "#FF3B30",
      "card_color": "#1E1E1E",
      "text_color": "#FFFFFF",
      "font_pair": "space-dmsans",
      "layout_variant": "large-cards",
      "hero_layout": "bold-statement",
      "border_radius": "rounded",
      "hover_effect": "glow",
      "animation_style": "slide",
      "card_style": "elevated"
    }',
    'free',
    ARRAY['dark', 'bold', 'burger', 'street-food', 'energetic'],
    101
  ),
  (
    'Bianco',
    'premium-bianco',
    'japanese',
    '{
      "bg_color": "#FAFAFA",
      "surface_color": "#FFFFFF",
      "header_color": "#FFFFFF",
      "primary_color": "#111111",
      "button_color": "#111111",
      "card_color": "#FFFFFF",
      "text_color": "#111111",
      "font_pair": "inter-inter",
      "layout_variant": "list",
      "hero_layout": "split",
      "border_radius": "sharp",
      "hover_effect": "underline",
      "animation_style": "fade",
      "card_style": "flat"
    }',
    'pro',
    ARRAY['minimal', 'sushi', 'fine-dining', 'white', 'elegant'],
    102
  ),
  (
    'Natura',
    'premium-natura',
    'vegan',
    '{
      "bg_color": "#F0F4EC",
      "surface_color": "#FFFFFF",
      "header_color": "#F0F4EC",
      "primary_color": "#2D5016",
      "button_color": "#2D5016",
      "card_color": "#FFFFFF",
      "text_color": "#2D5016",
      "font_pair": "syne-dmsans",
      "layout_variant": "cards",
      "hero_layout": "centered-minimal",
      "border_radius": "pill",
      "hover_effect": "scale",
      "animation_style": "fade",
      "card_style": "outlined"
    }',
    'free',
    ARRAY['green', 'vegan', 'organic', 'minimal', 'bowl'],
    103
  ),
  (
    'Vibrante',
    'premium-vibrante',
    'asian',
    '{
      "bg_color": "#0D0D1A",
      "surface_color": "#1A1A2E",
      "header_color": "#0D0D1A",
      "primary_color": "#A855F7",
      "button_color": "#A855F7",
      "card_color": "#1A1A2E",
      "text_color": "#FFFFFF",
      "accent_secondary": "#FF6B6B",
      "font_pair": "space-dmsans",
      "layout_variant": "grid",
      "hero_layout": "gradient-glow",
      "border_radius": "rounded",
      "hover_effect": "glow",
      "animation_style": "slide",
      "card_style": "ghost"
    }',
    'free',
    ARRAY['dark', 'neon', 'ramen', 'asian', 'gradient', 'night'],
    104
  )
ON CONFLICT (slug) DO UPDATE SET
  name       = EXCLUDED.name,
  category   = EXCLUDED.category,
  config     = EXCLUDED.config,
  plan_tier  = EXCLUDED.plan_tier,
  style_tags = EXCLUDED.style_tags,
  sort_order = EXCLUDED.sort_order;
