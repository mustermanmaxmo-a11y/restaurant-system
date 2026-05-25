-- Explicit Data API grants (required from Supabase May 30 / Oct 30 2026)
-- anon = unauthenticated guests, authenticated = logged-in users/staff, service_role = backend

-- ============================================================
-- GUEST-FACING TABLES (anon can read + insert, RLS restricts rows)
-- ============================================================

-- restaurants: guests need to load restaurant info via QR slug
grant select on public.restaurants to anon;
grant select, insert, update, delete on public.restaurants to authenticated;
grant all on public.restaurants to service_role;

-- tables: guests validate their QR token
grant select on public.tables to anon;
grant select, insert, update, delete on public.tables to authenticated;
grant all on public.tables to service_role;

-- menu_categories + menu_items: guests browse the menu
grant select on public.menu_categories to anon;
grant select, insert, update, delete on public.menu_categories to authenticated;
grant all on public.menu_categories to service_role;

grant select on public.menu_items to anon;
grant select, insert, update, delete on public.menu_items to authenticated;
grant all on public.menu_items to service_role;

-- orders: guests place orders (INSERT) + poll status (SELECT via RLS token)
grant select, insert on public.orders to anon;
grant select, insert, update, delete on public.orders to authenticated;
grant all on public.orders to service_role;

-- service_calls: guests call waiter / request bill
grant select, insert on public.service_calls to anon;
grant select, insert, update, delete on public.service_calls to authenticated;
grant all on public.service_calls to service_role;

-- order_ratings: guests can rate their order
grant insert on public.order_ratings to anon;
grant select, insert, update, delete on public.order_ratings to authenticated;
grant all on public.order_ratings to service_role;

-- daily_specials: guests can see daily specials
grant select on public.daily_specials to anon;
grant select, insert, update, delete on public.daily_specials to authenticated;
grant all on public.daily_specials to service_role;

-- ============================================================
-- AUTHENTICATED-ONLY TABLES (staff, owners, platform team)
-- ============================================================

grant select, insert, update, delete on public.staff to authenticated;
grant all on public.staff to service_role;

grant select, insert, update, delete on public.restaurant_members to authenticated;
grant all on public.restaurant_members to service_role;

grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

grant select, insert, update, delete on public.legal_documents to authenticated;
grant all on public.legal_documents to service_role;

grant select, insert, update, delete on public.platform_team to authenticated;
grant all on public.platform_team to service_role;

grant select, insert, update, delete on public.platform_team_restaurants to authenticated;
grant all on public.platform_team_restaurants to service_role;

grant select, insert, update, delete on public.platform_settings to authenticated;
grant all on public.platform_settings to service_role;

grant select, insert, update, delete on public.design_requests to authenticated;
grant all on public.design_requests to service_role;

grant select, insert, update, delete on public.design_templates to authenticated;
grant all on public.design_templates to service_role;

grant select, insert, update, delete on public.template_access to authenticated;
grant all on public.template_access to service_role;

grant select, insert, update, delete on public.landing_pages to authenticated;
grant all on public.landing_pages to service_role;

grant select, insert, update, delete on public.team_registration_requests to authenticated;
grant all on public.team_registration_requests to service_role;

-- ============================================================
-- INVENTORY & OPERATIONS
-- ============================================================

grant select, insert, update, delete on public.suppliers to authenticated;
grant all on public.suppliers to service_role;

grant select, insert, update, delete on public.ingredients to authenticated;
grant all on public.ingredients to service_role;

grant select, insert, update, delete on public.menu_item_ingredients to authenticated;
grant all on public.menu_item_ingredients to service_role;

grant select, insert, update, delete on public.stock_movements to authenticated;
grant all on public.stock_movements to service_role;

grant select, insert, update, delete on public.purchase_orders to authenticated;
grant all on public.purchase_orders to service_role;

grant select, insert, update, delete on public.purchase_order_lines to authenticated;
grant all on public.purchase_order_lines to service_role;

grant select, insert, update, delete on public.waste_log to authenticated;
grant all on public.waste_log to service_role;

grant select, insert, update, delete on public.supplier_products to authenticated;
grant all on public.supplier_products to service_role;

-- ============================================================
-- AI / KI FEATURES
-- ============================================================

grant select, insert, update, delete on public.loyalty_programs to authenticated;
grant all on public.loyalty_programs to service_role;

grant select, insert, update, delete on public.loyalty_members to authenticated;
grant all on public.loyalty_members to service_role;

grant select, insert, update, delete on public.alert_settings to authenticated;
grant all on public.alert_settings to service_role;

grant select, insert, update, delete on public.marketing_subscribers to authenticated;
grant all on public.marketing_subscribers to service_role;

grant select, insert, update, delete on public.marketing_campaigns to authenticated;
grant all on public.marketing_campaigns to service_role;

grant select, insert, update, delete on public.daily_prep_plans to authenticated;
grant all on public.daily_prep_plans to service_role;

grant select, insert, update, delete on public.benchmark_snapshots to authenticated;
grant all on public.benchmark_snapshots to service_role;

grant select, insert, update, delete on public.bill_splits to authenticated;
grant all on public.bill_splits to service_role;

grant select, insert, update, delete on public.reengagement_log to authenticated;
grant all on public.reengagement_log to service_role;

grant select, insert, update, delete on public.recipe_notes to authenticated;
grant all on public.recipe_notes to service_role;

grant select, insert, update, delete on public.recipe_ingredients to authenticated;
grant all on public.recipe_ingredients to service_role;

-- ============================================================
-- WHITE-LABEL / AGENCY
-- ============================================================

grant select, insert, update, delete on public.agencies to authenticated;
grant all on public.agencies to service_role;

grant select, insert, update, delete on public.agency_branding to authenticated;
grant all on public.agency_branding to service_role;

-- ============================================================
-- POS / PAYMENTS (tables may be in public schema without prefix)
-- ============================================================

grant select, insert, update, delete on public.group_payments to authenticated;
grant all on public.group_payments to service_role;

grant select, insert, update, delete on public.external_transactions to authenticated;
grant all on public.external_transactions to service_role;

grant select, insert, update, delete on public.pos_connections to authenticated;
grant all on public.pos_connections to service_role;

grant select, insert, update, delete on public.pos_oauth_states to authenticated;
grant all on public.pos_oauth_states to service_role;

-- ============================================================
-- STAFF OPERATIONS
-- ============================================================

grant select, insert, update, delete on public.staff_presence to authenticated;
grant all on public.staff_presence to service_role;

grant select, insert, update, delete on public.shift_plans to authenticated;
grant all on public.shift_plans to service_role;

grant select, insert, update, delete on public.shift_handovers to authenticated;
grant all on public.shift_handovers to service_role;

grant select, insert, update on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
