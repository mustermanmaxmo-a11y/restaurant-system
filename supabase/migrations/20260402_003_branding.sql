-- Add branding fields to restaurants table
alter table public.restaurants
  add column if not exists primary_color    text,
  add column if not exists surface_color    text,
  add column if not exists logo_url         text,
  add column if not exists brand_preset     text,
  add column if not exists contact_email    text,
  add column if not exists contact_phone    text,
  add column if not exists contact_address  text,
  add column if not exists description      text;

-- Enable realtime for restaurants table so customer pages update live
alter publication supabase_realtime add table public.restaurants;
