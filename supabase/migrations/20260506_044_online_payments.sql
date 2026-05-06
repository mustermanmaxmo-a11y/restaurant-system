-- Feature: Online-Zahlung Toggle + Stripe Connect + Auto-Split

-- Stripe Connect pro Restaurant + Online-Zahlung Toggle
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS online_payments_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text;

-- Zahlungsstatus pro Order
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.order_groups(id);

-- Auto-Split Verknüpfung + Per-Person Zahlungsstatus
ALTER TABLE public.bill_splits
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.order_groups(id),
  ADD COLUMN IF NOT EXISTS payment_statuses jsonb DEFAULT '{}';
