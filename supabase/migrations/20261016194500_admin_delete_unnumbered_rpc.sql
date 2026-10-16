-- Admin-only operation for permanently removing an unnumbered draft/withdrawn application.
-- Reuses the existing transactional admin_delete_application RPC so the file
-- cleanup queue and all dependent record handling stay in one place.
-- This migration defines the function only; it does not remove live records.
CREATE OR REPLACE FUNCTION public.admin_delete_unnumbered_application(
  p_id uuid, p_confirmation text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_status text;
  v_number text;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id=auth.uid() AND role='admin'
  ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  IF p_confirmation IS DISTINCT FROM 'ลบถาวร' THEN
    RAISE EXCEPTION 'CONFIRMATION_MISMATCH'; END IF;

  SELECT status::text, application_number INTO v_status,v_number
    FROM public.applications WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPLICATION_NOT_FOUND'; END IF;
  IF v_number IS NOT NULL OR v_status NOT IN ('draft','withdrawn') THEN
    RAISE EXCEPTION 'DELETE_ONLY_UNNUMBERED_DRAFT_OR_WITHDRAWN'; END IF;

  -- A temporary unique internal identifier lets us use the existing
  -- audited, cascade-cleanup deletion without weakening its confirmation.
  -- Both operations share a transaction; failures roll back this update.
  UPDATE public.applications
    SET application_number='INTERNAL-DELETE-'||p_id::text
    WHERE id=p_id;
  v_result := public.admin_delete_application(
    p_id,'INTERNAL-DELETE-'||p_id::text
  );
  RETURN v_result || jsonb_build_object('previous_status',v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_unnumbered_application(uuid,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_unnumbered_application(uuid,text)
  TO authenticated;
COMMENT ON FUNCTION public.admin_delete_unnumbered_application(uuid,text)
  IS 'Admin-confirmed atomic removal of unnumbered draft or withdrawn application; uses audited existing deletion and Storage cleanup queue.';
