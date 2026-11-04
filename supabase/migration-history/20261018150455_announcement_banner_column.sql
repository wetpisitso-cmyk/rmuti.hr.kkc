-- Applied to production previously: 20261018150455 announcement_banner_column
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.
alter table public.announcements add column if not exists banner_path text not null default '';
