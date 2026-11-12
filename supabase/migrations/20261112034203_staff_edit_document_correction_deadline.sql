-- This migration was applied to production on 12 Nov 2026.
-- Staff may edit the deadline only for applications awaiting document corrections.
-- The existing status is preserved and the original correction-history timestamp
-- remains unchanged so the expired-correction document upload guard keeps working.
CREATE OR REPLACE FUNCTION private.staff_update_correction_deadline(p_id uuid, p_expected_deadline timestamp with time zone, p_new_deadline timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_app public.applications;
  v_old_text text;
  v_new_text text;
  v_message text;
BEGIN
  IF auth.uid() IS NULL OR NOT private.can('review') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_new_deadline IS NULL OR p_new_deadline <= clock_timestamp() THEN
    RAISE EXCEPTION 'DEADLINE_REQUIRED';
  END IF;

  SELECT * INTO v_app FROM public.applications WHERE id = p_id FOR UPDATE;
  IF v_app.id IS NULL OR v_app.archived_at IS NOT NULL
     OR v_app.submitted_at IS NULL OR v_app.status <> 'needs_correction' THEN
    RAISE EXCEPTION 'CORRECTION_NOT_PENDING';
  END IF;
  IF v_app.correction_deadline IS DISTINCT FROM p_expected_deadline THEN
    RAISE EXCEPTION 'CORRECTION_DEADLINE_CHANGED';
  END IF;
  IF v_app.correction_deadline IS NOT DISTINCT FROM p_new_deadline THEN
    RAISE EXCEPTION 'CORRECTION_DEADLINE_UNCHANGED';
  END IF;

  UPDATE public.applications
    SET correction_deadline = p_new_deadline, updated_at = clock_timestamp()
    WHERE id = p_id;

  INSERT INTO public.audit_logs(actor_id, entity, entity_id, action, metadata)
  VALUES (auth.uid(), 'application', p_id, 'correction_deadline_updated',
          jsonb_build_object('old_deadline', v_app.correction_deadline,
                             'new_deadline', p_new_deadline,
                             'status', v_app.status));

  IF v_app.correction_deadline IS NULL THEN
    v_old_text := 'ไม่ได้กำหนด';
  ELSE
    v_old_text := to_char(v_app.correction_deadline AT TIME ZONE 'Asia/Bangkok','DD/MM/')
      || (extract(year from v_app.correction_deadline AT TIME ZONE 'Asia/Bangkok')::int+543)::text
      || to_char(v_app.correction_deadline AT TIME ZONE 'Asia/Bangkok',' HH24:MI') || ' น.';
  END IF;
  v_new_text := to_char(p_new_deadline AT TIME ZONE 'Asia/Bangkok','DD/MM/')
    || (extract(year from p_new_deadline AT TIME ZONE 'Asia/Bangkok')::int+543)::text
    || to_char(p_new_deadline AT TIME ZONE 'Asia/Bangkok',' HH24:MI') || ' น.';
  v_message := 'เจ้าหน้าที่แก้ไขกำหนดส่งเอกสารประกอบใบสมัครจาก '
    || v_old_text || ' เป็น ' || v_new_text
    || ' กรุณาส่งเอกสารแก้ไขภายในกำหนดใหม่ในระบบรับสมัคร';
  PERFORM private.notify_once_in_app(
    'inapp:correction-deadline:v1:' || p_id::text || ':' || txid_current()::text,
    v_app.user_id, v_app.id, 'แจ้งเปลี่ยนกำหนดส่งเอกสาร', v_message
  );
  RETURN p_new_deadline;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.staff_update_correction_deadline(p_id uuid, p_expected_deadline timestamp with time zone, p_new_deadline timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  SELECT private.staff_update_correction_deadline(
    p_id, p_expected_deadline, p_new_deadline
  );
$function$
;

REVOKE ALL ON FUNCTION private.staff_update_correction_deadline(uuid,timestamptz,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.staff_update_correction_deadline(uuid,timestamptz,timestamptz) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.staff_update_correction_deadline(uuid,timestamptz,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_update_correction_deadline(uuid,timestamptz,timestamptz) TO authenticated, service_role;
COMMENT ON FUNCTION public.staff_update_correction_deadline(uuid,timestamptz,timestamptz)
IS 'Review-authorized change of pending document correction deadline. Preserves original status history, logs the change and notifies the applicant in-app.';
