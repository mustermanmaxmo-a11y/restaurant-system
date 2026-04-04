-- Inventory RLS Policies
-- Alle Policies nutzen get_owner_restaurant_id() (etabliertes Pattern)

alter table public.ingredients enable row level security;
alter table public.menu_item_ingredients enable row level security;
alter table public.stock_movements enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.waste_log enable row level security;

-- ingredients: nur Owner
drop policy if exists "ingredients_owner" on public.ingredients;
create policy "ingredients_owner" on public.ingredients
  for all using (restaurant_id = get_owner_restaurant_id());

-- menu_item_ingredients: über ingredient.restaurant_id
drop policy if exists "menu_item_ingredients_owner" on public.menu_item_ingredients;
create policy "menu_item_ingredients_owner" on public.menu_item_ingredients
  for all using (
    ingredient_id in (
      select id from public.ingredients
      where restaurant_id = get_owner_restaurant_id()
    )
  );

-- stock_movements: Owner + service_role für Trigger-Writes
drop policy if exists "stock_movements_owner" on public.stock_movements;
create policy "stock_movements_owner" on public.stock_movements
  for all using (restaurant_id = get_owner_restaurant_id());

drop policy if exists "stock_movements_service_role" on public.stock_movements;
create policy "stock_movements_service_role" on public.stock_movements
  for insert to service_role with check (true);

-- suppliers: nur Owner
drop policy if exists "suppliers_owner" on public.suppliers;
create policy "suppliers_owner" on public.suppliers
  for all using (restaurant_id = get_owner_restaurant_id());

-- purchase_orders: nur Owner
drop policy if exists "purchase_orders_owner" on public.purchase_orders;
create policy "purchase_orders_owner" on public.purchase_orders
  for all using (restaurant_id = get_owner_restaurant_id());

-- purchase_order_lines: über purchase_order.restaurant_id
drop policy if exists "purchase_order_lines_owner" on public.purchase_order_lines;
create policy "purchase_order_lines_owner" on public.purchase_order_lines
  for all using (
    purchase_order_id in (
      select id from public.purchase_orders
      where restaurant_id = get_owner_restaurant_id()
    )
  );

-- waste_log: nur Owner
drop policy if exists "waste_log_owner" on public.waste_log;
create policy "waste_log_owner" on public.waste_log
  for all using (restaurant_id = get_owner_restaurant_id());
