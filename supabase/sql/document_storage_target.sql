-- Server-only document storage destination. No applicant files are migrated or deleted.
create table if not exists public.document_storage_config (
  key text primary key,
  provider text not null check (provider in ('supabase','gdrive')),
  updated_at timestamptz not null default now()
);
alter table public.document_storage_config enable row level security;
revoke all on public.document_storage_config from public, anon, authenticated;
grant select, insert, update, delete on public.document_storage_config to service_role;
insert into public.document_storage_config (key, provider)
values ('applicant_uploads', 'supabase') on conflict (key) do nothing;
-- Production activation after non-personal JPG/PNG/PDF and access tests:
-- update public.document_storage_config set provider='gdrive',updated_at=now()
-- where key='applicant_uploads';
-- Roll back new uploads only:
-- update public.document_storage_config set provider='supabase',updated_at=now()
-- where key='applicant_uploads';
