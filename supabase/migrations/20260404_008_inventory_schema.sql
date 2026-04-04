-- Inventory & Reporting Schema
-- Module: Inventory Core, Inventory Plus, Waste Tracking

-- ============================================================
-- SUPPLIERS (Lieferanten)
-- ============================================================
create table if not exists public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name          text not null,
  contact_name  text,
  email         text,
  phone         text,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- INGREDIENTS (Zutaten / Lagerartikel)
-- ============================================================
create table if not exists public.ingredients (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  name           text not null,
  unit           text not null,              -- 'kg', 'L', 'g', 'ml', 'Stück'
  current_stock  numeric(10,3) not null default 0,
  min_stock      numeric(10,3) not null default 0,
  purchase_price numeric(10,4),              -- Einkaufspreis pro Einheit (optional)
  supplier_id    uuid references public.suppliers(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- ============================================================
-- MENU_ITEM_INGREDIENTS (Verknüpfung Menüpunkt ↔ Zutaten)
-- ============================================================
create table if not exists public.menu_item_ingredients (
  id                   uuid primary key default gen_random_uuid(),
  menu_item_id         uuid not null references public.menu_items(id) on delete cascade,
  ingredient_id        uuid not null references public.ingredients(id) on delete cascade,
  quantity_per_serving numeric(10,4) not null,
  created_at           timestamptz not null default now(),
  unique(menu_item_id, ingredient_id)
);

-- ============================================================
-- STOCK_MOVEMENTS (Audit-Log aller Lagerbewegungen)
-- ============================================================
do $$ begin
  create type public.stock_movement_type as enum
    ('order_deduction', 'delivery', 'correction', 'waste');
exception when duplicate_object then null;
end $$;

create table if not exists public.stock_movements (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  ingredient_id  uuid not null references public.ingredients(id) on delete cascade,
  movement_type  public.stock_movement_type not null,
  quantity_delta numeric(10,4) not null,     -- negativ = Abzug, positiv = Zugang
  note           text,
  order_id       uuid references public.orders(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- ============================================================
-- PURCHASE_ORDERS (Bestellungen bei Lieferanten)
-- ============================================================
do $$ begin
  create type public.purchase_order_status as enum ('draft', 'ordered', 'received');
exception when duplicate_object then null;
end $$;

create table if not exists public.purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  supplier_id   uuid not null references public.suppliers(id) on delete cascade,
  status        public.purchase_order_status not null default 'draft',
  notes         text,
  ordered_at    timestamptz,
  received_at   timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists public.purchase_order_lines (
  id                uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  ingredient_id     uuid not null references public.ingredients(id) on delete cascade,
  quantity_ordered  numeric(10,4) not null,
  quantity_received numeric(10,4),
  unit_price        numeric(10,4),
  created_at        timestamptz not null default now()
);

-- ============================================================
-- WASTE_LOG (Verluste erfassen)
-- ============================================================
do $$ begin
  create type public.waste_reason as enum ('spoiled', 'overcooked', 'dropped', 'other');
exception when duplicate_object then null;
end $$;

create table if not exists public.waste_log (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity      numeric(10,4) not null,
  reason        public.waste_reason not null,
  note          text,
  logged_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- ============================================================
-- INDIZES
-- ============================================================
create index if not exists idx_ingredients_restaurant on public.ingredients(restaurant_id);
create index if not exists idx_menu_item_ingredients_item on public.menu_item_ingredients(menu_item_id);
create index if not exists idx_menu_item_ingredients_ingredient on public.menu_item_ingredients(ingredient_id);
create index if not exists idx_stock_movements_restaurant_date on public.stock_movements(restaurant_id, created_at desc);
create index if not exists idx_stock_movements_ingredient on public.stock_movements(ingredient_id);
create index if not exists idx_waste_log_restaurant_date on public.waste_log(restaurant_id, logged_at desc);
create index if not exists idx_purchase_orders_restaurant on public.purchase_orders(restaurant_id);
create index if not exists idx_purchase_orders_supplier on public.purchase_orders(supplier_id);

-- ============================================================
-- REALTIME
-- ============================================================
do $$ begin
  alter publication supabase_realtime add table public.ingredients;
exception when others then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.stock_movements;
exception when others then null;
end $$;
