-- Sort applicants who did not pass eligibility before all other statuses.
-- This is a list-ordering option only; existing filters, pagination and data remain unchanged.
CREATE OR REPLACE FUNCTION private.staff_list(p_filters jsonb, p_page integer, p_size integer, p_sort text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_where text; v_rows jsonb; v_count bigint; v_order text;
BEGIN
  IF NOT private.is_staff() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  v_order=CASE p_sort
    WHEN 'submission_order' THEN 'j.title asc,a.display_position_order asc'
    WHEN 'number' THEN 'a.application_number'
    WHEN 'status' THEN 'a.status'
    WHEN 'ineligible_first' THEN 'case when a.status=''ineligible'' then 0 else 1 end,a.created_at desc'
    ELSE 'a.created_at desc' END;
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
  EXECUTE 'select count(*)'||v_where INTO v_count USING p_filters;
  EXECUTE 'select coalesce(jsonb_agg(t),''[]''::jsonb) from (select a.id,a.status,a.payment_status,a.application_number,a.position_order,a.display_position_order,a.personal_data,a.created_at,a.submitted_at,a.correction_deadline,j.title as job_title,d.name as department_name,r.name as round_name,r.year_be'||v_where||
  ' order by '||v_order||',a.id limit $2 offset $3) t'
  INTO v_rows USING p_filters,least(greatest(p_size,1),100),
  greatest(p_page,0)*least(greatest(p_size,1),100);
  RETURN jsonb_build_object('rows',v_rows,'count',v_count);
END;
$function$
;
