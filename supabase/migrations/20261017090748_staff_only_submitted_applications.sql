-- Staff can view only applications that were actually submitted.
-- Unsubmitted drafts remain available to their applicants but do not count in staff reports.
-- This migration is already applied to the connected production database.

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
    where a.submitted_at is not null
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
  a.submitted_at is not null and a.status <> ''draft'' and
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
