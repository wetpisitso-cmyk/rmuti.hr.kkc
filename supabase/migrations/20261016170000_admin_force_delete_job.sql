-- Explicit, irreversible job deletion with all linked applicant records.
-- Admin confirmation must be given by exact job title. Reuses the existing
-- transactional, auditable applicant deletion RPC (and durable file queue).
CREATE OR REPLACE FUNCTION public.admin_force_delete_job(
  p_id uuid, p_expected_title text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_title text; v_app record; v_app_count integer:=0; v_exam_count integer:=0;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin'
  ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT title INTO v_title FROM public.job_positions WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DELETE_RECORD_NOT_FOUND'; END IF;
  IF v_title IS DISTINCT FROM p_expected_title OR btrim(coalesce(p_expected_title,''))=''
  THEN RAISE EXCEPTION 'DELETE_RECORD_MISMATCH'; END IF;

  -- Pre-check any R2 paths before touching data; safe until R2 cleanup live.
  IF EXISTS(
    SELECT 1 FROM public.applications a
    LEFT JOIN public.application_documents d ON d.application_id=a.id
    LEFT JOIN public.application_document_versions v ON v.application_id=a.id
    LEFT JOIN public.payment_records p ON p.application_id=a.id
    WHERE a.job_id=p_id AND (
      d.storage_path LIKE 'r2/%' OR v.storage_path LIKE 'r2/%'
      OR p.slip_path LIKE 'r2/%'
    )
  ) THEN RAISE EXCEPTION 'R2_CLEANUP_NOT_ENABLED'; END IF;

  FOR v_app IN
    SELECT id,application_number FROM public.applications
    WHERE job_id=p_id ORDER BY created_at FOR UPDATE
  LOOP
    IF v_app.application_number IS NOT NULL THEN
      PERFORM public.admin_delete_application(v_app.id,v_app.application_number);
    ELSE
      -- Drafts / unnumbered applications also need permanent deletion.
      -- Their files must still be queued before deleting their metadata.
      INSERT INTO public.application_file_cleanup_queue(bucket,path,application_id)
      SELECT DISTINCT 'application-files', z.path,v_app.id FROM (
        SELECT storage_path path FROM public.application_documents WHERE application_id=v_app.id
        UNION SELECT storage_path FROM public.application_document_versions WHERE application_id=v_app.id
        UNION SELECT slip_path FROM public.payment_records WHERE application_id=v_app.id
      ) z WHERE z.path IS NOT NULL AND z.path LIKE ('%/'||v_app.id::text||'/%')
      ON CONFLICT(bucket,path) DO NOTHING;
      DELETE FROM public.payment_records WHERE application_id=v_app.id;
      DELETE FROM public.exam_assignments WHERE application_id=v_app.id;
      DELETE FROM public.selection_results WHERE application_id=v_app.id;
      DELETE FROM public.notifications WHERE application_id=v_app.id;
      DELETE FROM public.staff_notes WHERE application_id=v_app.id;
      DELETE FROM public.application_document_versions WHERE application_id=v_app.id;
      DELETE FROM public.application_documents WHERE application_id=v_app.id;
      DELETE FROM public.application_status_history WHERE application_id=v_app.id;
      DELETE FROM public.application_education WHERE application_id=v_app.id;
      DELETE FROM public.application_experience WHERE application_id=v_app.id;
      DELETE FROM public.applications WHERE id=v_app.id;
    END IF;
    v_app_count:=v_app_count+1;
  END LOOP;

  SELECT count(*) INTO v_exam_count FROM public.exam_schedules WHERE job_id=p_id;
  DELETE FROM public.published_results WHERE job_id=p_id;
  DELETE FROM public.exam_schedules WHERE job_id=p_id;
  DELETE FROM public.job_positions WHERE id=p_id;

  INSERT INTO public.audit_logs(actor_id,entity,entity_id,action,metadata)
  VALUES(auth.uid(),'job_positions',p_id,'force_delete',
    jsonb_build_object('title',v_title,'applications_deleted',v_app_count,
      'exam_schedules_deleted',v_exam_count));
  RETURN jsonb_build_object('deleted',true,'applications_deleted',v_app_count,
    'exam_schedules_deleted',v_exam_count);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_force_delete_job(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_force_delete_job(uuid,text) TO authenticated;
