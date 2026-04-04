-- Daily Specials
-- Admin kann Gerichte als Tagesangebot markieren (Label, Rabattpreis, KI-Notiz)

create table if not exists public.daily_specials (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  menu_item_id  uuid not null references public.menu_items(id) on delete cascade,
  label         text not null default 'Tagesgericht',
  special_price numeric(10,2),        -- null = Originalpreis beibehalten
  note          text,                 -- KI-Kontext: z.B. "Heute besonders frisch"
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique(restaurant_id, menu_item_id)
);

create index if not exists idx_daily_specials_restaurant on public.daily_specials(restaurant_id);

alter table public.daily_specials enable row level security;

-- Owner: voller Zugriff
drop policy if exists "daily_specials_owner" on public.daily_specials;
create policy "daily_specials_owner" on public.daily_specials
  for all using (restaurant_id = get_owner_restaurant_id());

-- Gäste: dürfen aktive Specials lesen (für Bestellseiten)
drop policy if exists "daily_specials_public_read" on public.daily_specials;
create policy "daily_specials_public_read" on public.daily_specials
  for select to anon using (active = true);
