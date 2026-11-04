-- Applied to production previously: 20261018114122 backup_first_reversible_application_archiving
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.

-- Soft-delete with a protected snapshot, preserving verified payment and official receipt.
-- Changes are limited to new archive metadata and secure staff-only operations.
alter table public.applications add column if not exists archived_at timestamptz;
alter table public.applications add column if not exists archived_by uuid references auth.users(id);
create index if not exists applications_active_idx on public.applications(archived_at,submitted_at);

create table if not exists private.application_archive_backups (
  application_id uuid primary key,
  backup jsonb not null,
  backed_up_at timestamptz not null default clock_timestamp(),
  backed_up_by uuid not null references auth.users(id),
  restored_at timestamptz,
  restored_by uuid
);
revoke all on private.application_archive_backups from public,anon,authenticated;

-- Hide archived records from applicant self-service. Staff can retrieve for restoration.
drop policy if exists applications_read on public.applications;
create policy applications_read on public.applications
for select to authenticated
using (
  ((user_id=(select auth.uid())) and archived_at is null)
  or (select private.is_staff())
);

create or replace function public.admin_archive_application(p_id uuid,p_confirmation text)
returns jsonb
language plpgsql security definer set search_path to ''
as $func$
declare
  a public.applications;
  backup_data jsonb;
  v_number text;
begin
  if not private.can('admin') then raise exception 'FORBIDDEN'; end if;
  select * into a from public.applications where id=p_id for update;
  if a.id is null then raise exception 'APPLICATION_NOT_FOUND'; end if;
  if a.archived_at is not null then raise exception 'ALREADY_ARCHIVED'; end if;
  v_number:=coalesce(a.application_number,'ย้ายไปสำรอง');
  if p_confirmation is distinct from v_number then raise exception 'CONFIRMATION_MISMATCH'; end if;

  select jsonb_build_object(
    'application',to_jsonb(a),
    'education',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.application_education t where t.application_id=p_id),
    'experience',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.application_experience t where t.application_id=p_id),
    'documents',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.application_documents t where t.application_id=p_id),
    'document_versions',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.application_document_versions t where t.application_id=p_id),
    'payments',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.payment_records t where t.application_id=p_id),
    'payment_receipts',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.payment_receipts t where t.application_id=p_id),
    'history',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.application_status_history t where t.application_id=p_id),
    'review_steps',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.application_review_steps t where t.application_id=p_id),
    'print_approvals',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.application_print_approvals t where t.application_id=p_id),
    'admin_signatures',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.application_admin_signatures t where t.application_id=p_id),
    'exam_assignments',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.exam_assignments t where t.application_id=p_id),
    'selection_results',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.selection_results t where t.application_id=p_id),
    'staff_notes',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.staff_notes t where t.application_id=p_id),
    'notifications',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.notifications t where t.application_id=p_id)
  ) into backup_data;

  insert into private.application_archive_backups(application_id,backup,backed_up_by,backed_up_at,restored_at,restored_by)
  values(p_id,backup_data,auth.uid(),clock_timestamp(),null,null)
  on conflict(application_id) do update
    set backup=excluded.backup,backed_up_at=excluded.backed_up_at,backed_up_by=excluded.backed_up_by,restored_at=null,restored_by=null;

  update public.applications
    set archived_at=clock_timestamp(),archived_by=auth.uid()
  where id=p_id;
  insert into public.audit_logs(actor_id,entity,entity_id,action,metadata)
  values(auth.uid(),'applications',p_id,'archive',jsonb_build_object('application_number',a.application_number,'backup_created',true));
  return jsonb_build_object('archived',true,'backup_created',true);
end
$func$;

create or replace function public.admin_restore_application(p_id uuid)
returns jsonb
language plpgsql security definer set search_path to ''
as $func$
declare v_app public.applications;
begin
  if not private.can('admin') then raise exception 'FORBIDDEN'; end if;
  select * into v_app from public.applications where id=p_id for update;
  if v_app.id is null then raise exception 'APPLICATION_NOT_FOUND'; end if;
  if v_app.archived_at is null then raise exception 'NOT_ARCHIVED'; end if;
  if not exists(select 1 from private.application_archive_backups where application_id=p_id)
  then raise exception 'BACKUP_NOT_FOUND'; end if;
  update public.applications set archived_at=null,archived_by=null where id=p_id;
  update private.application_archive_backups
    set restored_at=clock_timestamp(),restored_by=auth.uid() where application_id=p_id;
  insert into public.audit_logs(actor_id,entity,entity_id,action,metadata)
  values(auth.uid(),'applications',p_id,'restore',jsonb_build_object('application_number',v_app.application_number));
  return jsonb_build_object('restored',true);
