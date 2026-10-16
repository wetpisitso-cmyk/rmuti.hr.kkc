-- Admin deletion fix: each protected table has a different file path column.
-- The former trigger referenced OLD.storage_path and OLD.slip_path in one
-- expression. On payment_records, OLD.storage_path is not a field; PostgreSQL
-- raises "record old has no field storage_path" before delete can proceed.
-- Convert OLD to jsonb first so absent keys are harmless and retain the
-- fail-closed rule on every table for any R2-backed document.
CREATE OR REPLACE FUNCTION private.block_unmanaged_r2_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_path text;
BEGIN
  IF TG_TABLE_NAME = 'payment_records' THEN
    v_path := to_jsonb(OLD)->>'slip_path';
  ELSIF TG_TABLE_NAME IN ('application_documents', 'application_document_versions') THEN
    v_path := to_jsonb(OLD)->>'storage_path';
  ELSE
    RAISE EXCEPTION 'INVALID_DOCUMENT_TABLE';
  END IF;

  IF v_path LIKE 'r2/%' THEN
    RAISE EXCEPTION 'R2_CLEANUP_NOT_ENABLED';
  END IF;
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION private.block_unmanaged_r2_delete() IS
'Guards deletions of R2-backed paths until approved R2 cleanup is ready; supports payment_records and both application document tables without field-name errors.';
