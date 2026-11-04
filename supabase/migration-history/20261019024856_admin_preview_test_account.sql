-- Applied to production previously: 20261019024856 admin_preview_test_account
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.
create or replace function public.admin_preview_test_account(p_email text)
returns jsonb language plpgsql stable security definer set search_path to ''
as $$
declare v_user uuid; v_role text; v_apps jsonb;
begin
  if auth.uid() is null or not exists
    (select 1 from public.user_roles where user_id=auth.uid() and role='admin')
  then raise exception 'FORBIDDEN'; end if;
  select id into v_user from auth.users where lower(email)=lower(trim(p_email));
  if v_user is null then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  select role::text into v_role from public.user_roles where user_id=v_user;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'status',a.status::text,
    'application_number',a.application_number,
    'title',j.title,
    'documents',coalesce((select jsonb_agg(jsonb_build_object('file_name',d.file_name))
      from public.application_documents d where d.application_id=a.id),'[]'::jsonb)
    )),'[]'::jsonb)
  into v_apps from public.applications a
  left join public.job_positions j on j.id=a.job_id
  where a.user_id=v_user;
  return jsonb_build_object('email',trim(p_email),'role',v_role,'applications',v_apps);
end $$;
revoke all on function public.admin_preview_test_account(text) from public,anon;
grant execute on function public.admin_preview_test_account(text) to authenticated;
