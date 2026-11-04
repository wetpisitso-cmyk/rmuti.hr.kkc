-- Applied to production previously: 20261014072216 admin_secure_application_delete
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.

-- Queue object deletions because removing Supabase Storage objects via SQL is unsafe.
create table if not exists public.application_file_cleanup_queue (
  bucket text not null default 'application-files',
  path text not null,
  application_id uuid not null,
  queued_at timestamptz not null default now(),
  primary key (bucket,path)
);
alter table public.application_file_cleanup_queue enable row level security;
revoke all on public.application_file_cleanup_queue from PUBLIC, anon, authenticated;
grant select, delete on public.application_file_cleanup_queue to service_role;

create or replace function public.admin_delete_application(
  p_id uuid,
  p_confirm_number text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_number text;
  v_count integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'FORBIDDEN';
  end if;

  if p_confirm_number is null or length(trim(p_confirm_number)) = 0 then
    raise exception 'CONFIRMATION_REQUIRED';
  end if;

  select application_number into v_number
  from public.applications
  where id = p_id
  for update;

  if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;
  if v_number is null or v_number <> trim(p_confirm_number) then
    raise exception 'CONFIRMATION_MISMATCH';
  end if;

  -- Keep a durable queue for storage cleanup even if the HTTP request fails.
  insert into public.application_file_cleanup_queue(bucket,path,application_id)
  select distinct 'application-files', paths.path, p_id
  from (
    select storage_path as path from public.application_documents where application_id = p_id
    union
    select storage_path from public.application_document_versions where application_id = p_id
    union
    select slip_path from public.payment_records where application_id = p_id
  ) paths
  where paths.path is not null and paths.path <> ''
    and paths.path like ('%/' || p_id::text || '/%')
  on conflict (bucket,path) do nothing;
  get diagnostics v_count = row_count;

  -- Remove only dependents of the specified application.
  delete from public.payment_records where application_id = p_id;
  delete from public.exam_assignments where application_id = p_id;
  delete from public.selection_results where application_id = p_id;
  delete from public.notifications where application_id = p_id;
  delete from public.staff_notes where application_id = p_id;
  delete from public.application_document_versions where application_id = p_id;
  delete from public.application_documents where application_id = p_id;
  delete from public.application_status_history where application_id = p_id;
  delete from public.application_education where application_id = p_id;
  delete from public.application_experience where application_id = p_id;
  delete from public.applications where id = p_id;

  insert into public.audit_logs(actor_id,entity,entity_id,action,metadata)
  values (auth.uid(),'applications',p_id,'delete',
    jsonb_build_object('application_number',v_number,'queued_storage_objects',v_count));

  return jsonb_build_object('deleted',true,'application_number',v_number,'files_queued',v_count);
end;
$$;
revoke all on function public.admin_delete_application(uuid,text) from PUBLIC, anon;
grant execute on function public.admin_delete_application(uuid,text) to authenticated;

