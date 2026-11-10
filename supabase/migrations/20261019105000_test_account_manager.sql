-- Safe test-account workflow: only Admin may inspect, tag, reset, and prepare deletion.
-- Existing applicants are not tagged or altered by installing this migration.
CREATE TABLE IF NOT EXISTS private.test_account_registry(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 marked_email text NOT NULL,
 marked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 marked_at timestamptz NOT NULL DEFAULT now(),
 state text NOT NULL DEFAULT 'test' CHECK (state IN ('test','deleting'))
);
ALTER TABLE private.test_account_registry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.test_account_registry FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.test_account_report(p_email text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE v_user uuid; v_email text; v_role text; v_state text; v_apps jsonb; v_receipts int; v_r2 int;
BEGIN
 SELECT id,email INTO v_user,v_email FROM auth.users WHERE lower(email)=lower(btrim(p_email));
 IF v_user IS NULL THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND'; END IF;
 SELECT role::text INTO v_role FROM public.user_roles WHERE user_id=v_user;
 SELECT state INTO v_state FROM private.test_account_registry WHERE user_id=v_user;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',a.id,'status',a.status::text,'application_number',a.application_number,
  'title',coalesce(j.title,'ไม่ระบุตำแหน่ง'),'archived',a.archived_at IS NOT NULL,
  'payment_status',a.payment_status::text,
  'documents',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'file_name',d.file_name,'document_type',d.document_type))
      FROM public.application_documents d WHERE d.application_id=a.id),'[]'::jsonb),
  'versions',(SELECT count(*) FROM public.application_document_versions d WHERE d.application_id=a.id),
  'payment_slips',(SELECT count(*) FROM public.payment_records p WHERE p.application_id=a.id),
  'receipts',(SELECT count(*) FROM public.payment_receipts r WHERE r.application_id=a.id)
 ) ORDER BY a.created_at,a.id),'[]'::jsonb) INTO v_apps
 FROM public.applications a LEFT JOIN public.job_positions j ON j.id=a.job_id
 WHERE a.user_id=v_user;
 SELECT count(*) INTO v_receipts FROM public.payment_receipts r
   JOIN public.applications a ON a.id=r.application_id WHERE a.user_id=v_user;
 SELECT count(*) INTO v_r2 FROM (
   SELECT d.storage_path AS path FROM public.application_documents d
     JOIN public.applications a ON a.id=d.application_id WHERE a.user_id=v_user
   UNION ALL SELECT d.storage_path FROM public.application_document_versions d
     JOIN public.applications a ON a.id=d.application_id WHERE a.user_id=v_user
   UNION ALL SELECT p.slip_path FROM public.payment_records p
     JOIN public.applications a ON a.id=p.application_id WHERE a.user_id=v_user
 ) f WHERE path LIKE 'r2/%';
 RETURN jsonb_build_object(
  'id',v_user,'email',v_email,'role',coalesce(v_role,'unknown'),
  'tagged',v_state IS NOT NULL,'state',coalesce(v_state,'unmarked'),
  'applications',v_apps,'receipts',v_receipts,'r2_files',v_r2,
  'delete_blocked',v_receipts>0 OR v_r2>0 OR EXISTS(
    SELECT 1 FROM public.applications WHERE user_id=v_user AND payment_status::text='confirmed'
  ),
  'queued_files',(SELECT count(*) FROM public.application_file_cleanup_queue q WHERE
      q.application_id IN (SELECT id FROM public.applications WHERE user_id=v_user))
 );
