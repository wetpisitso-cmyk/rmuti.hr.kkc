-- Applied to production previously: 20261018150518 announcement_banner_storage_policies
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.
create policy announcement_banner_insert on storage.objects for insert to authenticated with check(bucket_id='announcement-banners' and (select private.can('publish')) and name ~ '^banners/[0-9a-f-]{36}\.webp$'); create policy announcement_banner_delete on storage.objects for delete to authenticated using(bucket_id='announcement-banners' and (select private.can('publish')));
