-- Applied to production previously: 20261102013224 admin_editable_active_display_submission_order_20261102
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.

-- A separate staff-editable display sequence preserves immutable historical
-- position_order and official application_number on approved PDFs.
ALTER TABLE public.applications
  ADD COLUMN display_position_order integer;
ALTER TABLE public.applications
  ADD CONSTRAINT application_display_position_order_valid
  CHECK (display_position_order IS NULL OR
        (display_position_order > 0 AND submitted_at IS NOT NULL));

-- Keep every existing visible number unless a new hiring round was previously
-- populated only by archived, pre-opening test submissions.
UPDATE public.applications
SET display_position_order=position_order
WHERE submitted_at IS NOT NULL;

UPDATE public.applications a
SET display_position_order=1
FROM public.job_positions j
JOIN public.recruitment_rounds r ON r.id=j.round_id
WHERE a.job_id=j.id
  AND a.archived_at IS NULL
  AND a.submitted_at IS NOT NULL
  AND a.submitted_at >= r.opens_at
  AND a.position_order > 1
  AND (SELECT count(*) FROM public.applications active
       WHERE active.job_id=a.job_id AND active.archived_at IS NULL
         AND active.submitted_at IS NOT NULL)=1
  AND EXISTS (
       SELECT 1 FROM public.applications archived
       WHERE archived.job_id=a.job_id AND archived.archived_at IS NOT NULL
         AND archived.submitted_at < r.opens_at
  );

-- Archived historical numbers are not public-facing. Restoring a previously
-- archived application will safely reassign its displayed number on conflict.
CREATE UNIQUE INDEX applications_display_position_order_active_unique
  ON public.applications(job_id,display_position_order)
  WHERE archived_at IS NULL AND display_position_order IS NOT NULL;

CREATE TABLE private.job_display_counters(
  job_id uuid PRIMARY KEY REFERENCES public.job_positions(id) ON DELETE CASCADE,
  last_issued integer NOT NULL CHECK (last_issued >= 0)
);
REVOKE ALL ON TABLE private.job_display_counters FROM PUBLIC,anon,authenticated;
INSERT INTO private.job_display_counters(job_id,last_issued)
SELECT job_id,max(display_position_order)
FROM public.applications
WHERE archived_at IS NULL AND display_position_order IS NOT NULL
GROUP BY job_id;

CREATE FUNCTION private.assign_application_display_position_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $f$
DECLARE v_next integer;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.display_position_order IS NOT NULL THEN
      RAISE EXCEPTION 'DISPLAY_POSITION_ORDER_READONLY';
    END IF;
  ELSE
    IF NEW.display_position_order IS DISTINCT FROM OLD.display_position_order
       AND NOT (
         private.can('admin')
         AND current_setting('app.display_position_order_rpc',true)='yes'
       )
    THEN
      RAISE EXCEPTION 'DISPLAY_POSITION_ORDER_READONLY';
    END IF;
  END IF;

  IF NEW.submitted_at IS NULL THEN
    IF NEW.display_position_order IS NOT NULL THEN
      RAISE EXCEPTION 'DISPLAY_POSITION_ORDER_REQUIRES_SUBMISSION';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.display_position_order IS NULL OR (
       TG_OP='UPDATE' AND OLD.archived_at IS NOT NULL
       AND NEW.archived_at IS NULL
       AND EXISTS(
         SELECT 1 FROM public.applications other
         WHERE other.job_id=NEW.job_id AND other.id<>NEW.id
           AND other.archived_at IS NULL
           AND other.display_position_order=NEW.display_position_order
       )
     ) THEN
    INSERT INTO private.job_display_counters AS c(job_id,last_issued)
    VALUES(NEW.job_id,1)
    ON CONFLICT(job_id) DO UPDATE SET last_issued=c.last_issued+1
    RETURNING last_issued INTO v_next;
    NEW.display_position_order:=v_next;
  END IF;

  RETURN NEW;
