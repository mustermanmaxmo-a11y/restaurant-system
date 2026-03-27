-- RestaurantOS RLS Policies
-- Run AFTER 20260327_001_schema.sql in the Supabase SQL Editor

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
alter table public.restaurants enable row level security;
alter table public.staff enable row level security;
alter table public.tables enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.service_calls enable row level security;

-- ============================================================
-- HELPER FUNCTION
-- Returns the restaurant_id owned by the currently logged-in user.
-- Used in RLS policies to scope data to the owner's restaurant.
-- ============================================================
create or replace function public.get_owner_restaurant_id()
returns uuid language sql security definer stable as $$
  select id from public.restaurants where owner_id = auth.uid() limit 1;
$$;

-- ============================================================
-- RESTAURANTS
-- ============================================================
-- Owner can read and update their own restaurant
create policy "restaurants_owner_select" on public.restaurants
  for select using (owner_id = auth.uid());

create policy "restaurants_owner_update" on public.restaurants
  for update using (owner_id = auth.uid());

-- Anyone can insert (self-service registration flow)
create policy "restaurants_anyone_insert" on public.restaurants
  for insert with check (true);

-- ============================================================
-- STAFF
-- ============================================================
-- Owner manages their staff
create policy "staff_owner_all" on public.staff
  for all using (restaurant_id = get_owner_restaurant_id());

-- Anon can read staff for PIN validation (queries always filter by restaurant_id)
-- NOTE: intentionally permissive — tighten before production if needed
create policy "staff_anon_select" on public.staff
  for select using (true);

-- ============================================================
-- TABLES
-- ============================================================
-- Owner manages their tables
create policy "tables_owner_all" on public.tables
  for all using (restaurant_id = get_owner_restaurant_id());

-- Anon can read tables for QR token validation
create policy "tables_anon_select" on public.tables
  for select using (true);

-- ============================================================
-- MENU CATEGORIES
-- ============================================================
-- Owner manages their categories
create policy "menu_categories_owner_all" on public.menu_categories
  for all using (restaurant_id = get_owner_restaurant_id());

-- Anyone can read categories (guest menu display)
create policy "menu_categories_anyone_select" on public.menu_categories
  for select using (true);

-- ============================================================
-- MENU ITEMS
-- ============================================================
-- Owner manages their menu items
create policy "menu_items_owner_all" on public.menu_items
  for all using (restaurant_id = get_owner_restaurant_id());

-- Anyone can read menu items (guest menu display)
create policy "menu_items_anyone_select" on public.menu_items
  for select using (true);

-- ============================================================
-- ORDERS
-- ============================================================
-- Owner has full access to their restaurant's orders
create policy "orders_owner_all" on public.orders
  for all using (restaurant_id = get_owner_restaurant_id());

-- Anon (guest) can insert orders
create policy "orders_anon_insert" on public.orders
  for insert with check (true);

-- Anon can read orders (for guest order status tracking)
-- Queries must filter by id (known to guest from their session)
create policy "orders_anon_select" on public.orders
  for select using (true);

-- ============================================================
-- SERVICE CALLS
-- ============================================================
-- Owner has full access to their restaurant's service calls
create policy "service_calls_owner_all" on public.service_calls
  for all using (restaurant_id = get_owner_restaurant_id());

-- Anon (guest) can insert service calls (waiter/bill requests)
create policy "service_calls_anon_insert" on public.service_calls
  for insert with check (true);

-- Anon can read service calls (for status display)
create policy "service_calls_anon_select" on public.service_calls
  for select using (true);
