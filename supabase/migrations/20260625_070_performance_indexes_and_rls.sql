-- Performance indexes for high-traffic core tables
-- All core tables were missing restaurant_id indexes — every KDS/menu query did a full scan

create index if not exists orders_restaurant_status_idx
  on public.orders (restaurant_id, status, created_at desc);

create index if not exists menu_items_restaurant_active_idx
  on public.menu_items (restaurant_id, available);

create index if not exists menu_categories_restaurant_sort_idx
  on public.menu_categories (restaurant_id, sort_order);

create index if not exists marketing_subscribers_restaurant_email_idx
  on public.marketing_subscribers (restaurant_id, email);

-- RLS for tables that were missing it

alter table public.pos_oauth_states enable row level security;
create policy "pos_oauth_states_owner_all" on public.pos_oauth_states
  for all using (restaurant_id = get_owner_restaurant_id());

alter table public.shift_plans enable row level security;
create policy "shift_plans_owner_all" on public.shift_plans
  for all using (restaurant_id = get_owner_restaurant_id());

alter table public.staff_presence enable row level security;
create policy "staff_presence_owner_all" on public.staff_presence
  for all using (restaurant_id = get_owner_restaurant_id());
