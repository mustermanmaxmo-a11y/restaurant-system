create table if not exists public.platform_audit_log (
  id          uuid        primary key default uuid_generate_v4(),
  actor_email text        not null,
  action      text        not null,
  target_type text,
  target_id   uuid,
  target_name text,
  details     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists platform_audit_log_created_idx  on public.platform_audit_log (created_at desc);
create index if not exists platform_audit_log_actor_idx    on public.platform_audit_log (actor_email);
create index if not exists platform_audit_log_action_idx   on public.platform_audit_log (action);

alter table public.platform_audit_log enable row level security;

create policy "service_role_all" on public.platform_audit_log
  as permissive for all to service_role using (true) with check (true);
