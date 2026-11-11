# RMUTI KKC Security Review — 11 November 2026

## Scope and safety
Production-read-only inspection of 27 exposed `SECURITY DEFINER` RPCs, auth settings, email-delivery retirement, RLS, and the GitHub release pipeline. No applicant records, passwords, roles, or current Admin permissions were changed.

## Findings
- Supabase project `rioukmxrgaknayltxxyk` is `ACTIVE_HEALTHY`. No health advisor issues at inspection.
- The organization is on the **Free** tier. Supabase Leaked Password Protection remains **disabled** and cannot be toggled using the currently available connected tools. The administrator must use a supported paid tier and enable it in Authentication settings.
- `app_settings.applicant_mail.enabled = false`; no queued emails remain in `email_outbox`; `private.enqueue_applicant_mail` returns without enqueueing; `applicant-email-worker` responds with HTTP 410 and never sends email.
- As additional defense in depth, the live retired edge worker was redeployed with `verify_jwt = true` (version 4). The same setting is recorded in `supabase/config.toml`.
- **27 of 27** privileged public functions grant EXECUTE to authenticated roles; **0** privileged functions grant EXECUTE to anon. 27/27 source code bodies match an identity, owner, staff, or Admin permission predicate (pattern review only; not a substitute for negative authorization tests).
- `private.can('admin')`, `private.can('review')` and `private.is_staff()` evaluated to false without a user identity.
- Sensitive `applications`, `application_documents`, `profiles`, `user_roles`, `notifications`, `staff_notes` have RLS enabled and are not readable by `anon`.
- `public.user_roles` only allows `authenticated` SELECT, with policy restricting rows to self or Admin. The Data API role has no INSERT, UPDATE or DELETE grant on `user_roles`.
- Advisors continue to report 27 `authenticated_security_definer_function_executable` warnings because legitimate signed-in Admin/HR/applicant clients call these RPCs. Blindly revoking authenticated EXECUTE would break features. Keep role/ownership guards and audit each RPC with real non-privileged test identities in a **staging** database before changing permissions.

## Boundaries and follow-up
- This is **not** a penetration test or live applicant-vs-Admin E2E verification. The existing staging test workflow requires test accounts and `RMUTI_STAGING_E2E_ENABLED`.
- Email-bounce warning comes from the Supabase platform and may relate to Supabase Auth transactional messages, not the retired applicant notification queue. Check Auth mail logs and sender/domain configuration separately; do not disable signup confirmation or password recovery.
- The authentication protection warning will remain until Leaked Password Protection is enabled on a plan supporting that feature.
- No additional production privileged function grants are revoked until representative applicant / Admin / HR tests prove compatibility.
- Recheck Supabase Security Advisor and CI after any changes.
