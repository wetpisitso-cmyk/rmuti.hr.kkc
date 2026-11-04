-- Applied to production previously: 20261031051624 immutable_job_specific_submission_order_20261031
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.

-- Separate, immutable position-local queue numbers. Do not change the
-- signed/approved official application_number or PDF snapshots.
ALTER TABLE public.applications ADD COLUMN position_order integer;

-- Include submitted applications that were later withdrawn or archived, so
-- each position's chronology is stable and historical slots are not reused.
WITH chronological AS (
 SELECT id, row_number() OVER (PARTITION BY job_id ORDER BY submitted_at, id)::integer AS seq
 FROM public.applications WHERE submitted_at IS NOT NULL
)
UPDATE public.applications AS a
SET position_order = chronological.seq
FROM chronological WHERE a.id=chronological.id;

ALTER TABLE public.applications
 ADD CONSTRAINT application_position_order_valid
 CHECK (position_order IS NULL OR position_order > 0),
 ADD CONSTRAINT application_position_order_only_submitted
 CHECK ((submitted_at IS NULL AND position_order IS NULL)
     OR (submitted_at IS NOT NULL AND position_order IS NOT NULL));

CREATE UNIQUE INDEX applications_position_order_unique
 ON public.applications (job_id,position_order)
 WHERE position_order IS NOT NULL;

CREATE TABLE private.job_submission_counters (
 job_id uuid PRIMARY KEY REFERENCES public.job_positions(id) ON DELETE CASCADE,
 last_issued integer NOT NULL CHECK(last_issued >= 0)
);
REVOKE ALL ON TABLE private.job_submission_counters FROM PUBLIC, anon, authenticated;

INSERT INTO private.job_submission_counters(job_id,last_issued)
SELECT job_id,max(position_order)
FROM public.applications
WHERE position_order IS NOT NULL
GROUP BY job_id;

CREATE FUNCTION private.assign_application_position_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $trigger$
DECLARE v_seq integer;
BEGIN
 IF TG_OP='INSERT' THEN
   IF NEW.position_order IS NOT NULL THEN RAISE EXCEPTION 'POSITION_ORDER_READONLY'; END IF;
 ELSE
   IF OLD.position_order IS NOT NULL AND (
      NEW.position_order IS DISTINCT FROM OLD.position_order OR
      NEW.job_id IS DISTINCT FROM OLD.job_id OR
      NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
   ) THEN RAISE EXCEPTION 'POSITION_ORDER_LOCKED'; END IF;
   IF OLD.position_order IS NULL AND NEW.position_order IS NOT NULL
   THEN RAISE EXCEPTION 'POSITION_ORDER_READONLY'; END IF;
 END IF;

 IF NEW.submitted_at IS NULL THEN
   IF NEW.position_order IS NOT NULL THEN RAISE EXCEPTION 'POSITION_ORDER_REQUIRES_SUBMISSION'; END IF;
   RETURN NEW;
 END IF;

 IF NEW.position_order IS NULL THEN
   -- Atomic per-position increment; concurrent submissions never share a number.
   INSERT INTO private.job_submission_counters AS c(job_id,last_issued)
   VALUES(NEW.job_id,1)
   ON CONFLICT (job_id) DO UPDATE SET last_issued=c.last_issued+1
   RETURNING last_issued INTO v_seq;
   NEW.position_order:=v_seq;
 END IF;
 RETURN NEW;
END;
$trigger$;

CREATE TRIGGER assign_position_order_on_submit
BEFORE INSERT OR UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION private.assign_application_position_order();

CREATE OR REPLACE FUNCTION private.staff_list(p_filters jsonb, p_page integer, p_size integer, p_sort text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_where text; v_rows jsonb; v_count bigint; v_order text;
begin
  if not private.is_staff() then raise exception 'FORBIDDEN'; end if;
  v_order=case p_sort when 'submission_order' then 'j.title asc,a.position_order asc' when 'number' then 'a.application_number' when 'status' then 'a.status' else 'a.created_at desc' end;
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
  execute 'select coalesce(jsonb_agg(t),''[]''::jsonb) from (select a.id,a.status,a.payment_status,a.application_number,a.position_order,a.personal_data,a.created_at,a.submitted_at,j.title as job_title,d.name as department_name,r.name as round_name,r.year_be'||v_where||
  ' order by '||v_order||',a.id limit $2 offset $3) t'
  into v_rows using p_filters,least(greatest(p_size,1),100),greatest(p_page,0)*least(greatest(p_size,1),100);
  return jsonb_build_object('rows',v_rows,'count',v_count);
end
$function$
;
