-- Applied to production previously: 20261018151700 banner_staff_update_policy
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.
create policy announcement_banner_staff_update on public.announcements for update to authenticated using ((select private.can('publish'))) with check ((select private.can('publish')));
