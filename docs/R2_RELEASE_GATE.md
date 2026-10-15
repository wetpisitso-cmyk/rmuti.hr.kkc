# R2 rollout verification gate (production)

## Confirmed architecture
- Browser: GitHub Pages + React; **never** store R2 credentials in VITE_* or frontend config.
- PostgreSQL/Auth: Supabase stays authoritative for applications, ownership, audit history, and document metadata.
- Existing Supabase Storage files remain private and readable. No bulk migration/deletion is part of this change.
- New R2 keys are `r2/<user_uuid>/<application_uuid>/<object_uuid>.<pdf|jpg|png>`.
- Only authenticated Edge Functions use S3 credentials. Files are viewed through short-lived signed GET URLs.

## Current production stop conditions
1. The deployed `admin-cleanup-files` may still be the legacy Supabase-only version.
2. The database includes a temporary trigger guard against deleting references to R2 files.
3. A backend switch, `R2_CLEANUP_READY`, must **not** be set to true until deletion and retention are reviewed and tested.
4. Keep `R2_ENABLED=false` until all items below pass. Do not remove the R2 database deletion guard early.

## Required sequence — no production applicant files for testing
1. Provision a **private**, Standard Cloudflare R2 bucket with no public domain and a token restricted to its objects. Do this directly in the Cloudflare account (not through the browser frontend).
2. Put `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` in Supabase Edge Functions **Secrets**, not GitHub. Leave `R2_ENABLED=false` and `R2_CLEANUP_READY=false`.
3. Review and approve the exact deployed code of `admin-cleanup-files`. Confirm it matches the repository, validates the queue path, authenticates the real admin role, and supports **both** the legacy Supabase bucket and the R2 provider.
4. Test the cleanup function on a **separate test project** with disposable rows/objects. Test valid legacy/R2 objects; wrong bucket; traversal path; wrong application UUID; unauthorized requests; failure to delete an object; retries after partial failure.
5. Review existing production cleanup queue entries before calling the endpoint. These may include previously deleted applications; never clear the queue automatically as part of a migration.
6. Verify upload, signed preview, incorrect-user denial, file replacement, versioned documents, printable forms, and admin access using disposable applications. Check that no public document URL or credential leaks into frontend logs.
7. Prepare and review a separate production migration to retire the temporary R2 delete guard **only after** the R2-aware cleanup function has been deployed and tested. Neither the migration nor guard removal is part of this PR.
8. Only after successful review and staged tests, set `R2_CLEANUP_READY=true`; then enable `R2_ENABLED=true` to accept new R2 uploads.
9. Confirm the generated document path begins with `r2/`, signed read works, and deletion removes both metadata and the object in a controlled test. Inspect alerts and storage usage.

## Rollback
- Set `R2_ENABLED=false` to send **new** uploads back to Supabase Storage.
- Preserve Cloudflare bucket, token, secrets and the R2-aware read function as long as any R2 paths exist. Otherwise existing R2 documents will stop opening.
- Do not re-enable the legacy-only cleanup function while R2 queue items exist.
- If a validation fails, keep the R2 deletion guard and `R2_CLEANUP_READY=false`, investigate before resuming.

For initial Cloudflare account setup and the required secret names, see [CLOUDFLARE_R2.md](CLOUDFLARE_R2.md).