end
$func$;

revoke all on function public.admin_archive_application(uuid,text) from public,anon;
grant execute on function public.admin_archive_application(uuid,text) to authenticated;
revoke all on function public.admin_restore_application(uuid) from public,anon;
grant execute on function public.admin_restore_application(uuid) to authenticated;

CREATE OR REPLACE FUNCTION private.staff_list(p_filters jsonb, p_page integer, p_size integer, p_sort text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_where text; v_rows jsonb; v_count bigint; v_order text;
begin
  if not private.is_staff() then raise exception 'FORBIDDEN'; end if;
  v_order=case p_sort when 'number' then 'a.application_number' when 'status' then 'a.status' else 'a.created_at desc' end;
  -- Only trusted sort expressions are interpolated. Filters remain bound to $1.
  v_where=' from public.applications a join public.job_positions j on j.id=a.job_id join public.recruitment_rounds r on r.id=j.round_id join public.departments d on d.id=j.department_id where
  a.archived_at is null and a.submitted_at is not null and a.status <> ''draft'' and
  (nullif($1->>''year'','''') is null or r.year_be=($1->>''year'')::int) and
  (nullif($1->>''round'','''') is null or r.id=($1->>''round'')::uuid) and
  (nullif($1->>''job'','''') is null or j.id=($1->>''job'')::uuid) and
  (nullif($1->>''department'','''') is null or d.id=($1->>''department'')::uuid) and
  (nullif($1->>''status'','''') is null or a.status::text=$1->>''status'') and
  (nullif($1->>''from'','''') is null or a.created_at>=($1->>''from'')::timestamptz) and
  (nullif($1->>''to'','''') is null or a.created_at<=($1->>''to'')::timestamptz) and
  (nullif($1->>''search'','''') is null or concat_ws('' '',a.application_number,a.personal_data->>''first_name'',a.personal_data->>''last_name'') ilike ''%''||left($1->>''search'',100)||''%'')';
  execute 'select count(*)'||v_where into v_count using p_filters;
  execute 'select coalesce(jsonb_agg(t),''[]''::jsonb) from (select a.id,a.status,a.payment_status,a.application_number,a.personal_data,a.created_at,a.submitted_at,j.title as job_title,d.name as department_name,r.name as round_name,r.year_be'||v_where||
  ' order by '||v_order||',a.id limit $2 offset $3) t'
  into v_rows using p_filters,least(greatest(p_size,1),100),greatest(p_page,0)*least(greatest(p_size,1),100);
  return jsonb_build_object('rows',v_rows,'count',v_count);
end
$function$
;
CREATE OR REPLACE FUNCTION private.staff_dashboard(p_filters jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
  if not private.is_staff() then raise exception 'FORBIDDEN'; end if;
  with filtered as (
    select a.status, a.payment_status, j.title, d.name
    from public.applications a
    join public.job_positions j on j.id = a.job_id
    join public.recruitment_rounds r on r.id = j.round_id
    join public.departments d on d.id = j.department_id
    where a.archived_at is null and a.submitted_at is not null
      and a.status <> 'draft'
      and (nullif(p_filters->>'year','') is null or r.year_be=(p_filters->>'year')::int)
      and (nullif(p_filters->>'round','') is null or r.id=(p_filters->>'round')::uuid)
      and (nullif(p_filters->>'job','') is null or j.id=(p_filters->>'job')::uuid)
      and (nullif(p_filters->>'department','') is null or d.id=(p_filters->>'department')::uuid)
      and (nullif(p_filters->>'status','') is null or a.status::text=p_filters->>'status')
      and (nullif(p_filters->>'from','') is null or a.created_at>=(p_filters->>'from')::timestamptz)
      and (nullif(p_filters->>'to','') is null or a.created_at<=(p_filters->>'to')::timestamptz)
      and (nullif(p_filters->>'search','') is null or concat_ws(' ',a.application_number,a.personal_data->>'first_name',a.personal_data->>'last_name') ilike '%'||left(p_filters->>'search',100)||'%')
  )
  select jsonb_build_object(
    'total',(select count(*) from filtered),
    'statuses',coalesce((select jsonb_object_agg(status,n) from (select status,count(*) n from filtered group by status) s),'{}'),
    'payments',coalesce((select jsonb_object_agg(payment_status,n) from (select payment_status,count(*) n from filtered group by payment_status) s),'{}'),
    'jobs',coalesce((select jsonb_agg(x) from (select title as name,count(*) as value from filtered group by title order by count(*) desc) x),'[]'),
    'departments',coalesce((select jsonb_agg(x) from (select name,count(*) as value from filtered group by name order by count(*) desc) x),'[]')
  ) into result;
  return result;
end
$function$
;

