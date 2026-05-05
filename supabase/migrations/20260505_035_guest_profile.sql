-- Feature #7: Gast-Gedächtnis / Profil

ALTER TABLE public.loyalty_members
  ADD COLUMN IF NOT EXISTS dietary_preferences text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS favorite_item_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS data_download_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;
