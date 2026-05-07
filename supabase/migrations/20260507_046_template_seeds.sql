-- Design Template Library Seeds: 8 existing design packages + 42 new curated templates
-- Idempotent via ON CONFLICT (slug) DO NOTHING

-- ─────────────────────────────────────────────────────────────────
-- EXISTING 8 (migrated from lib/design-packages.ts)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Modern Classic', 'modern-classic', 'fast-food', ARRAY['dark','orange','timeless'], 'basic', null,
 '{"primary_color":"#FF6B2C","bg_color":"#080808","surface_color":"#131313","header_color":"#080808","button_color":"#FF6B2C","card_color":"#131313","text_color":"#f0ede8","font_pair":"syne-dmsans","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 10) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Elegant Gold', 'elegant-gold', 'fine-dining', ARRAY['dark','gold','luxury'], 'pro', null,
 '{"primary_color":"#C9A84C","bg_color":"#0a0b14","surface_color":"#12132a","header_color":"#08091a","button_color":"#C9A84C","card_color":"#12132a","text_color":"#e8e4d8","font_pair":"playfair-lato","layout_variant":"list","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 20) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Minimalist Light', 'minimalist-light', 'scandinavian', ARRAY['light','clean','minimal'], 'basic', null,
 '{"primary_color":"#2C2C2C","bg_color":"#FAFAF8","surface_color":"#FFFFFF","header_color":"#FFFFFF","button_color":"#111111","card_color":"#F5F5F3","text_color":"#1a1a1a","font_pair":"inter-inter","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 30) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Bold Street', 'bold-street', 'street-food', ARRAY['dark','neon','energetic'], 'basic', null,
 '{"primary_color":"#FF3D00","bg_color":"#0a0a0a","surface_color":"#141414","header_color":"#0a0a0a","button_color":"#FF3D00","card_color":"#141414","text_color":"#ffffff","font_pair":"space-dmsans","layout_variant":"large-cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 40) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Warm Trattoria', 'warm-trattoria', 'italian', ARRAY['warm','terracotta','rustic'], 'basic', null,
 '{"primary_color":"#C75B39","bg_color":"#FDF8F0","surface_color":"#FFF9F2","header_color":"#3D2214","button_color":"#C75B39","card_color":"#FFF4E8","text_color":"#2C1810","font_pair":"merriweather-source","layout_variant":"list","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 50) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Zen Garden', 'zen-garden', 'asian', ARRAY['dark','pink','japanese'], 'pro', null,
 '{"primary_color":"#D4627A","bg_color":"#0c0c0e","surface_color":"#161618","header_color":"#0c0c0e","button_color":"#D4627A","card_color":"#161618","text_color":"#e8e4e0","font_pair":"noto-noto","layout_variant":"grid","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 60) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Biergarten Fresh', 'biergarten-fresh', 'bavarian', ARRAY['dark','amber','green'], 'basic', null,
 '{"primary_color":"#F5A623","bg_color":"#0a0d08","surface_color":"#141a10","header_color":"#0a0d08","button_color":"#F5A623","card_color":"#141a10","text_color":"#f0ede4","font_pair":"syne-dmsans","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 70) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Neon Nights', 'neon-nights', 'bar', ARRAY['dark','purple','cocktails'], 'pro', null,
 '{"primary_color":"#B44AFF","bg_color":"#08080c","surface_color":"#121218","header_color":"#08080c","button_color":"#B44AFF","card_color":"#121218","text_color":"#ede8f4","font_pair":"space-dmsans","layout_variant":"large-cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 80) ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- NEW: FAST FOOD (6)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Neon Burger', 'neon-burger', 'fast-food', ARRAY['dark','yellow','sharp'], 'basic', null,
 '{"primary_color":"#FFCC00","bg_color":"#060606","surface_color":"#0f0f0f","header_color":"#060606","button_color":"#FFCC00","card_color":"#0f0f0f","text_color":"#ffffff","font_pair":"space-dmsans","layout_variant":"large-cards","border_radius":"sharp","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 90) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Street Glow', 'street-glow', 'fast-food', ARRAY['dark','cyan','glow'], 'basic', null,
 '{"primary_color":"#00E5FF","bg_color":"#03040a","surface_color":"#0a0c18","header_color":"#03040a","button_color":"#00E5FF","card_color":"#0a0c18","text_color":"#e8f4ff","font_pair":"space-dmsans","layout_variant":"large-cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 100) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Urban Bite', 'urban-bite', 'fast-food', ARRAY['dark','orange','urban'], 'basic', null,
 '{"primary_color":"#FF6B00","bg_color":"#0d0d0d","surface_color":"#1a1a1a","header_color":"#0d0d0d","button_color":"#FF6B00","card_color":"#1a1a1a","text_color":"#f0ede8","font_pair":"syne-dmsans","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 110) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Quick Red', 'quick-red', 'fast-food', ARRAY['dark','red','bold'], 'basic', null,
 '{"primary_color":"#FF1744","bg_color":"#0a0000","surface_color":"#150000","header_color":"#0a0000","button_color":"#FF1744","card_color":"#150000","text_color":"#fff5f5","font_pair":"space-dmsans","layout_variant":"large-cards","border_radius":"sharp","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 120) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Bright Counter', 'bright-counter', 'fast-food', ARRAY['light','orange','clean'], 'basic', null,
 '{"primary_color":"#F7931E","bg_color":"#FFFEF5","surface_color":"#FFFFFF","header_color":"#FFFFFF","button_color":"#F7931E","card_color":"#FFF8E8","text_color":"#111111","font_pair":"inter-inter","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 130) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Midnight Burger', 'midnight-burger', 'fast-food', ARRAY['dark','blue','premium'], 'pro', null,
 '{"primary_color":"#0066FF","bg_color":"#000814","surface_color":"#001428","header_color":"#000814","button_color":"#0066FF","card_color":"#001428","text_color":"#e8f0ff","font_pair":"space-dmsans","layout_variant":"grid","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 140) ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- NEW: FINE DINING (8)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Nobu Dark', 'nobu-dark', 'fine-dining', ARRAY['dark','beige','minimal'], 'premium', null,
 '{"primary_color":"#C8B89A","bg_color":"#050505","surface_color":"#0d0d0d","header_color":"#000000","button_color":"#C8B89A","card_color":"#0d0d0d","text_color":"#E8E0D0","font_pair":"playfair-lato","layout_variant":"list","border_radius":"sharp","hover_effect":"scale","animation_style":"fade","card_style":"flat"}'::jsonb,
 150) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Midnight Luxe', 'midnight-luxe', 'fine-dining', ARRAY['dark','purple','luxury'], 'premium', null,
 '{"primary_color":"#8B7AF5","bg_color":"#04040c","surface_color":"#0c0c1a","header_color":"#04040c","button_color":"#8B7AF5","card_color":"#0c0c1a","text_color":"#ede8f8","font_pair":"playfair-lato","layout_variant":"list","border_radius":"sharp","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 160) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Pearl White', 'pearl-white', 'fine-dining', ARRAY['light','gold','elegant'], 'pro', null,
 '{"primary_color":"#8B6914","bg_color":"#F8F7F5","surface_color":"#FFFFFF","header_color":"#1a1a1a","button_color":"#8B6914","card_color":"#FFFFFF","text_color":"#1a1a1a","font_pair":"playfair-lato","layout_variant":"list","border_radius":"sharp","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 170) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Velvet Black', 'velvet-black', 'fine-dining', ARRAY['dark','warm','sophisticated'], 'premium', null,
 '{"primary_color":"#E8C5A0","bg_color":"#050505","surface_color":"#0f0f0f","header_color":"#050505","button_color":"#E8C5A0","card_color":"#0f0f0f","text_color":"#f0e8d8","font_pair":"merriweather-source","layout_variant":"list","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"outlined"}'::jsonb,
 180) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Grand Table', 'grand-table', 'fine-dining', ARRAY['dark','gold','classic'], 'pro', null,
 '{"primary_color":"#D4AF37","bg_color":"#060810","surface_color":"#0e1020","header_color":"#060810","button_color":"#D4AF37","card_color":"#0e1020","text_color":"#ede4c8","font_pair":"playfair-lato","layout_variant":"list","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 190) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Ivory Prestige', 'ivory-prestige', 'fine-dining', ARRAY['light','brown','refined'], 'pro', null,
 '{"primary_color":"#6B4C2A","bg_color":"#FDFAF5","surface_color":"#FFFFFF","header_color":"#FFFFFF","button_color":"#6B4C2A","card_color":"#FFFFFF","text_color":"#2a1a0a","font_pair":"merriweather-source","layout_variant":"list","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 200) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Slate Fine', 'slate-fine', 'fine-dining', ARRAY['dark','slate','modern'], 'pro', null,
 '{"primary_color":"#E8D5B7","bg_color":"#1a1a1f","surface_color":"#252530","header_color":"#1a1a1f","button_color":"#E8D5B7","card_color":"#252530","text_color":"#e8e4d8","font_pair":"playfair-lato","layout_variant":"list","border_radius":"sharp","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 210) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Copper Luxe', 'copper-luxe', 'fine-dining', ARRAY['dark','copper','exclusive'], 'premium', null,
 '{"primary_color":"#B87333","bg_color":"#080603","surface_color":"#110e09","header_color":"#080603","button_color":"#B87333","card_color":"#110e09","text_color":"#f0e4d4","font_pair":"playfair-lato","layout_variant":"list","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 220) ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- NEW: CASUAL (7)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Warm Casual', 'warm-casual', 'casual', ARRAY['light','warm','friendly'], 'basic', null,
 '{"primary_color":"#E8673A","bg_color":"#FFF8F0","surface_color":"#FFFFFF","header_color":"#FFFFFF","button_color":"#E8673A","card_color":"#FFF4E8","text_color":"#2a1a10","font_pair":"merriweather-source","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 230) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Sunny Bistro', 'sunny-bistro', 'casual', ARRAY['light','yellow','cheerful'], 'basic', null,
 '{"primary_color":"#F4C430","bg_color":"#FFFEF7","surface_color":"#FFFFFF","header_color":"#FFFFFF","button_color":"#F4C430","card_color":"#FFFCEB","text_color":"#2C2000","font_pair":"inter-inter","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 240) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Fresh Garden', 'fresh-garden', 'casual', ARRAY['light','green','natural'], 'basic', null,
 '{"primary_color":"#2D8A4E","bg_color":"#F5FFF5","surface_color":"#FFFFFF","header_color":"#FFFFFF","button_color":"#2D8A4E","card_color":"#EFFBEF","text_color":"#0a2210","font_pair":"inter-inter","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 250) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Linen Breeze', 'linen-breeze', 'casual', ARRAY['light','beige','soft'], 'basic', null,
 '{"primary_color":"#9B7653","bg_color":"#FAF7F0","surface_color":"#FFFFFF","header_color":"#FFFFFF","button_color":"#9B7653","card_color":"#FBF7EE","text_color":"#2a1f10","font_pair":"merriweather-source","layout_variant":"list","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 260) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Terracotta', 'terracotta', 'casual', ARRAY['light','orange','rustic'], 'basic', null,
 '{"primary_color":"#C85A2E","bg_color":"#FFF5EE","surface_color":"#FFFFFF","header_color":"#FFFFFF","button_color":"#C85A2E","card_color":"#FFEBDC","text_color":"#2a0f05","font_pair":"merriweather-source","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 270) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Soft Oak', 'soft-oak', 'casual', ARRAY['light','wood','warm'], 'pro', null,
 '{"primary_color":"#7D5A3C","bg_color":"#F5F0E8","surface_color":"#FFFFFF","header_color":"#FFFFFF","button_color":"#7D5A3C","card_color":"#F8F2E6","text_color":"#2a1a08","font_pair":"merriweather-source","layout_variant":"list","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 280) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Pebble Grey', 'pebble-grey', 'casual', ARRAY['light','grey','neutral'], 'basic', null,
 '{"primary_color":"#6B6B6B","bg_color":"#F2F2F0","surface_color":"#FFFFFF","header_color":"#FFFFFF","button_color":"#6B6B6B","card_color":"#FAFAF8","text_color":"#1a1a1a","font_pair":"inter-inter","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 290) ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- NEW: BAR & COCKTAIL (5)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Dark Pour', 'dark-pour', 'bar', ARRAY['dark','orange','bar'], 'pro', null,
 '{"primary_color":"#FF7043","bg_color":"#060408","surface_color":"#100c14","header_color":"#060408","button_color":"#FF7043","card_color":"#100c14","text_color":"#f0e8e0","font_pair":"space-dmsans","layout_variant":"large-cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 300) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Amber Glow', 'amber-glow', 'bar', ARRAY['dark','amber','warm'], 'basic', null,
 '{"primary_color":"#FF8C00","bg_color":"#050302","surface_color":"#0f0905","header_color":"#050302","button_color":"#FF8C00","card_color":"#0f0905","text_color":"#f0e0c8","font_pair":"syne-dmsans","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 310) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Smoke & Oak', 'smoke-oak', 'bar', ARRAY['dark','wood','whisky'], 'pro', null,
 '{"primary_color":"#D2691E","bg_color":"#0a0806","surface_color":"#181410","header_color":"#0a0806","button_color":"#D2691E","card_color":"#181410","text_color":"#f0e4d0","font_pair":"merriweather-source","layout_variant":"list","border_radius":"sharp","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 320) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Crimson Bar', 'crimson-bar', 'bar', ARRAY['dark','crimson','bold'], 'pro', null,
 '{"primary_color":"#CC0044","bg_color":"#08000a","surface_color":"#140014","header_color":"#08000a","button_color":"#CC0044","card_color":"#140014","text_color":"#f4e0e8","font_pair":"space-dmsans","layout_variant":"large-cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 330) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Ice Blue', 'ice-blue', 'bar', ARRAY['dark','blue','cool'], 'basic', null,
 '{"primary_color":"#00B4D8","bg_color":"#040810","surface_color":"#080d1a","header_color":"#040810","button_color":"#00B4D8","card_color":"#080d1a","text_color":"#e0f0f8","font_pair":"inter-inter","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 340) ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- NEW: CAFÉ (5)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Morning Brew', 'morning-brew', 'cafe', ARRAY['light','coffee','cozy'], 'basic', null,
 '{"primary_color":"#6F4E37","bg_color":"#FFF9F0","surface_color":"#FFFFFF","header_color":"#FFFFFF","button_color":"#6F4E37","card_color":"#FFF4E0","text_color":"#2a1205","font_pair":"merriweather-source","layout_variant":"list","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 350) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Cream Latte', 'cream-latte', 'cafe', ARRAY['light','cream','soft'], 'basic', null,
 '{"primary_color":"#C8956C","bg_color":"#FAF7F2","surface_color":"#FFFFFF","header_color":"#FFFFFF","button_color":"#C8956C","card_color":"#FBF6EC","text_color":"#2a1408","font_pair":"inter-inter","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 360) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Nordic Café', 'nordic-cafe', 'cafe', ARRAY['light','green','nordic'], 'pro', null,
 '{"primary_color":"#2C4A3E","bg_color":"#F7F7F5","surface_color":"#FFFFFF","header_color":"#FFFFFF","button_color":"#2C4A3E","card_color":"#F1F4F0","text_color":"#0a1a14","font_pair":"inter-inter","layout_variant":"list","border_radius":"sharp","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 370) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Roast Brown', 'roast-brown', 'cafe', ARRAY['dark','brown','rich'], 'basic', null,
 '{"primary_color":"#C87941","bg_color":"#0d0804","surface_color":"#1a120a","header_color":"#0d0804","button_color":"#C87941","card_color":"#1a120a","text_color":"#f0e0c8","font_pair":"syne-dmsans","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 380) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Milk Foam', 'milk-foam', 'cafe', ARRAY['light','gold','airy'], 'basic', null,
 '{"primary_color":"#B8860B","bg_color":"#FDFCFA","surface_color":"#FFFFFF","header_color":"#FFFFFF","button_color":"#B8860B","card_color":"#FDF8E6","text_color":"#1a1205","font_pair":"inter-inter","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 390) ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- NEW: ASIAN (5)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Tokyo Minimal', 'tokyo-minimal', 'asian', ARRAY['dark','pink','minimal'], 'pro', null,
 '{"primary_color":"#FF3366","bg_color":"#060609","surface_color":"#0f0f14","header_color":"#060609","button_color":"#FF3366","card_color":"#0f0f14","text_color":"#f0e8ec","font_pair":"noto-noto","layout_variant":"grid","border_radius":"sharp","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 400) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Red Lantern', 'red-lantern', 'asian', ARRAY['dark','red','traditional'], 'basic', null,
 '{"primary_color":"#CC2200","bg_color":"#080202","surface_color":"#140505","header_color":"#080202","button_color":"#CC2200","card_color":"#140505","text_color":"#f4dcdc","font_pair":"noto-noto","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 410) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Soy Dark', 'soy-dark', 'asian', ARRAY['dark','gold','umami'], 'basic', null,
 '{"primary_color":"#E8A000","bg_color":"#050403","surface_color":"#0f0c09","header_color":"#050403","button_color":"#E8A000","card_color":"#0f0c09","text_color":"#f0e4c8","font_pair":"noto-noto","layout_variant":"list","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 420) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Sakura Pink', 'sakura-pink', 'asian', ARRAY['light','pink','spring'], 'basic', null,
 '{"primary_color":"#D4627A","bg_color":"#FFF5F7","surface_color":"#FFFFFF","header_color":"#FFFFFF","button_color":"#D4627A","card_color":"#FFEBEF","text_color":"#2a0a10","font_pair":"noto-noto","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 430) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Jade Green', 'jade-green', 'asian', ARRAY['dark','green','jade'], 'pro', null,
 '{"primary_color":"#00A86B","bg_color":"#040c08","surface_color":"#0a1610","header_color":"#040c08","button_color":"#00A86B","card_color":"#0a1610","text_color":"#d8f0e0","font_pair":"noto-noto","layout_variant":"grid","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 440) ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- NEW: ITALIAN (4)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Olive Grove', 'olive-grove', 'italian', ARRAY['light','green','olive'], 'basic', null,
 '{"primary_color":"#6B7C2D","bg_color":"#F8F5E8","surface_color":"#FFFFFF","header_color":"#FFFFFF","button_color":"#6B7C2D","card_color":"#F4F1DC","text_color":"#1a1e05","font_pair":"merriweather-source","layout_variant":"list","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 450) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Pasta Red', 'pasta-red', 'italian', ARRAY['light','red','classic'], 'basic', null,
 '{"primary_color":"#C0392B","bg_color":"#FFF0EE","surface_color":"#FFFFFF","header_color":"#FFFFFF","button_color":"#C0392B","card_color":"#FFE4E0","text_color":"#2a0808","font_pair":"merriweather-source","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 460) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Chianti Dark', 'chianti-dark', 'italian', ARRAY['dark','wine','romantic'], 'pro', null,
 '{"primary_color":"#8B1A38","bg_color":"#080205","surface_color":"#14060c","header_color":"#080205","button_color":"#8B1A38","card_color":"#14060c","text_color":"#f0d8e0","font_pair":"merriweather-source","layout_variant":"list","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 470) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Napoli Sun', 'napoli-sun', 'italian', ARRAY['light','yellow','sunny'], 'basic', null,
 '{"primary_color":"#FFB800","bg_color":"#FFFEF0","surface_color":"#FFFFFF","header_color":"#FFFFFF","button_color":"#FFB800","card_color":"#FFFAE0","text_color":"#1a1600","font_pair":"inter-inter","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 480) ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- NEW: GERMAN/BAVARIAN (2)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Alpine Wood', 'alpine-wood', 'bavarian', ARRAY['dark','wood','traditional'], 'basic', null,
 '{"primary_color":"#8B6914","bg_color":"#0d0a06","surface_color":"#1a1408","header_color":"#0d0a06","button_color":"#8B6914","card_color":"#1a1408","text_color":"#f0e4c8","font_pair":"syne-dmsans","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 490) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.design_templates (name, slug, category, style_tags, plan_tier, preview_url, config, sort_order) VALUES
('Munich Dark', 'munich-dark', 'bavarian', ARRAY['dark','copper','urban'], 'pro', null,
 '{"primary_color":"#C87941","bg_color":"#060606","surface_color":"#101010","header_color":"#060606","button_color":"#C87941","card_color":"#101010","text_color":"#f0e0c8","font_pair":"syne-dmsans","layout_variant":"cards","border_radius":"rounded","hover_effect":"scale","animation_style":"fade","card_style":"elevated"}'::jsonb,
 500) ON CONFLICT (slug) DO NOTHING;
