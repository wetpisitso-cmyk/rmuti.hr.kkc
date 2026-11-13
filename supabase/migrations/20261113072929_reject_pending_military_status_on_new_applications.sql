-- Prevent pending conscription status on new male application submissions.
-- Existing submitted application rows are not updated.
CREATE OR REPLACE FUNCTION private.require_military_status_on_submit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $body$
DECLARE v_military text;
BEGIN
  IF NEW.status = 'submitted'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.personal_data->>'gender' = 'ชาย' THEN
    v_military := btrim(coalesce(NEW.personal_data->>'military_status',''));
    IF v_military = '' OR v_military = 'ไม่เกี่ยวข้อง'
       OR v_military ~ '(อยู่ระหว่างดำเนินการ|ยังไม่ผ่าน|รอดำเนินการ|รอเกณฑ์)'
       OR (v_military LIKE 'อื่น ๆ:%' AND btrim(substr(v_military,length('อื่น ๆ:') + 1)) = '') THEN
      RAISE EXCEPTION 'MILITARY_STATUS_REQUIRED';
    END IF;
  END IF;
  RETURN NEW;
END;
$body$;
