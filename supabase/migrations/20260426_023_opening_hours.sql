alter table restaurants
  add column if not exists opening_hours jsonb default null;
