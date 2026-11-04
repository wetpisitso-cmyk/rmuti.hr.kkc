-- Applied to production previously: 20261018151706 banner_storage_staff_select
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.
create policy announcement_banner_select on storage.objects for select to authenticated using(bucket_id='announcement-banners' and (select private.can('publish')));
