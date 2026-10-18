-- Enforce Admin signature before allowing applicant PDF downloads.
CREATE OR REPLACE FUNCTION public.admin_confirm_application_print(p_id uuid, p_confirm boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_app public.applications; v_at timestamptz; v_signature public.application_admin_signatures;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS
   (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin')
  THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_confirm IS DISTINCT FROM true THEN RAISE EXCEPTION 'PRINT_CONFIRMATION_REQUIRED'; END IF;
  SELECT * INTO v_app FROM public.applications WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_NOT_FOUND'; END IF;
  IF v_app.submitted_at IS NULL OR v_app.snapshot IS NULL OR v_app.archived_at IS NOT NULL
    OR nullif(btrim(v_app.application_number),'') IS NULL OR v_app.status::text <> 'eligible'
    OR v_app.payment_status::text NOT IN ('confirmed','not_required')
    OR NOT EXISTS (SELECT 1 FROM public.application_review_steps st WHERE st.application_id=p_id AND st.step='personal')
    OR NOT EXISTS (SELECT 1 FROM public.application_review_steps st WHERE st.application_id=p_id AND st.step='documents')
  THEN RAISE EXCEPTION 'APPLICATION_NOT_READY_FOR_PRINT'; END IF;
  SELECT * INTO v_signature FROM public.application_admin_signatures WHERE application_id=p_id;
  IF NOT FOUND OR v_signature.application_number_at_signing IS DISTINCT FROM v_app.application_number
    OR v_signature.signed_snapshot_md5 IS DISTINCT FROM md5(v_app.snapshot::text)
  THEN RAISE EXCEPTION 'ADMIN_SIGNATURE_REQUIRED'; END IF;

  INSERT INTO public.application_print_approvals
    (application_id,approved_by,application_number_at_approval,approved_snapshot_md5)
  VALUES (p_id,auth.uid(),v_app.application_number,md5(v_app.snapshot::text))
  ON CONFLICT(application_id) DO UPDATE SET
    approved_by=EXCLUDED.approved_by,
    approved_at=clock_timestamp(),
    application_number_at_approval=EXCLUDED.application_number_at_approval,
    approved_snapshot_md5=EXCLUDED.approved_snapshot_md5
  RETURNING approved_at INTO v_at;

  INSERT INTO public.audit_logs(actor_id,entity,entity_id,action,metadata)
  VALUES (auth.uid(),'applications',p_id,'admin_confirm_print',
    jsonb_build_object('application_number',v_app.application_number,'confirmed_at',v_at));
  PERFORM private.notify(v_app.user_id,p_id,'ดาวน์โหลดใบสมัครได้แล้ว',
    'เจ้าหน้าที่ได้ยืนยันใบสมัครเลขที่ '||v_app.application_number||
    ' แล้ว สามารถพิมพ์หรือบันทึกใบสมัครเป็น PDF จากบัญชีของคุณได้',
    'application-print:'||p_id::text||':'||md5(v_app.application_number||v_app.snapshot::text));
  RETURN jsonb_build_object('approved',true,'approved_at',v_at);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_print_application(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_app public.applications;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT * INTO v_app FROM public.applications WHERE id=p_id;
  IF NOT FOUND OR (v_app.user_id<>auth.uid() AND NOT private.is_staff()) THEN
    RETURN false;
  END IF;
  IF v_app.submitted_at IS NULL OR v_app.snapshot IS NULL OR v_app.archived_at IS NOT NULL THEN RETURN false; END IF;
  IF private.is_staff() THEN RETURN true; END IF;
  IF v_app.status::text <> 'eligible' OR nullif(btrim(v_app.application_number),'') IS NULL
    OR v_app.payment_status::text NOT IN ('confirmed','not_required')
    OR NOT EXISTS (SELECT 1 FROM public.application_review_steps st WHERE st.application_id=p_id AND st.step='personal')
    OR NOT EXISTS (SELECT 1 FROM public.application_review_steps st WHERE st.application_id=p_id AND st.step='documents')
  THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.application_print_approvals p
    JOIN public.application_admin_signatures s ON s.application_id=p.application_id
    WHERE p.application_id=p_id
      AND p.application_number_at_approval=v_app.application_number
      AND p.approved_snapshot_md5=md5(v_app.snapshot::text)
      AND s.application_number_at_signing=v_app.application_number
      AND s.signed_snapshot_md5=md5(v_app.snapshot::text)
      AND p.approved_at >= s.signed_at
  );
END;
$function$
;
