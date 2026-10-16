-- RMUTI KKC: enforce 3 MiB maximum for ALL applicant uploads,
-- including applicant photo, required PDFs, optional documents and payment slips.
-- Existing stored files and metadata remain untouched.
-- Each position may choose 1, 2 or 3 MiB; never above 3 MiB.
ALTER TABLE public.job_positions ALTER COLUMN max_file_mb SET DEFAULT 3;
UPDATE public.job_positions SET max_file_mb=3 WHERE max_file_mb>3;
ALTER TABLE public.job_positions
  ADD CONSTRAINT job_positions_upload_limit_1_to_3
  CHECK (max_file_mb BETWEEN 1 AND 3);

-- Supabase bucket serves as another defense-in-depth check.
UPDATE storage.buckets SET file_size_limit=3145728
WHERE id='application-files';

-- The owner-scoped upload authorization function is the authoritative limit
-- for both Supabase and optional R2 upload paths and payment receipts.
CREATE OR REPLACE FUNCTION private.check_upload(
  p_id uuid,p_type text,p_user uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE a public.applications; j public.job_positions;
BEGIN
  SELECT * INTO a FROM public.applications WHERE id=p_id AND user_id=p_user;
  IF a.id IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO j FROM public.job_positions WHERE id=a.job_id;
  IF j.id IS NULL THEN RAISE EXCEPTION 'POSITION_NOT_FOUND'; END IF;

  IF p_type='payment' THEN
    IF j.fee_amount<=0 OR a.payment_status='confirmed'
      OR a.status IN ('ineligible','withdrawn')
    THEN RAISE EXCEPTION 'PAYMENT_LOCKED'; END IF;
  ELSE
    IF NOT private.editable(a.id,p_user)
      THEN RAISE EXCEPTION 'APPLICATION_LOCKED'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(j.required_documents) x
      WHERE x->>'key'=p_type
    ) THEN RAISE EXCEPTION 'INVALID_DOCUMENT_TYPE'; END IF;
  END IF;

  RETURN jsonb_build_object(
    'max_bytes',least(greatest(j.max_file_mb,1),3)*1048576
  );
END;
$$;
COMMENT ON FUNCTION private.check_upload(uuid,text,uuid) IS
'Authorizes owner upload and limits every new applicant image, PDF, and payment slip to 3 MiB maximum.';
