-- Performance: non-destructive supporting indexes for FK lookups.
-- Small transactional indexes only; no changes to data, grants or RLS.
CREATE INDEX IF NOT EXISTS application_admin_signatures_signer_lookup
ON public.application_admin_signatures(signer_id);
CREATE INDEX IF NOT EXISTS application_print_approvals_approver_lookup
ON public.application_print_approvals(approved_by);
CREATE INDEX IF NOT EXISTS application_review_steps_checker_lookup
ON public.application_review_steps(checked_by);
CREATE INDEX IF NOT EXISTS applications_archived_by_lookup
ON public.applications(archived_by);
CREATE INDEX IF NOT EXISTS exam_card_issues_issuer_lookup
ON public.exam_card_issues(issued_by);
CREATE INDEX IF NOT EXISTS exam_card_issues_revoker_lookup
ON public.exam_card_issues(revoked_by);
CREATE INDEX IF NOT EXISTS exam_card_round_settings_approver_lookup
ON public.exam_card_round_settings(rules_approved_by);
CREATE INDEX IF NOT EXISTS exam_card_round_settings_updater_lookup
ON public.exam_card_round_settings(updated_by);
CREATE INDEX IF NOT EXISTS payment_receipts_issuer_lookup
ON public.payment_receipts(issued_by);
