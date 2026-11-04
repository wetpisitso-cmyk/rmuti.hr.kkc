-- Applied to production previously: 20261102072733 staff_expired_correction_ineligible_action_20261102
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.

-- Only staff with REVIEW permission can make this explicit decision.
-- Never automatically reject: correction deadline and fresh submitted work are rechecked.
CREATE OR REPLACE FUNCTION public.staff_reject_expired_correction(
  p_id uuid, p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $func$
DECLARE v_app public.applications;
DECLARE v_notice timestamptz;
DECLARE v_reason text;
BEGIN
 IF NOT private.can('review') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 v_reason:=btrim(coalesce(p_reason,''));
 IF length(v_reason)<12 OR length(v_reason)>1500 THEN
   RAISE EXCEPTION 'REASON_REQUIRED';
 END IF;
 SELECT * INTO v_app FROM public.applications WHERE id=p_id FOR UPDATE;
 IF v_app.id IS NULL OR v_app.archived_at IS NOT NULL OR
    v_app.status<>'needs_correction' OR v_app.submitted_at IS NULL THEN
    RAISE EXCEPTION 'CORRECTION_NOT_PENDING';
 END IF;
 IF v_app.correction_deadline IS NULL OR v_app.correction_deadline>=clock_timestamp() THEN
    RAISE EXCEPTION 'CORRECTION_DEADLINE_NOT_PASSED';
 END IF;
 SELECT max(created_at) INTO v_notice
 FROM public.application_status_history
 WHERE application_id=p_id AND to_status='needs_correction';
 IF v_notice IS NULL THEN RAISE EXCEPTION 'CORRECTION_HISTORY_MISSING'; END IF;
 -- If applicant uploaded a newer file after being asked to correct, an
 -- officer must review it manually; an expedited rejection is disallowed.
 IF EXISTS(SELECT 1 FROM public.application_documents d
    WHERE d.application_id=p_id AND d.uploaded_at>v_notice)
 OR EXISTS(SELECT 1 FROM public.application_document_versions d
    WHERE d.application_id=p_id AND d.uploaded_at>v_notice) THEN
   RAISE EXCEPTION 'CORRECTION_NEW_DOCUMENTS_FOUND';
 END IF;
 UPDATE public.applications SET
    status='ineligible',
    public_message=left(v_reason,1500),
    correction_deadline=NULL,
    updated_at=clock_timestamp()
 WHERE id=p_id;
 -- Existing application_state_log trigger records status history, audit log
 -- and notification/email outbox automatically.
END;
$func$;
REVOKE ALL ON FUNCTION public.staff_reject_expired_correction(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_reject_expired_correction(uuid,text) TO authenticated,service_role;
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
