-- Applied to production previously: 20261018151653 allow_announcement_banner_editor
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.
grant update (banner_path) on public.announcements to authenticated;
