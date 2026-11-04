-- Applied to production previously: 20261030092509 server_only_applicant_document_storage_target
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.
create table if not exists public.document_storage_config (
  key text primary key,
  provider text not null check (provider in ('supabase','gdrive')),
  updated_at timestamptz not null default now()
);
alter table public.document_storage_config enable row level security;
revoke all on public.document_storage_config from public, anon, authenticated;
grant select on public.document_storage_config to service_role;
grant insert, update, delete on public.document_storage_config to service_role;
insert into public.document_storage_config (key, provider)
values ('applicant_uploads', 'supabase') on conflict (key) do nothing;
