-- Migration: Delivery role & out_for_delivery status
-- Run this in: Supabase Dashboard → SQL Editor

-- 1. staff.role: add 'delivery' to the allowed values
ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_role_check;

ALTER TABLE public.staff
  ADD CONSTRAINT staff_role_check CHECK (role IN ('kitchen', 'waiter', 'delivery'));

-- 2. orders.status: add 'out_for_delivery' and 'pending_payment' to the allowed values
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check CHECK (status IN ('pending_payment', 'new', 'cooking', 'out_for_delivery', 'served', 'cancelled'));
