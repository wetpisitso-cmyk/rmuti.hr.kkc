-- Retirement of outbound applicant email; preserve all applicant data,
-- in-app notifications, status history, and existing audit records.
UPDATE public.app_settings
SET value = jsonb_set(
  jsonb_set(value, '{enabled}', 'false'::jsonb, true),
  '{active_since}', 'null'::jsonb, true
), updated_at = clock_timestamp()
WHERE key = 'applicant_mail';

-- Existing triggers can remain in place but must never enqueue new outbound emails.
-- Using the same signature prevents old triggers calling a missing function.
CREATE OR REPLACE FUNCTION private.enqueue_applicant_mail(
  p_event text, p_app uuid, p_fingerprint text, p_details text DEFAULT ''
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $body$
BEGIN
  -- Email is retired by request. Notifications are delivered in-app via private.notify.
  RETURN;
END
$body$;

-- Disable the former admin activation endpoint permanently.
CREATE OR REPLACE FUNCTION public.admin_set_applicant_mail_settings(
  p_enabled boolean, p_events text[]
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $body$
BEGIN
  RAISE EXCEPTION 'EMAIL_NOTIFICATIONS_RETIRED_USE_IN_APP';
END
$body$;
REVOKE EXECUTE ON FUNCTION public.admin_set_applicant_mail_settings(boolean,text[])
  FROM PUBLIC, anon, authenticated;
