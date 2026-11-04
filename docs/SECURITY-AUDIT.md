# Supabase production security review — 4 November 2026

Project: `rioukmxrgaknayltxxyk` (RMUTI KKC)

## Confirmed by live inspection

Supabase Advisor reports **26 `authenticated_security_definer_function_executable` warnings**, not proof of 26 exploitable defects. The exposed functions are intentionally used for user-scoped and staff workflows. The live function bodies were inspected. These generally check either:

- `private.can('permission')` or an equivalent `public.user_roles` staff/admin check, or
- `auth.uid()` and ownership for applicant-only resources.

The database already denies `EXECUTE` to `anon` on the examined privileged functions. **Do not revoke `authenticated` globally or change to `SECURITY INVOKER` blindly**: this breaks HR review, applicant print, card downloads, and administrator workflows.

Representative confirmed guards:
- `admin_assign_application_number`: requires administrator role before updating.
- `admin_exam_card_history`: requires administrator role.
- `admin_test_account_action`: requires administrator role and other confirmation checks.
- `staff_reject_expired_correction`: requires `private.can('review')`.
- `exam_card_list`: requires `private.can('exams')`.
- `exam_card_info`: requires owner or exam-management permission.
- `my_exam_cards`: requires a signed-in applicant and scopes returned cards to the current user.
- `can_print_application`: verifies applicant ownership or staff role.

## Actions still needed / cannot be inferred from linter alone

1. Repeat the audit whenever SQL functions change: [Supabase linter 0029](https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0029_authenticated_security_definer_function_executable).
2. Test two real separate accounts on a non-production copy: a standard applicant and staff/admin. Attempt accessing another applicant's records through each RPC, expecting `FORBIDDEN` or an empty result. Do not use real applicant content in CI.
3. Review policy-free RLS tables individually. Several are deliberately protected by RPC-only access; adding a permissive policy would reduce security.
4. Enable leaked-password protection in Supabase Auth settings if available for the project plan. This setting is not modified by this repository.
5. Review secrets, file-link expiry, and RLS after auth or document-storage changes.
6. Keep a database backup separate from uploaded object bytes. A source-code archive is **not** a data backup.

No production function grants or user accounts were changed in this review.
