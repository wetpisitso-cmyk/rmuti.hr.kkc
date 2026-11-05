# Security review — RMUTI KKC (5 November 2026)

## Findings and verified safeguards
- Supabase Security Advisors: **26 SECURITY DEFINER functions callable by authenticated users**. This is a **review warning**, not proof that those RPCs bypass authorization. A sample of admin and exam functions includes explicit authorization checks inside the function body. Do not revoke authenticated EXECUTE indiscriminately: this would break authorized admin flows.
- In the reviewed group, admin RPCs have `auth.uid()` plus role checks (`user_roles`) or `private.can(...)`. Complete source and negative-role regression tests are still required to resolve all warnings.
- `public.notifications`: RLS is enabled. SELECT/UPDATE require `user_id=auth.uid()`, and authenticated users have **UPDATE on `read_at` only** (not `message`/recipient/title). New dedup helpers are in `private` schema and revoked from `anon` and `authenticated`.
- **Leaked Password Protection disabled** according to security advisor. It requires changing Auth configuration by an authorized admin in Supabase Dashboard. Do not claim it is enabled.
- RLS-no-policy notices often indicate intentional service-only tables; inspect table grants and backend calls before changing policies.
- No evidence here that credentials or applicant documents are committed to GitHub; this is not a full secrets/penetration test.

## Required actions before security sign-off
1. Authorized admin: Supabase Dashboard → Authentication → Settings → Security & Protection → turn on leaked password protection if available under the current plan. Verify registration/password change flow on a test account.
2. Audit every exposed `SECURITY DEFINER` function for role checks, IDOR through arbitrary application IDs, `search_path`, input validation, and unauthorized access. Test with authenticated applicant A, applicant B, HR, Admin.
3. Re-check grant/RLS for notifications, application files, Drive signed download functions, exam cards and selection results.
4. Scan repository and GitHub Actions/Edge Functions for accidental service_role, Google Drive private key, API keys and test-account credentials; rotate any exposed secrets in the relevant provider.
5. Run Supabase security and performance advisors after further schema changes. Never auto-drop unused indexes or blindly revoke permissions on production.
6. Run the database security fixture only against an isolated test project that contains **no real applicant data**, following `docs/TESTING.md`.

Official references:
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Status
**Partially audited, not fully signed off.** Production authorization rules were not loosened.
