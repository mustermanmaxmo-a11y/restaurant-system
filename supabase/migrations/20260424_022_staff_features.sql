-- Add source column to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'guest'
    CHECK (source IN ('guest', 'staff'));

-- Add occupied_manual and occupied_since columns to tables table
ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS occupied_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS occupied_since timestamptz;

-- Enable Realtime for tables (if not already published)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tables'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
  END IF;
END $$;
