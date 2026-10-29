# RMUTI KKC — private Backblaze B2 integration

This change is staged, **not automatically active**. The existing Supabase Storage
bucket and all existing application files remain intact. DO NOT delete them.

## 1. Create restricted B2 application key (account owner)
* Use the existing private B2 bucket `rumti.ac.th` exactly as shown in the dashboard.
* Application Keys → Add a New Application Key.
* Name: `rmuti-hr-storage`; Bucket: `rumti.ac.th`; Access: Read and Write.
* Copy the key ID and application key to a password manager. Never put them in
  chat, GitHub, frontend `VITE_*` variables or screenshots.
* B2 must stay **Private**. Do not enable public file listing.

## 2. Set Supabase Edge Function Secrets (account owner)
Supabase project `rioukmxrgaknayltxxyk` → Edge Functions → Secrets:

```text
B2_KEY_ID=<keyID from Backblaze>
B2_APP_KEY=<applicationKey from Backblaze>
B2_BUCKET=rumti.ac.th
B2_ENDPOINT=https://s3.<the-exact-bucket-region>.backblazeb2.com
B2_ENABLED=false
```

Do not invent the region: copy the **S3 Endpoint** from Backblaze's bucket
details. Keep `B2_ENABLED=false` while testing. Supabase's built-in credentials
and CORS `ALLOWED_ORIGINS` remain unchanged.

## 3. SQL and Edge Functions
Review and run `supabase/sql/b2_storage.sql` once in the Supabase SQL Editor.
It adds a service-role-only RPC and does not alter existing rows.

Deploy `upload-document` and `read-b2-document` Edge Functions to the Supabase
project, with JWT verified inside each function. The GitHub Pages deployment
**does not deploy Edge Functions or SQL**.

Deploy the frontend changes from this PR to support B2 reads.

## 4. Private end-to-end testing
1. Leave B2 disabled; verify applicant and staff access to an existing Supabase
   document still works.
2. Set `B2_ENABLED=true` only after the SQL and both Edge Functions deploy.
3. In a disposable test application, upload one JPG and one PDF, then open and
   fetch them as the owner and as authorized HR staff.
4. Confirm a different applicant cannot read either file (HTTP 403).
5. Confirm application submission and correction/resubmission still work.
6. On failure, set `B2_ENABLED=false`. New uploads then use the original
   Supabase Storage path, and existing B2 documents remain readable.
7. Audit the B2 uploaded file count and Supabase document references.

**Migration of historical files is a separate operation.** Never delete old
Supabase objects during this rollout. In particular, retaining file revisions
for audit and original application snapshots is required.

**Privacy note:** Documents may include identity cards, addresses and transcripts.
Obtain the university's authorization for the provider, data location, retention
and PDPA obligations before switching production applicants to B2.
