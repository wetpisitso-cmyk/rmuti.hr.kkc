-- Retire unused Cloudflare R2 integration. All document metadata and queued paths
-- were verified to contain zero R2 references before this migration.
DROP TRIGGER IF EXISTS r2_block_unmanaged_document_delete ON public.application_documents;
DROP TRIGGER IF EXISTS r2_block_unmanaged_version_delete ON public.application_document_versions;
DROP TRIGGER IF EXISTS r2_block_unmanaged_payment_delete ON public.payment_records;
DROP FUNCTION IF EXISTS private.block_unmanaged_r2_delete();
DROP FUNCTION IF EXISTS public.complete_r2_upload(uuid,uuid,text,text,text,text,integer);
