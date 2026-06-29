-- Platform internal notes per restaurant (team-only, not visible to restaurant owners)

create table if not exists public.platform_notes (
  id          uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  author_email  text not null,
  content       text not null check (char_length(content) between 1 and 2000),
  pinned        boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists platform_notes_restaurant_idx
  on public.platform_notes (restaurant_id, created_at desc);

alter table public.platform_notes enable row level security;

-- Only service_role (admin client) has access — platform team never touches RLS directly
create policy "service_role_all"
  on public.platform_notes
  as permissive for all
  to service_role
  using (true) with check (true);
