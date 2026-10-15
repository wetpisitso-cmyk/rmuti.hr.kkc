-- Admin usernames are aliases to EXISTING Supabase Auth accounts.
-- Passwords remain with Supabase Auth; never stored here.
CREATE TABLE public.admin_usernames (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE CHECK (username ~ '^[a-z][a-z0-9._-]{3,31}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_usernames ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_usernames FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_usernames TO service_role;

CREATE OR REPLACE FUNCTION public.admin_set_own_username(p_username text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_name text := lower(btrim(coalesce(p_username,'')));
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin'
  ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF v_name !~ '^[a-z][a-z0-9._-]{3,31}$' THEN
    RAISE EXCEPTION 'INVALID_ADMIN_USERNAME'; END IF;

  INSERT INTO public.admin_usernames(user_id,username)
  VALUES(auth.uid(),v_name)
  ON CONFLICT (user_id) DO UPDATE SET username=EXCLUDED.username, updated_at=now();

  INSERT INTO public.audit_logs(actor_id,entity,entity_id,action,metadata)
  VALUES(auth.uid(),'admin_usernames',auth.uid(),'set_admin_username',
    jsonb_build_object('username',v_name));
  RETURN v_name;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'ADMIN_USERNAME_TAKEN';
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_own_username(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_own_username(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_own_username()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin'
  ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN (SELECT username FROM public.admin_usernames WHERE user_id=auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_own_username() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_own_username() TO authenticated;

-- API-only login throttling, accessible solely by the trusted Edge Function.
CREATE TABLE public.admin_login_throttle (
  rate_key text PRIMARY KEY CHECK(length(rate_key) BETWEEN 16 AND 100),
  attempts integer NOT NULL DEFAULT 0,
  last_attempt timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_login_throttle ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_login_throttle FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_login_throttle TO service_role;

CREATE OR REPLACE FUNCTION public.edge_admin_login_limit(p_key text,p_max_attempts integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_attempts integer;
BEGIN
  IF p_key IS NULL OR length(p_key) NOT BETWEEN 16 AND 100
     OR p_max_attempts NOT BETWEEN 1 AND 100
  THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  INSERT INTO public.admin_login_throttle(rate_key,attempts,last_attempt)
  VALUES(p_key,1,now())
  ON CONFLICT (rate_key) DO UPDATE SET
   attempts=CASE
     WHEN public.admin_login_throttle.last_attempt < now() - interval '15 minutes'
     THEN 1 ELSE public.admin_login_throttle.attempts+1 END,
   last_attempt=now()
  RETURNING attempts INTO v_attempts;
  RETURN v_attempts<=p_max_attempts;
END;
$$;
REVOKE ALL ON FUNCTION public.edge_admin_login_limit(text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.edge_admin_login_limit(text,integer) TO service_role;
