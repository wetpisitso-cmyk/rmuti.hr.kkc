-- Prepared for Google Drive integration. No existing document/storage object is altered.
-- The function is only executable by the service role (trusted Edge Function).
CREATE OR REPLACE FUNCTION public.complete_gdrive_upload(
  p_user uuid, p_id uuid, p_type text, p_path text,
  p_name text, p_mime text, p_size integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_old text; v_doc uuid; v_limits jsonb;
BEGIN
  PERFORM 1 FROM public.applications WHERE id=p_id FOR UPDATE;
  v_limits := private.check_upload(p_id,p_type,p_user);
  IF p_size<=0 OR p_size>(v_limits->>'max_bytes')::integer
    OR p_path NOT LIKE p_user::text||'/'||p_id::text||'/gdrive/%'
    OR p_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/gdrive/[A-Za-z0-9_-]{10,200}[.](pdf|jpg|png)$'
    OR p_mime NOT IN ('application/pdf','image/jpeg','image/png')
    OR (p_type='photo' AND p_mime='application/pdf')
  THEN RAISE EXCEPTION 'INVALID_FILE'; END IF;
  -- Only the backend may call this, after verifying the object in Google Drive.
  SELECT storage_path INTO v_old FROM public.application_documents
    WHERE application_id=p_id AND document_type=p_type;
  IF v_old IS NOT NULL THEN
    INSERT INTO public.application_document_versions(application_id,document_type,storage_path,file_name)
    SELECT application_id,document_type,storage_path,file_name
      FROM public.application_documents
      WHERE application_id=p_id AND document_type=p_type
    ON CONFLICT(storage_path) DO NOTHING;
  END IF;
  INSERT INTO public.application_documents(application_id,document_type,storage_path,file_name,mime_type,size_bytes)
  VALUES(p_id,p_type,p_path,left(p_name,250),p_mime,p_size)
  ON CONFLICT(application_id,document_type) DO UPDATE
    SET storage_path=excluded.storage_path, file_name=excluded.file_name,
        mime_type=excluded.mime_type, size_bytes=excluded.size_bytes,
        uploaded_at=now()
  RETURNING id INTO v_doc;
  RETURN jsonb_build_object('document_id',v_doc,'old_path',v_old);
END;
$$;
REVOKE ALL ON FUNCTION public.complete_gdrive_upload(uuid,uuid,text,text,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_gdrive_upload(uuid,uuid,text,text,text,text,integer) TO service_role;
