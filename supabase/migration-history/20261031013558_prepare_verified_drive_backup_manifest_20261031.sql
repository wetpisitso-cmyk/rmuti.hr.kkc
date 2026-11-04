-- Applied to production previously: 20261031013558 prepare_verified_drive_backup_manifest_20261031
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.
create table if not exists public.storage_drive_backup_manifest (
  source_path text primary key,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 3145728),
  status text not null default 'pending' check (status in ('pending','processing','uploaded','verified','failed')),
  drive_path text,
  sha256 text,
  attempts integer not null default 0 check (attempts >= 0),
  error_code text,
  updated_at timestamptz not null default now(),
  verified_at timestamptz,
  constraint source_path_shape check (source_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}[.](pdf|jpg|png)$'),
  constraint drive_path_shape check (drive_path is null or drive_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/gdrive/[A-Za-z0-9_-]{10,200}[.](pdf|jpg|png)$')
);
alter table public.storage_drive_backup_manifest enable row level security;
revoke all on public.storage_drive_backup_manifest from public, anon, authenticated;
grant select, insert, update on public.storage_drive_backup_manifest to service_role;
create index if not exists idx_storage_drive_backup_status on public.storage_drive_backup_manifest(status, updated_at);
insert into public.storage_drive_backup_manifest (source_path, size_bytes, status)
select r.storage_path, (o.metadata->>'size')::bigint, 'pending'
from (
  select storage_path from public.application_documents
  where storage_path not like '%/gdrive/%'
  union
  select storage_path from public.application_document_versions
  where storage_path not like '%/gdrive/%'
) r
join storage.objects o on o.bucket_id='application-files' and o.name=r.storage_path
where r.storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}[.](pdf|jpg|png)$'
and (o.metadata->>'size')::bigint between 1 and 3145728
on conflict (source_path) do nothing;