END $body$;
REVOKE ALL ON FUNCTION private.test_account_report(text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_preview_test_account(p_email text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE v_data jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin'
 ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_email IS NULL OR length(btrim(p_email)) NOT BETWEEN 5 AND 254
   THEN RAISE EXCEPTION 'INVALID_EMAIL'; END IF;
 v_data:=private.test_account_report(p_email);
 RETURN v_data || jsonb_build_object('fingerprint',md5(v_data::text));
END $body$;
REVOKE ALL ON FUNCTION public.admin_preview_test_account(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_preview_test_account(text) TO authenticated;

-- Only blocks future edits for accounts undergoing irreversible deletion.
CREATE OR REPLACE FUNCTION private.reject_deleting_test_account_application()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $body$
BEGIN
 IF EXISTS (SELECT 1 FROM private.test_account_registry
   WHERE user_id=NEW.user_id AND state='deleting') THEN
    RAISE EXCEPTION 'TEST_ACCOUNT_DELETION_PENDING';
 END IF;
 RETURN NEW;
END $body$;
DROP TRIGGER IF EXISTS block_deleting_test_account_applications ON public.applications;
CREATE TRIGGER block_deleting_test_account_applications
BEFORE INSERT OR UPDATE ON public.applications FOR EACH ROW
EXECUTE FUNCTION private.reject_deleting_test_account_application();

CREATE OR REPLACE FUNCTION public.admin_test_account_action(
 p_email text,p_mode text,p_fingerprint text,p_confirmation text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE v_user uuid; v_email text; v_role text; v_state text;
 v_data jsonb; v_app record; v_ids uuid[]:='{}'::uuid[];
 v_new_queued int; v_queued int:=0; v_count int:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin'
 ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_mode NOT IN ('mark','reset','prepare_delete') OR
   p_email IS NULL OR length(btrim(p_email)) NOT BETWEEN 5 AND 254
   THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
 SELECT id,email INTO v_user,v_email FROM auth.users
   WHERE lower(email)=lower(btrim(p_email)) FOR UPDATE;
 IF v_user IS NULL THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND'; END IF;
 IF v_user=auth.uid() THEN RAISE EXCEPTION 'CANNOT_MANAGE_SELF'; END IF;
 SELECT role::text INTO v_role FROM public.user_roles WHERE user_id=v_user;
 IF v_role IS DISTINCT FROM 'applicant' THEN RAISE EXCEPTION 'APPLICANT_ONLY'; END IF;
 SELECT state INTO v_state FROM private.test_account_registry WHERE user_id=v_user;
 v_data:=private.test_account_report(v_email);
 IF p_fingerprint IS DISTINCT FROM md5(v_data::text) THEN
   RAISE EXCEPTION 'PREVIEW_CHANGED_RECHECK'; END IF;
 IF p_mode='mark' THEN
  IF p_confirmation IS DISTINCT FROM 'ยืนยันบัญชีทดสอบ' OR v_state IS NOT NULL
  THEN RAISE EXCEPTION 'CONFIRMATION_MISMATCH'; END IF;
  INSERT INTO private.test_account_registry(user_id,marked_email,marked_by)
     VALUES(v_user,v_email,auth.uid());
  INSERT INTO public.audit_logs(actor_id,entity,entity_id,action,metadata)
     VALUES(auth.uid(),'test_account',v_user,'mark_test',jsonb_build_object('email',v_email));
  RETURN jsonb_build_object('tagged',true);
 END IF;
 IF v_state IS NULL THEN RAISE EXCEPTION 'NOT_MARKED_TEST_ACCOUNT'; END IF;
 IF p_mode='reset' THEN
  IF v_state<>'test' OR p_confirmation IS DISTINCT FROM 'รีเซ็ตใบสมัครทดสอบ'
  THEN RAISE EXCEPTION 'CONFIRMATION_MISMATCH'; END IF;
  -- Reversible archive preserves receipts, signatures and R2 files.
  FOR v_app IN SELECT id,application_number FROM public.applications
    WHERE user_id=v_user AND archived_at IS NULL ORDER BY created_at,id
  LOOP
    PERFORM public.admin_archive_application(v_app.id,
       coalesce(v_app.application_number,'ย้ายไปสำรอง'));
    v_count:=v_count+1;
  END LOOP;
  RETURN jsonb_build_object('reset',true,'archived_applications',v_count);
 END IF;
 IF p_confirmation IS DISTINCT FROM 'ลบบัญชีทดสอบถาวร' THEN
   RAISE EXCEPTION 'CONFIRMATION_MISMATCH'; END IF;
 IF v_state<>'test' AND v_state<>'deleting' THEN
   RAISE EXCEPTION 'INVALID_STATE'; END IF;
 IF (v_data->>'delete_blocked')::boolean THEN
   RAISE EXCEPTION 'ACCOUNT_HAS_PROTECTED_RECEIPT_PAYMENT_OR_R2'; END IF;
 -- This irreversible path is deliberately restricted to non-financial legacy-storage test data.
 FOR v_app IN SELECT id FROM public.applications WHERE user_id=v_user FOR UPDATE LOOP
   INSERT INTO public.application_file_cleanup_queue(bucket,path,application_id)
   SELECT DISTINCT 'application-files',f.path,v_app.id FROM (
    SELECT storage_path path FROM public.application_documents WHERE application_id=v_app.id
    UNION SELECT storage_path FROM public.application_document_versions WHERE application_id=v_app.id
    UNION SELECT slip_path FROM public.payment_records WHERE application_id=v_app.id
   ) f WHERE f.path IS NOT NULL AND
      f.path LIKE ('%/'||v_app.id::text||'/%')
      AND f.path NOT LIKE 'r2/%'
   ON CONFLICT(bucket,path) DO NOTHING;
   GET DIAGNOSTICS v_new_queued=ROW_COUNT;
   v_queued:=v_queued+v_new_queued;
   DELETE FROM private.application_archive_backups WHERE application_id=v_app.id;
   DELETE FROM public.payment_records WHERE application_id=v_app.id;
   DELETE FROM public.exam_assignments WHERE application_id=v_app.id;
   DELETE FROM public.selection_results WHERE application_id=v_app.id;
   DELETE FROM public.staff_notes WHERE application_id=v_app.id;
   DELETE FROM public.notifications WHERE application_id=v_app.id;
   DELETE FROM public.application_document_versions WHERE application_id=v_app.id;
   DELETE FROM public.application_documents WHERE application_id=v_app.id;
   DELETE FROM public.application_status_history WHERE application_id=v_app.id;
   DELETE FROM public.application_education WHERE application_id=v_app.id;
   DELETE FROM public.application_experience WHERE application_id=v_app.id;
   DELETE FROM public.applications WHERE id=v_app.id;
   v_ids:=array_append(v_ids,v_app.id);
 END LOOP;
 DELETE FROM public.notifications WHERE user_id=v_user;
 DELETE FROM public.email_outbox WHERE user_id=v_user;
 -- Keep the audit trail, but release its auth-user FK.
 UPDATE public.audit_logs SET actor_id=NULL WHERE actor_id=v_user;
 UPDATE private.test_account_registry SET state='deleting' WHERE user_id=v_user;
 INSERT INTO public.audit_logs(actor_id,entity,entity_id,action,metadata)
 VALUES(auth.uid(),'test_account',v_user,'prepare_delete',
     jsonb_build_object('email',v_email,'applications',cardinality(v_ids),'queued_files',v_queued));
 RETURN jsonb_build_object('prepared',true,'user_id',v_user,
  'applications_removed',cardinality(v_ids),'files_queued',v_queued,'application_ids',to_jsonb(v_ids));
END $body$;
REVOKE ALL ON FUNCTION public.admin_test_account_action(text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_test_account_action(text,text,text,text) TO authenticated;
