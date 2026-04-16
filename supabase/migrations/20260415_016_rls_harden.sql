-- ============================================================
-- RLS HARDENING — Phase 2 Security Fixes
-- Run in Supabase SQL Editor after 20260402_004_security_fixes.sql
-- ============================================================

-- ── 1. SERVICE CALLS: remove anon select (guests only INSERT, never read back) ─
-- Guests call the waiter by inserting a row — they never poll the result.
-- The staff dashboard reads service_calls as authenticated owner.
drop policy if exists "service_calls_anon_select" on public.service_calls;

-- ── 2. RESERVATIONS: keep anon select (needed for table availability display)  ─
-- but scope to active restaurants only to prevent full enumeration.
-- NOTE: the app only selects non-PII fields (id, table_id, date, time_from, guests, status)
drop policy if exists "reservations_anon_select" on public.reservations;

create policy "reservations_anon_select" on public.reservations
  for select using (
    restaurant_id in (
      select id from public.restaurants where active = true
    )
  );

-- ── 3. ORDER GROUPS: scope anon select to active restaurants ──────────────────
drop policy if exists "order_groups_anon_select" on public.order_groups;

create policy "order_groups_anon_select" on public.order_groups
  for select using (
    restaurant_id in (
      select id from public.restaurants where active = true
    )
  );

-- ── 4. GROUP ITEMS: scope anon select via order_groups restaurant check ────────
-- group_items don't have restaurant_id directly, but link via order_group
drop policy if exists "group_items_anon_select" on public.group_items;

create policy "group_items_anon_select" on public.group_items
  for select using (
    group_id in (
      select og.id from public.order_groups og
      join public.restaurants r on r.id = og.restaurant_id
      where r.active = true
    )
  );

-- ── 5. MENU CATEGORIES / ITEMS: scope to active restaurants ───────────────────
-- Previously `using (true)` — now only shows menus of active restaurants.
drop policy if exists "menu_categories_anyone_select" on public.menu_categories;
drop policy if exists "menu_items_anyone_select" on public.menu_items;

create policy "menu_categories_anyone_select" on public.menu_categories
  for select using (
    restaurant_id in (
      select id from public.restaurants where active = true
    )
  );

create policy "menu_items_anyone_select" on public.menu_items
  for select using (
    restaurant_id in (
      select id from public.restaurants where active = true
    )
  );

-- ── 6. TABLES: scope to active restaurants ────────────────────────────────────
drop policy if exists "tables_anon_select" on public.tables;

create policy "tables_anon_select" on public.tables
  for select using (
    restaurant_id in (
      select id from public.restaurants where active = true
    )
  );
