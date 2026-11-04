-- Applied to production previously: 20261103034428 website_visit_counter_anonymous
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.
-- A small, anonymous and privacy-preserving counter for the public site.
create table if not exists public.website_visit_counter (
  id smallint primary key default 1 check (id = 1),
  total bigint not null default 0 check (total >= 0),
  started_at timestamptz not null default now()
);
alter table public.website_visit_counter enable row level security;
revoke all on table public.website_visit_counter from public, anon, authenticated;
grant select, update on table public.website_visit_counter to service_role;
insert into public.website_visit_counter (id, total) values (1, 0)
  on conflict (id) do nothing;

-- Called only by the Edge Function using the server-side service-role key.
-- SECURITY INVOKER and explicit service_role grant prevent client-side writes.
create or replace function public.increment_website_visit()
returns bigint
language sql
security invoker
set search_path = ''
as $$
  update public.website_visit_counter
     set total = total + 1
   where id = 1
   returning total;
$$;
revoke execute on function public.increment_website_visit() from public, anon, authenticated;
grant execute on function public.increment_website_visit() to service_role;
