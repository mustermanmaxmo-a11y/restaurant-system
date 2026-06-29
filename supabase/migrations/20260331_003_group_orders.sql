-- Group ordering: shared cart for multiple guests at a table

create table public.order_groups (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  table_id uuid references public.tables(id) on delete set null,
  group_code text not null unique,
  status text not null default 'active' check (status in ('active', 'submitted', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours')
);

create table public.group_items (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references public.order_groups(id) on delete cascade not null,
  added_by text not null,
  item_id text not null,
  name text not null,
  price numeric(10,2) not null,
  qty integer not null default 1,
  note text,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.order_groups enable row level security;
alter table public.group_items enable row level security;

-- Public access via group_code (acts as access token)
create policy "Public read order_groups" on public.order_groups for select using (true);
create policy "Public insert order_groups" on public.order_groups for insert with check (true);
create policy "Public update order_groups" on public.order_groups for update using (true);

create policy "Public read group_items" on public.group_items for select using (true);
create policy "Public insert group_items" on public.group_items for insert with check (true);
create policy "Public delete group_items" on public.group_items for delete using (true);

-- Realtime
alter publication supabase_realtime add table public.group_items;
alter publication supabase_realtime add table public.order_groups;
