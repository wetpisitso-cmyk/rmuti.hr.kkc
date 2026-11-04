# Migration recovery reference — 4 November 2026

**Do not run the archive against production.**

The Supabase production project `rioukmxrgaknayltxxyk` has **54 entries** in `supabase_migrations.schema_migrations`. At the time of reconciliation, only **7 production version IDs** matched filenames under `supabase/migrations/`. Additional `supabase/migrations/` SQL files represent a separate earlier naming sequence; their versions must **not** be assumed identical to the live migration IDs.

The **47 missing production-version files** were recovered from the database's applied migration statements and placed under `supabase/migration-history/`, preserving production version numbers and names. Together with the seven exact-version existing files, this provides a version-indexed **reference copy of all 54 recorded migrations**, but it has **not** been verified as a clean installation plan on an empty project.

## Restoration safety rules

1. **Production is already migrated. Never replay these statements on the live project.**
2. The `migration-history` directory is **not a runnable migration folder**; do not copy it directly into `supabase/migrations/` or run `supabase db push` against production without explicit reconciliation.
3. First create a fresh **nonproduction** Supabase project/branch (confirm any costs). Restore a private SQL dump of **schema, data, authentication**, and objects in the required order.
4. Capture actual roles, Auth settings, function configuration, Edge Secrets, RLS and permissions; GitHub does not store these secrets.
5. Restore private Storage/Google Drive object bytes from their separate backup and verify paths/size/checksums; a database dump does not contain object bodies.
6. Test applicant login, application editing/submission, staff review, receipt, printable application, exam card, document access, and permissions with test identities before any cutover.
7. Keep database backups **encrypted, access controlled, and outside public GitHub**. The history archive stores SQL definitions, not applicant rows or backup data.

See `docs/BACKUP.md` for the operational restore checklist. An operational recovery is **not complete until a full restore drill succeeds**.
