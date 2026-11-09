-- RMUTI KKC / PRODUCTION: read-only database security snapshot.
-- Safe for SQL Editor: SELECT only, no temporary users/records, no side effects.
WITH function_exposure AS (
  SELECT n.nspname,p.proname,p.oid,p.prosrc,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon_exec,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS auth_exec
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef
),
public_tables AS (
  SELECT c.relname, c.relrowsecurity,
    has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
    has_table_privilege('authenticated',c.oid,'SELECT') AS auth_select
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
),
checking AS (
  SELECT 'public_definer_callable_by_anon' AS check_name,
    COUNT(*) FILTER(WHERE anon_exec)::bigint AS count
  FROM function_exposure
  UNION ALL SELECT 'public_definer_callable_by_authenticated',
    COUNT(*) FILTER(WHERE auth_exec) FROM function_exposure
  UNION ALL SELECT 'authenticated_definers_without_obvious_guard',
    COUNT(*) FILTER(WHERE auth_exec AND NOT (
      prosrc ~* 'private[.]can\(' OR
      prosrc ~* 'private[.]is_staff\(' OR
      prosrc ~* 'from[[:space:]]+public[.]user_roles' OR
      prosrc ~* 'auth[.]uid\(' OR
      prosrc ~* 'FORBIDDEN'
    )) FROM function_exposure
  UNION ALL SELECT 'public_tables_with_no_rls_but_auth_select',
    COUNT(*) FILTER(WHERE NOT relrowsecurity AND auth_select) FROM public_tables
  UNION ALL SELECT 'public_tables_with_no_rls_but_anon_select',
    COUNT(*) FILTER(WHERE NOT relrowsecurity AND anon_select) FROM public_tables
)
SELECT check_name,count FROM checking ORDER BY check_name;

-- Review all exposed-definer signatures individually. A pattern-based
-- guard check is NOT a pen-test or proof of correct row-level authorization.
SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
ORDER BY p.proname;

-- RLS read/write rules and grants for particularly sensitive tables.
SELECT n.nspname AS schema_name,c.relname AS table_name,c.relrowsecurity AS rls_enabled,
  has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
  has_table_privilege('authenticated',c.oid,'SELECT') AS auth_select
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
 ('applications','application_documents','profiles','user_roles','notifications','staff_notes')
ORDER BY c.relname;
