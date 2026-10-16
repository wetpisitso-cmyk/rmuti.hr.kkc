-- Separate, auditable Admin authorization for official application/PDF printing.
-- The application data is already visible to the applicant; this controls the
-- official print route and export, not the user's ability to copy their own data.
CREATE TABLE public.application_print_approvals (
  application_id uuid PRIMARY KEY REFERENCES public.applications(id) ON DELETE CASCADE,
  approved_by uuid NOT NULL REFERENCES auth.users(id),
  approved_at timestamptz NOT NULL DEFAULT now(),
  application_number_at_approval text NOT NULL,
  approved_snapshot_md5 text NOT NULL
);
ALTER TABLE public.application_print_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.application_print_approvals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.application_print_approvals TO authenticated;
GRANT ALL ON public.application_print_approvals TO service_role;
CREATE POLICY application_print_approval_read
ON public.application_print_approvals FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.applications a
          WHERE a.id=application_id AND a.user_id=(SELECT auth.uid()))
  OR (SELECT private.is_staff())
);

CREATE OR REPLACE FUNCTION public.admin_confirm_application_print(p_id uuid,p_confirm boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_app public.applications; v_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS
   (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin')
  THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_confirm IS DISTINCT FROM true THEN RAISE EXCEPTION 'PRINT_CONFIRMATION_REQUIRED'; END IF;
  SELECT * INTO v_app FROM public.applications WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_NOT_FOUND'; END IF;
  IF v_app.submitted_at IS NULL OR v_app.snapshot IS NULL OR
     nullif(btrim(v_app.application_number),'') IS NULL OR
     v_app.status::text IN ('draft','needs_correction','withdrawn')
  THEN RAISE EXCEPTION 'APPLICATION_NOT_READY_FOR_PRINT'; END IF;

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
$$;

REVOKE ALL ON FUNCTION public.admin_confirm_application_print(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_confirm_application_print(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_print_application(p_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_app public.applications;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT * INTO v_app FROM public.applications WHERE id=p_id;
  IF NOT FOUND OR (v_app.user_id<>auth.uid() AND NOT private.is_staff()) THEN
    RETURN false;
  END IF;
  IF v_app.submitted_at IS NULL OR v_app.snapshot IS NULL THEN RETURN false; END IF;
  IF private.is_staff() THEN RETURN true; END IF;
  IF v_app.status::text IN ('draft','needs_correction','withdrawn') THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.application_print_approvals p
    WHERE p.application_id=p_id
      AND p.application_number_at_approval=v_app.application_number
      AND p.approved_snapshot_md5=md5(v_app.snapshot::text)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.can_print_application(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_print_application(uuid) TO authenticated;

-- Free-form Unicode numbering: accept Thai and international characters,
-- preserve manual formatting/case and reject only control characters/empty
-- strings/overlong values; prevent duplicate numbers case-insensitively.
CREATE OR REPLACE FUNCTION public.admin_assign_application_number(p_id uuid,p_number text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_app public.applications; v_number text; v_changed boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS
    (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin')
  THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_app FROM public.applications WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_NOT_FOUND'; END IF;
  IF v_app.status::text NOT IN ('submitted','under_review','needs_correction','eligible','ineligible')
    OR v_app.submitted_at IS NULL
  THEN RAISE EXCEPTION 'APPLICATION_NOT_READY'; END IF;
  v_number=btrim(coalesce(p_number,''));
  IF length(v_number)<1 OR length(v_number)>80 OR v_number~'[[:cntrl:]]'
  THEN RAISE EXCEPTION 'INVALID_APPLICATION_NUMBER'; END IF;

  IF EXISTS(SELECT 1 FROM public.applications
    WHERE id<>p_id AND lower(application_number)=lower(v_number))
  THEN RAISE EXCEPTION 'DUPLICATE_APPLICATION_NUMBER'; END IF;

  v_changed := v_app.application_number IS DISTINCT FROM v_number;
  IF NOT v_changed THEN RETURN v_number; END IF;
  IF EXISTS(SELECT 1 FROM public.application_admin_signatures WHERE application_id=p_id)
  THEN RAISE EXCEPTION 'APPLICATION_NUMBER_LOCKED'; END IF;

  UPDATE public.applications SET application_number=v_number,updated_at=clock_timestamp()
  WHERE id=p_id;
  INSERT INTO public.audit_logs(actor_id,entity,entity_id,action,metadata)
  VALUES (auth.uid(),'applications',p_id,
    CASE WHEN v_app.application_number IS NULL THEN 'assign_application_number' ELSE 'change_application_number' END,
    jsonb_build_object('previous',v_app.application_number,'application_number',v_number));
  PERFORM private.notify(v_app.user_id,p_id,'เลขผู้สมัครได้รับการกำหนดแล้ว',
    'เจ้าหน้าที่ได้กำหนดเลขผู้สมัครเป็น '||v_number||' กรุณาเข้าสู่ระบบเพื่อตรวจสอบ',
    'application-number:'||p_id::text||':'||md5(v_number));
  RETURN v_number;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_assign_application_number(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_application_number(uuid,text) TO authenticated;
