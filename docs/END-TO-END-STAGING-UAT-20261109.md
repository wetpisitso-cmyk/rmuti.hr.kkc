# RMUTI KKC — Full applicant and staff end-to-end acceptance test

**Production is not a test environment.** Before any tests that create users, mutate applications, approve documents, issue cards, or publish exam results: use an isolated staging Supabase project, a staging URL, and an explicitly labeled dummy recruitment round.

## Preparation
- Two staging applicant fixtures A/B (own email inboxes) + HR reviewer + Admin accounts
- One dummy open round with two jobs, one marked closed, two dummy file uploads (JPEG photo / PDF), dummy payment/waiver, dummy exam schedule and selection result
- Private staging Google Drive folder; DO NOT copy university applicant documents or production sign-in credentials
- Disable all real SMTP outbound, applicant alerts to external services, and other integrations in staging or direct email to dedicated test inboxes only
- Record commit SHA, staging project ref, browser/viewport and expected results

## End-to-end scenarios, in order
1. **Sign-up and confirmation:** reject malformed email and typo domain, require twice-typed email, register new staging account; ensure no session until opening real confirmation link; test resend/expired link, login and logout
2. **Draft & applicant input:** create draft; reload browser and resume; validate required fields, PDF and photo file types/sizes, 2 sessions editing same draft
3. **Submit:** choose job, submit application only once; block closed job, other account, and exceeding one-round quota; verify Thai PDF fields
4. **Staff review:** review document and request correction with reason/deadline; verify applicant inbox and message history, resubmit, approve or reject
5. **Fee/payment:** attach dummy slip where applicable; approve/deny as HR; ensure an applicant cannot edit another applicant's receipt or payment
6. **Numbering & signing:** assign one number per applicant in each job, check ordering, sign application before print approval, ensure signed number lock
7. **Exam:** publish dummy exam schedule, change room and verify notifications show original/new room; issue card after prerequisites, verify PDF, revoke, reissue
8. **Result:** publish dummy selection result; only matched applicants see relevant internal notices, no private score or contact details leak publicly
9. **Roles:** A cannot see B application, notes, documents, downloads or staff functions; HR permissions restricted; admin can see audit logs
10. **Failure cases:** expired session during upload, slow connection, 429 rate-limit, test file too large, duplicate submit, link expired, mobile/desktop
11. **Backup & restore:** encrypted DB export to private Drive, verify checksum/decrypt, restore into disposable staging clone and compare data + auth + storage manifest and link accessibility
12. **Cleanup:** delete staging fixtures or destroy staging project *only after* collecting test evidence. Never delete production data.

## Automation already prepared
- Browser public-page mobile smoke uses Chromium and WebKit. Registration screen typo warning/confirm field tested without submission.
- `scripts/staging-auth-permissions.mjs` signs in two staging accounts and checks application isolation, staff notes, and privileged RPC denial.
- `.github/workflows/staging-applicant-e2e.yml` can be executed after setting staging environment variables/secrets and enabling `RMUTI_STAGING_E2E_ENABLED=true`.
- `supabase/tests/security.sql` is a database fixture script with rollback; use only in staging and review dependencies before execution.

## Evidence / approval
The tests are **NOT PASSED** simply because GitHub build/smoke passes. For each scenario collect: expected, actual, HTTP response, sanitized screenshot, production-impact check, issues/fix and signoff of responsible HR/IT operator. Never include national IDs, applicant emails or document contents in public GitHub issues.
