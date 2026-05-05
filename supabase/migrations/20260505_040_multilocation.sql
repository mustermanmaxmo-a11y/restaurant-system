-- Feature #12: Multi-Location One-View

-- Manager-Rolle für Standort-Manager (sehen nur ihr eigenes Restaurant via RLS)
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS role_level text DEFAULT 'staff'
  CHECK (role_level IN ('staff', 'manager'));
