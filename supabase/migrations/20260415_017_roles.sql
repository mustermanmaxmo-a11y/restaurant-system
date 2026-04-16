-- ============================================================
-- ROLLEN-SYSTEM — restaurant_members
-- Ermöglicht mehrere Admins/Manager pro Restaurant
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. ENUM für Rollen ────────────────────────────────────────
do $$ begin
  create type public.member_role as enum (
    'owner',    -- Vollzugriff, kann alles
    'manager',  -- Vollzugriff außer Billing & Konto löschen
    'viewer'    -- Nur lesen (Stats, Bestellungen)
  );
exception when duplicate_object then null;
end $$;

-- ── 2. Tabelle restaurant_members ────────────────────────────
create table if not exists public.restaurant_members (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  user_id       uuid references auth.users(id) on delete cascade not null,
  role          public.member_role not null default 'manager',
  invited_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique(restaurant_id, user_id)
);

-- ── 3. Owner automatisch als Member eintragen ─────────────────
-- Bestehende Restaurants: Owner bekommt Rolle 'owner'
insert into public.restaurant_members (restaurant_id, user_id, role)
select id, owner_id, 'owner'
from public.restaurants
where owner_id is not null
on conflict (restaurant_id, user_id) do nothing;

-- ── 4. Trigger: neues Restaurant → Owner automatisch eintragen ─
create or replace function public.add_owner_as_member()
returns trigger language plpgsql security definer as $$
begin
  insert into public.restaurant_members (restaurant_id, user_id, role)
  values (NEW.id, NEW.owner_id, 'owner')
  on conflict (restaurant_id, user_id) do nothing;
  return NEW;
end;
$$;

drop trigger if exists on_restaurant_created on public.restaurants;
create trigger on_restaurant_created
  after insert on public.restaurants
  for each row execute function public.add_owner_as_member();

-- ── 5. Helper-Function: Rolle des aktuellen Users ─────────────
create or replace function public.get_my_role(p_restaurant_id uuid)
returns public.member_role language sql security definer stable as $$
  select role from public.restaurant_members
  where restaurant_id = p_restaurant_id
    and user_id = auth.uid()
  limit 1;
$$;

-- ── 6. RLS aktivieren + Policies ──────────────────────────────
alter table public.restaurant_members enable row level security;

-- Owner und Manager sehen alle Members ihres Restaurants
create policy "members_read" on public.restaurant_members
  for select using (
    restaurant_id in (
      select restaurant_id from public.restaurant_members
      where user_id = auth.uid()
    )
  );

-- Nur Owner kann neue Members einladen / löschen
create policy "members_owner_write" on public.restaurant_members
  for all using (
    get_my_role(restaurant_id) = 'owner'
  );
