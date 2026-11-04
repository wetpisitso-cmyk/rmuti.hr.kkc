-- Applied to production previously: 20261031042422 track_deleted_supabase_storage_after_verified_drive_backup_20261031
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.
alter table public.storage_drive_backup_manifest
 add column if not exists source_deleted_at timestamptz,
 add column if not exists source_deleted_by uuid;
create index if not exists idx_drive_backup_cleanup_pending
 on public.storage_drive_backup_manifest (source_path)
 where status='verified' and source_deleted_at is null;
