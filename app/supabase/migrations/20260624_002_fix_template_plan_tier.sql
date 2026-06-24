-- Fix plan_tier for premium templates: 'free' is not a recognized tier in allowedTiersForPlan().
-- The access check allows ['basic','pro','premium'] depending on restaurant plan.
-- Setting to 'basic' makes these templates accessible to all paying plans (starter/basic/pro/enterprise).
-- Bianco stays 'pro' as intended (fine dining / premium positioning).

UPDATE public.design_templates
SET plan_tier = 'basic'
WHERE slug IN ('premium-rustico', 'premium-strada', 'premium-natura', 'premium-vibrante')
  AND plan_tier = 'free';
