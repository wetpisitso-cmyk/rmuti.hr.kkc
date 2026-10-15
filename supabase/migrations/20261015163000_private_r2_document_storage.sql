-- R2 files use a distinct "r2/" path prefix in existing document metadata.
-- Legacy Supabase Storage files are left untouched and remain readable.
-- Only the server-side upload function may register an R2 path after PUT succeeds.

CREATE OR REPLACE FUNCTION public.complete_r2_upload(
  p_user uuid,
  p_id uuid,
  p_type text,
  p_path text,
  p_name text,
  p_mime text,
  p_size integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old text;
  v_doc uuid;
  v_limits jsonb;
  v_extension text;
BEGIN
  PERFORM 1 FROM public.applications WHERE id = p_id FOR UPDATE;
  v_limits := private.check_upload(p_id,p_type,p_user);
  v_extension := CASE p_mime
    WHEN 'application/pdf' THEN 'pdf'
    WHEN 'image/png' THEN 'png'
    WHEN 'image/jpeg' THEN 'jpg'
    ELSE NULL
  END;
  IF p_user IS NULL OR p_id IS NULL OR v_extension IS NULL
    OR p_size <= 0 OR p_size > (v_limits->>'max_bytes')::integer
    OR (p_type = 'photo' AND p_mime = 'application/pdf')
    OR p_path !~ ('^r2/' || p_user::text || '/' || p_id::text ||
                  '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.' ||
                  v_extension || '$')
  THEN RAISE EXCEPTION 'INVALID_FILE'; END IF;

  SELECT storage_path INTO v_old
  FROM public.application_documents
  WHERE application_id = p_id AND document_type = p_type;

  IF v_old IS NOT NULL THEN
    INSERT INTO public.application_document_versions(application_id, document_type, storage_path, file_name)
    SELECT application_id,document_type,storage_path,file_name
    FROM public.application_documents
    WHERE application_id=p_id AND document_type=p_type
    ON CONFLICT (storage_path) DO NOTHING;
  END IF;

  INSERT INTO public.application_documents(
    application_id,document_type,storage_path,file_name,mime_type,size_bytes
  ) VALUES (
    p_id,p_type,p_path,left(p_name,250),p_mime,p_size
  )
  ON CONFLICT(application_id,document_type) DO UPDATE
    SET storage_path=EXCLUDED.storage_path,
        file_name=EXCLUDED.file_name,
        mime_type=EXCLUDED.mime_type,
        size_bytes=EXCLUDED.size_bytes,
        uploaded_at=now()
  RETURNING id INTO v_doc;

  RETURN jsonb_build_object('document_id',v_doc,'old_path',v_old);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_r2_upload(uuid,uuid,text,text,text,text,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_r2_upload(uuid,uuid,text,text,text,text,integer)
  TO service_role;
COMMENT ON FUNCTION public.complete_r2_upload(uuid,uuid,text,text,text,text,integer)
  IS 'Internal server-only metadata registration for Cloudflare R2; external object existence is verified by upload Edge Function after S3 PutObject.';
