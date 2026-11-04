-- Applied to production previously: 20261103014531 exam_card_print_date_oct30_for_two_jobs
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.
CREATE TABLE IF NOT EXISTS private.exam_card_print_date_overrides(
 job_id uuid PRIMARY KEY REFERENCES public.job_positions(id) ON DELETE RESTRICT,
 printed_issue_date date NOT NULL,
 reason text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE private.exam_card_print_date_overrides ENABLE ROW LEVEL SECURITY;
-- Private table: no direct REST access, only the existing authenticated
-- exam_card_info security-definer RPC may read the printable date.
REVOKE ALL ON TABLE private.exam_card_print_date_overrides FROM PUBLIC,anon,authenticated;

DO $block$
DECLARE v_ids uuid[];
BEGIN
 SELECT array_agg(id ORDER BY title) INTO v_ids FROM public.job_positions
 WHERE title IN ('เจ้าหน้าที่บริหารงานทั่วไป คณะบริหารธุรกิจและเทคโนโลยีสารสนเทศ','ช่างเทคนิค คณะบริหารธุรกิจและเทคโนโลยีสารสนเทศ');
 IF cardinality(v_ids) <> 2 THEN
   RAISE EXCEPTION 'Expected two exact job positions, got %',cardinality(v_ids);
 END IF;

 INSERT INTO private.exam_card_print_date_overrides
 (job_id,printed_issue_date,reason)
 SELECT j.id,DATE '2026-10-30',
  'Administrative date printed on examination cards, as requested for these two recruitment positions; actual issued_at remains unchanged.'
 FROM public.job_positions j WHERE j.id = ANY(v_ids)
 ON CONFLICT(job_id) DO UPDATE SET
  printed_issue_date=excluded.printed_issue_date,
  reason=excluded.reason,
  recorded_at=clock_timestamp();

 INSERT INTO public.audit_logs(actor_id,entity,entity_id,action,metadata)
 SELECT null,'exam_card_print_date',j.id,'set_print_date',
  jsonb_build_object('date','2026-10-30','job_title',j.title,
    'actual_issuance_preserved',true,'requested_scope','two specified recruitment positions')
 FROM public.job_positions j WHERE j.id=ANY(v_ids);
END;
$block$;

CREATE OR REPLACE FUNCTION public.exam_card_info(p_assignment uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v record;
begin
  select ea.id,a.id as application_id,a.user_id,a.status,a.archived_at,
    a.application_number,ea.exam_number,
    a.personal_data->>'prefix' as prefix,
    a.personal_data->>'first_name' as first_name,
    a.personal_data->>'last_name' as last_name,
    j.title as job_title,d.name as department,
    r.id as round_id,r.year_be,r.name as round_name,
    coalesce(cfg.issue_label,'ครั้งที่ 40 / 2569') as issue_label,
    s.title as exam_title,s.exam_at,s.venue,s.published,
    issue.issued_at,issue.revoked_at,
    printed_date.printed_issue_date,
    issue.exam_number_at_issue,issue.issue_label_at_issue,issue.snapshot_md5_at_issue,
    (select ad.storage_path from public.application_documents ad
      where ad.application_id=a.id and ad.document_type='photo' and ad.mime_type like 'image/%'
      order by ad.uploaded_at desc limit 1) as photo_path,
    sig.signature_png,sig.signer_name,
    sig.application_number_at_signing,sig.signed_snapshot_md5,sig.signed_at,
    pa.approved_snapshot_md5,pa.application_number_at_approval,pa.approved_at,
    a.snapshot,a.payment_status
  into v from public.exam_assignments ea
  join public.exam_schedules s on s.id=ea.schedule_id
  join public.applications a on a.id=ea.application_id
  join public.job_positions j on j.id=a.job_id and j.id=s.job_id
  join public.departments d on d.id=j.department_id
  join public.recruitment_rounds r on r.id=j.round_id
  left join public.exam_card_round_settings cfg on cfg.round_id=r.id
  left join public.exam_card_issues issue on issue.assignment_id=ea.id
  left join private.exam_card_print_date_overrides printed_date on printed_date.job_id=j.id
  left join public.application_admin_signatures sig on sig.application_id=a.id
  left join public.application_print_approvals pa on pa.application_id=a.id
  where ea.id=p_assignment;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  if not(v.user_id=auth.uid() or private.can('exams'))
  then raise exception 'FORBIDDEN'; end if;
  if v.status::text<>'eligible' or v.archived_at is not null
     or v.issued_at is null or v.revoked_at is not null
     or v.published is distinct from true
     or v.payment_status::text not in ('confirmed','not_required')
     or v.photo_path is null
     or v.exam_number is distinct from v.exam_number_at_issue
     or md5(v.snapshot::text) is distinct from v.snapshot_md5_at_issue
     or v.signature_png is null
     or v.application_number_at_signing is distinct from v.application_number
     or v.signed_snapshot_md5 is distinct from md5(v.snapshot::text)
     or v.approved_snapshot_md5 is distinct from md5(v.snapshot::text)
     or v.application_number_at_approval is distinct from v.application_number
     or v.approved_at is null or v.approved_at<v.signed_at
  then raise exception 'EXAM_CARD_NOT_AVAILABLE'; end if;
  return jsonb_build_object(
    'assignment_id',v.id,'application_id',v.application_id,
    'exam_number',v.exam_number_at_issue,
    'name',concat_ws(' ',nullif(v.prefix,''),nullif(v.first_name,''),nullif(v.last_name,'')),
    'job_title',v.job_title,'department',v.department,
    'issue_label',v.issue_label_at_issue,'year_be',v.year_be,'round_name',v.round_name,
    'photo_path',v.photo_path,'signature_png',v.signature_png,
    'signer_name',v.signer_name,'issued_at',v.issued_at,
    'printed_issue_date',v.printed_issue_date);
end $function$


