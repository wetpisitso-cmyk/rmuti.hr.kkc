-- Applied to production previously: 20261014073740 admin_delete_managed_records_with_dependencies
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.

create or replace function public.admin_delete_record(
  p_table text,
  p_id uuid,
  p_expected_title text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_count integer;
begin
  -- Every deletion is authorized inside PostgreSQL; the browser alone is not trusted.
  if auth.uid() is null or not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'FORBIDDEN';
  end if;
  if p_id is null or p_expected_title is null or btrim(p_expected_title) = '' then
    raise exception 'CONFIRMATION_REQUIRED';
  end if;
  -- Explicit table allowlist prevents arbitrary deletion.
  case p_table
    when 'departments' then
      select name into v_title from public.departments where id=p_id for update;
      if found and exists(select 1 from public.job_positions where department_id=p_id) then
        raise exception 'DELETE_BLOCKED_HAS_POSITIONS';
      end if;
    when 'recruitment_rounds' then
      select name into v_title from public.recruitment_rounds where id=p_id for update;
      if found and exists(select 1 from public.job_positions where round_id=p_id) then
        raise exception 'DELETE_BLOCKED_HAS_POSITIONS';
      end if;
    when 'job_positions' then
      select title into v_title from public.job_positions where id=p_id for update;
      if found and exists(select 1 from public.applications where job_id=p_id) then
        raise exception 'DELETE_BLOCKED_HAS_APPLICATIONS';
      end if;
      if found and exists(select 1 from public.exam_schedules where job_id=p_id) then
        raise exception 'DELETE_BLOCKED_HAS_EXAMS';
      end if;
      if found and exists(select 1 from public.published_results where job_id=p_id) then
        raise exception 'DELETE_BLOCKED_HAS_RESULTS';
      end if;
    when 'announcements' then
      select title into v_title from public.announcements where id=p_id for update;
    when 'exam_schedules' then
      select title into v_title from public.exam_schedules where id=p_id for update;
      if found and exists(select 1 from public.exam_assignments where schedule_id=p_id) then
        raise exception 'DELETE_BLOCKED_HAS_ASSIGNMENTS';
      end if;
    when 'exam_assignments' then
      select exam_number into v_title from public.exam_assignments where id=p_id for update;
    when 'selection_results' then
      select a.application_number
        into v_title
        from public.selection_results s
        join public.applications a on a.id=s.application_id
       where s.id=p_id for update of s;
      if found and exists(
        select 1 from public.published_results p
        join public.selection_results s on s.id=p_id
        join public.applications a on a.id=s.application_id
        where p.job_id=a.job_id
      ) then
        raise exception 'DELETE_BLOCKED_HAS_RESULTS';
      end if;
    when 'published_results' then
      select title into v_title from public.published_results where id=p_id for update;
    else
      raise exception 'DELETE_INVALID_TABLE';
  end case;
  if v_title is null then raise exception 'DELETE_RECORD_NOT_FOUND'; end if;
  if v_title <> p_expected_title then raise exception 'DELETE_RECORD_MISMATCH'; end if;
  case p_table
    when 'departments' then delete from public.departments where id=p_id;
    when 'recruitment_rounds' then delete from public.recruitment_rounds where id=p_id;
    when 'job_positions' then delete from public.job_positions where id=p_id;
    when 'announcements' then delete from public.announcements where id=p_id;
    when 'exam_schedules' then delete from public.exam_schedules where id=p_id;
    when 'exam_assignments' then delete from public.exam_assignments where id=p_id;
    when 'selection_results' then delete from public.selection_results where id=p_id;
    when 'published_results' then delete from public.published_results where id=p_id;
  end case;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'DELETE_RECORD_NOT_FOUND'; end if;
  insert into public.audit_logs(actor_id,entity,entity_id,action,metadata)
  values (auth.uid(),p_table,p_id,'delete',jsonb_build_object('title',v_title));
  return jsonb_build_object('deleted',true,'table',p_table,'id',p_id);
exception
  when foreign_key_violation then
    raise exception 'DELETE_BLOCKED_IN_USE';
end;
$$;
revoke all on function public.admin_delete_record(text,uuid,text) from public,anon;
grant execute on function public.admin_delete_record(text,uuid,text) to authenticated;

