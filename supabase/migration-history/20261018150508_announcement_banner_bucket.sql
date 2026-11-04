-- Applied to production previously: 20261018150508 announcement_banner_bucket
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('announcement-banners','announcement-banners',true,524288,array['image/webp']) on conflict(id) do nothing;
