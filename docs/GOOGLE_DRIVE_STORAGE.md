# RMUTI KKC — Google Workspace Shared Drive (staged integration)

> **NOT ENABLED IN PRODUCTION.** The existing Supabase Storage
> \`application-files\` bucket remains the default; no existing files are
> moved or deleted. No credentials should ever be committed to GitHub.

## Verified organizational resources

- Google Cloud project ID: \`rmuti-kkc\` (Google Drive API enabled).
- Shared Drive: \`RMUTI KKC - เอกสารรับสมัครงาน\`
- Shared Drive ID: \`0AL0COkD40qUIUk9PVA\`
- Private folder: \`RMUTI-KKC-Applicant-Documents\`
- Folder ID: \`1knVGEw4ha1s5MxLz00aUfYWYAR_mmG76\`
- Supabase project: \`rioukmxrgaknayltxxyk\`

## Google Cloud owner actions

1. IAM & Admin → Service Accounts → Create service account named
   \`rmuti-kkc-drive\`. The email should resemble
   \`rmuti-kkc-drive@rmuti-kkc.iam.gserviceaccount.com\`.
2. No Cloud IAM project role is needed for the Drive upload workflow.
3. In Google Drive → Shared Drive → Manage members, add the **actual**
   service account email as **Content manager** (requires Workspace
   sharing policy approval). Do not enable "anyone with the link".
4. Check university data protection, records retention, service account
   authorization, shared-drive quota and Google Workspace policy.
5. Credential choices: prefer administrator-approved keyless identity
   federation; where unavailable and expressly approved, generate a
   JSON service-account key and store it ONLY in Supabase Edge Function
   Secrets. This prepared implementation currently accepts a JSON key,
   not identity federation. Never paste the JSON key into chat or GitHub.

## Supabase Edge Function Secrets

Only after administrator approval, set:

\`\`\`
GDRIVE_FOLDER_ID=1knVGEw4ha1s5MxLz00aUfYWYAR_mmG76
GDRIVE_SERVICE_ACCOUNT_JSON=<private JSON key; store securely in Supabase only>
GDRIVE_ENABLED=false
B2_ENABLED=false
\`\`\`

The \`GDRIVE_ENABLED\` flag stays **false** until authentication, access
control, upload/read and rollback tests are successful.

## Deployment sequence

1. Review SQL in \`supabase/sql/gdrive_storage.sql\`; the service-role-only
   \`complete_gdrive_upload\` function is required.
2. Deploy \`read-drive-document\` (Edge Function) with internal JWT
   authentication and RLS-aware document authorization.
3. Deploy the revised \`upload-document\` Edge Function with all shared
   dependencies; the new provider is enabled ONLY when the flag is
   exactly \`true\`.
4. Deploy the frontend support for reading \`/gdrive/\` paths.
5. Test in a controlled, disposable application with non-personal data:
   JPG, PNG, PDF; applicant and HR permitted; unrelated applicant denied;
   edit/re-submit; old Supabase objects still readable; rollback on
   metadata failure; uploaded file parent matches the approved folder.
6. After tests and university approval, enable new uploads by setting
   \`GDRIVE_ENABLED=true\`. Leave \`B2_ENABLED=false\`.
7. To roll back, switch \`GDRIVE_ENABLED=false\` to resume **new** uploads
   to Supabase. Old Drive documents still need a working read proxy.
8. Migration of historical files is a separate backup, data-integrity,
   permission and retention project; it does not happen automatically.

Never return a public Drive URL to applicants. Files are transferred
through authenticated Supabase Edge Functions, with per-document database
authorization. Do not delete historical or current storage objects.