END;
$f$;
REVOKE ALL ON FUNCTION private.assign_application_display_position_order() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER assign_display_order_on_submit
  BEFORE INSERT OR UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION private.assign_application_display_position_order();

-- Only an authenticated administrator can override the active display number.
-- The immutable chronological sequence, official number and PDF approvals remain unchanged.
CREATE FUNCTION public.admin_set_display_position_order(p_id uuid,p_number integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $f$
DECLARE v_app public.applications;
DECLARE v_max integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(
      SELECT 1 FROM public.user_roles
      WHERE user_id=auth.uid() AND role='admin'
  ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  IF p_number IS NULL OR p_number<1 OR p_number>1000000 THEN
    RAISE EXCEPTION 'INVALID_DISPLAY_POSITION_ORDER';
  END IF;

  SELECT * INTO v_app FROM public.applications WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_NOT_FOUND'; END IF;
  IF v_app.submitted_at IS NULL OR v_app.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'DISPLAY_ORDER_ACTIVE_SUBMISSION_REQUIRED';
  END IF;
  IF v_app.display_position_order=p_number THEN RETURN p_number; END IF;

  -- Serialize against concurrent new submissions from the same job.
  PERFORM 1 FROM private.job_display_counters
  WHERE job_id=v_app.job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DISPLAY_COUNTER_MISSING'; END IF;

  IF EXISTS(
      SELECT 1 FROM public.applications other
      WHERE other.job_id=v_app.job_id
        AND other.id<>p_id
        AND other.archived_at IS NULL
        AND other.display_position_order=p_number
  ) THEN RAISE EXCEPTION 'DISPLAY_ORDER_ALREADY_USED'; END IF;

  PERFORM set_config('app.display_position_order_rpc','yes',true);
  UPDATE public.applications
     SET display_position_order=p_number,updated_at=clock_timestamp()
   WHERE id=p_id;
  PERFORM set_config('app.display_position_order_rpc','',true);

  SELECT coalesce(max(display_position_order),0)
    INTO v_max FROM public.applications
   WHERE job_id=v_app.job_id AND archived_at IS NULL
     AND display_position_order IS NOT NULL;
  UPDATE private.job_display_counters
     SET last_issued=v_max
   WHERE job_id=v_app.job_id;

  INSERT INTO public.audit_logs(actor_id,entity,entity_id,action,metadata)
  VALUES(auth.uid(),'applications',p_id,'admin_change_display_position_order',
    jsonb_build_object('previous',v_app.display_position_order,
      'new',p_number,'original_immutable_order',v_app.position_order,
      'job_id',v_app.job_id));

  RETURN p_number;
END;
$f$;
REVOKE ALL ON FUNCTION public.admin_set_display_position_order(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_display_position_order(uuid,integer) TO authenticated,service_role;

-- Keep all staff list/report consumers in sync with the corrected display field.
CREATE OR REPLACE FUNCTION private.staff_list(p_filters jsonb,p_page integer,p_size integer,p_sort text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $f$
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
  EXECUTE 'select coalesce(jsonb_agg(t),''[]''::jsonb) from (select a.id,a.status,a.payment_status,a.application_number,a.position_order,a.display_position_order,a.personal_data,a.created_at,a.submitted_at,j.title as job_title,d.name as department_name,r.name as round_name,r.year_be'||v_where||
  ' order by '||v_order||',a.id limit $2 offset $3) t'
  INTO v_rows USING p_filters,least(greatest(p_size,1),100),
  greatest(p_page,0)*least(greatest(p_size,1),100);
  RETURN jsonb_build_object('rows',v_rows,'count',v_count);
END;
$f$;

-- Document the one-time correction without altering archived test records.
INSERT INTO public.audit_logs(actor_id,entity,entity_id,action,metadata)
SELECT NULL,'applications',a.id,'migration_initialize_display_order',
       jsonb_build_object('original',a.position_order,'visible',a.display_position_order,
                          'reason','archived_preopening_submissions_excluded')
FROM public.applications a
WHERE a.display_position_order IS DISTINCT FROM a.position_order;

