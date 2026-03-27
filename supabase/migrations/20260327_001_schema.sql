-- RestaurantOS Initial Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → Run)

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- RESTAURANTS (one per SaaS tenant)
-- ============================================================
create table public.restaurants (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  slug text unique not null,
  plan text not null default 'basic' check (plan in ('basic', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- STAFF (kitchen + waiter, PIN-based login)
-- ============================================================
create table public.staff (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  name text not null,
  code text not null,
  role text not null check (role in ('kitchen', 'waiter')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(restaurant_id, code)
);

-- ============================================================
-- TABLES (physical restaurant tables + QR tokens)
-- position_x/y and shape reserved for Phase 2 floor plan feature
-- ============================================================
create table public.tables (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  table_num integer not null,
  label text not null,
  qr_token text unique not null default uuid_generate_v4()::text,
  capacity integer not null default 4,
  position_x numeric,
  position_y numeric,
  section text,
  shape text check (shape in ('rect', 'circle')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(restaurant_id, table_num)
);

-- ============================================================
-- MENU CATEGORIES
-- ============================================================
create table public.menu_categories (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- MENU ITEMS
-- ============================================================
create table public.menu_items (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  category_id uuid references public.menu_categories(id) on delete cascade not null,
  name text not null,
  description text,
  price numeric(10,2) not null,
  image_url text,
  allergens text[] not null default '{}',
  tags text[] not null default '{}',
  available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ORDERS (dine_in + delivery + pickup unified)
-- ============================================================
create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  order_type text not null check (order_type in ('dine_in', 'delivery', 'pickup')),
  table_id uuid references public.tables(id) on delete set null,
  status text not null default 'new' check (status in ('new', 'cooking', 'served', 'cancelled')),
  items jsonb not null default '[]',
  note text,
  total numeric(10,2) not null,
  customer_name text,
  customer_phone text,
  delivery_address jsonb,
  estimated_time integer,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SERVICE CALLS (waiter call / bill request from table)
-- ============================================================
create table public.service_calls (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references public.restaurants(id) on delete cascade not null,
  table_id uuid references public.tables(id) on delete cascade not null,
  type text not null check (type in ('waiter', 'bill')),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- REALTIME (enable live updates for dashboard)
-- ============================================================
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.service_calls;
