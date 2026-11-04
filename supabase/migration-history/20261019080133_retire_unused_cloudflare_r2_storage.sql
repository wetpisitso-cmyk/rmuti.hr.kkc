-- Applied to production previously: 20261019080133 retire_unused_cloudflare_r2_storage
-- HISTORICAL SNAPSHOT ONLY: do not replay into the live project.
-- Recovered from supabase_migrations.schema_migrations statements.
DROP TRIGGER IF EXISTS r2_block_unmanaged_document_delete ON public.application_documents;
DROP TRIGGER IF EXISTS r2_block_unmanaged_version_delete ON public.application_document_versions;
DROP TRIGGER IF EXISTS r2_block_unmanaged_payment_delete ON public.payment_records;
DROP FUNCTION IF EXISTS private.block_unmanaged_r2_delete();
DROP FUNCTION IF EXISTS public.complete_r2_upload(uuid,uuid,text,text,text,text,integer);
