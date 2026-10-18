-- Announcement banner feature (applied to the linked Supabase project).
alter table public.announcements add column if not exists banner_path text not null default '';
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('announcement-banners','announcement-banners',true,524288,array['image/webp'])
on conflict(id) do nothing;
grant update(banner_path) on public.announcements to authenticated;
create policy announcement_banner_staff_update on public.announcements
for update to authenticated using ((select private.can('publish')))
with check ((select private.can('publish')));
create policy announcement_banner_select on storage.objects for select to authenticated
using(bucket_id='announcement-banners' and (select private.can('publish')));
create policy announcement_banner_insert on storage.objects for insert to authenticated
with check(bucket_id='announcement-banners' and (select private.can('publish'))
and name ~ '^banners/[0-9a-f-]{36}\.webp$');
create policy announcement_banner_delete on storage.objects for delete to authenticated
using(bucket_id='announcement-banners' and (select private.can('publish')));
