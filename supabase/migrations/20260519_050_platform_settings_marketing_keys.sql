-- Add marketing API key columns to platform_settings
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS fal_api_key text;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS kling_api_key text;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS marketing_automation_secret text;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS unsubscribe_secret text;
