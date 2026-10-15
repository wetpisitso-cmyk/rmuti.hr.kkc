-- Temporary fail-closed retention guard for R2 documents.
-- The existing production admin-cleanup-files function only handles Supabase
-- Storage. Block deleting DB references to R2 objects until an approved
-- R2-capable cleanup function has been deployed and verified.
CREATE OR REPLACE FUNCTION private.block_unmanaged_r2_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF (TG_TABLE_NAME='application_documents' AND OLD.storage_path LIKE 'r2/%')
    OR (TG_TABLE_NAME='application_document_versions' AND OLD.storage_path LIKE 'r2/%')
    OR (TG_TABLE_NAME='payment_records' AND OLD.slip_path LIKE 'r2/%') THEN
    RAISE EXCEPTION 'R2_CLEANUP_NOT_ENABLED';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER r2_block_unmanaged_document_delete
  BEFORE DELETE ON public.application_documents
  FOR EACH ROW EXECUTE FUNCTION private.block_unmanaged_r2_delete();
CREATE TRIGGER r2_block_unmanaged_version_delete
  BEFORE DELETE ON public.application_document_versions
  FOR EACH ROW EXECUTE FUNCTION private.block_unmanaged_r2_delete();
CREATE TRIGGER r2_block_unmanaged_payment_delete
  BEFORE DELETE ON public.payment_records
  FOR EACH ROW EXECUTE FUNCTION private.block_unmanaged_r2_delete();
-- IMPORTANT: Do not drop these triggers until the approved production cleanup
-- function safely deletes R2 objects and preserves the durable cleanup queue.
