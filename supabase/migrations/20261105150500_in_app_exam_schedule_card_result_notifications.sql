-- New events only; never backfill existing applicants. Preserve all prior notices.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS event_key text;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_event_key_unique
  ON public.notifications(event_key) WHERE event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_user_unread_latest
  ON public.notifications(user_id, created_at DESC) WHERE read_at IS NULL;

CREATE OR REPLACE FUNCTION private.notify_once_in_app(
  p_key text, p_user uuid, p_application uuid, p_title text, p_message text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_key IS NULL OR length(p_key) < 10 OR p_user IS NULL OR p_application IS NULL
     OR nullif(btrim(p_title),'') IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications(user_id,application_id,title,message,event_key)
  VALUES (p_user,p_application,left(p_title,160),left(coalesce(p_message,''),2500),p_key)
  ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION private.notify_once_in_app(text,uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;

-- For a newly published schedule, notify only the eligible, active applicants
-- for this job. On later changes, notify what actually changed.
CREATE OR REPLACE FUNCTION private.notify_exam_schedule_in_app()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_title text;
 v_message text;
 v_date text;
 v_old_date text;
 v_signature text;
 v_app record;
BEGIN
 IF new.published IS DISTINCT FROM true THEN RETURN new; END IF;
 IF tg_op='UPDATE' THEN
   IF old.published IS true
      AND ROW(new.title,new.exam_at,new.venue,new.instructions)
       IS NOT DISTINCT FROM ROW(old.title,old.exam_at,old.venue,old.instructions)
   THEN RETURN new; END IF;
 END IF;

 v_date := to_char(new.exam_at AT TIME ZONE 'Asia/Bangkok','DD/MM/')
   || (extract(year from new.exam_at AT TIME ZONE 'Asia/Bangkok')::integer+543)::text
   || to_char(new.exam_at AT TIME ZONE 'Asia/Bangkok',' HH24:MI') || ' น.';
 v_title := 'ประกาศกำหนดการสอบ';
 IF tg_op='UPDATE' AND old.published IS true THEN
   IF new.venue IS DISTINCT FROM old.venue THEN
     v_title := 'แจ้งเปลี่ยนแปลงห้องสอบ / สถานที่สอบ';
   ELSIF new.exam_at IS DISTINCT FROM old.exam_at THEN
     v_title := 'แจ้งเปลี่ยนแปลงวันและเวลาสอบ';
   ELSE
     v_title := 'ปรับปรุงประกาศกำหนดการสอบ';
   END IF;
 END IF;

 v_message := 'กำหนดสอบ: ' || left(new.title,200)
   || E'\nวันที่และเวลา: ' || v_date
   || E'\nสถานที่สอบ: ' || left(new.venue,500);
 IF tg_op='UPDATE' AND old.published IS true THEN
   IF new.venue IS DISTINCT FROM old.venue THEN
     v_message := v_message || E'\nสถานที่เดิม: ' || left(old.venue,500);
   END IF;
   IF new.exam_at IS DISTINCT FROM old.exam_at THEN
     v_old_date := to_char(old.exam_at AT TIME ZONE 'Asia/Bangkok','DD/MM/')
       || (extract(year from old.exam_at AT TIME ZONE 'Asia/Bangkok')::integer+543)::text
       || to_char(old.exam_at AT TIME ZONE 'Asia/Bangkok',' HH24:MI') || ' น.';
     v_message := v_message || E'\nวันและเวลาเดิม: ' || v_old_date;
   END IF;
 END IF;
 IF nullif(btrim(new.instructions),'') IS NOT NULL THEN
   v_message := v_message || E'\nข้อปฏิบัติ: ' || left(new.instructions,850);
 END IF;
 v_message := v_message || E'\nโปรดตรวจสอบประกาศอย่างเป็นทางการและบัตรสอบในเว็บไซต์';
 v_signature := 'inapp:schedule:v1:' || new.id::text || ':' || txid_current()::text
   || ':' || md5(ROW(new.published,new.title,new.exam_at,new.venue,new.instructions)::text);

 FOR v_app IN SELECT id,user_id FROM public.applications
   WHERE job_id=new.job_id AND status='eligible'
      AND submitted_at IS NOT NULL AND archived_at IS NULL
 LOOP
   PERFORM private.notify_once_in_app(v_signature || ':' || v_app.id::text,
      v_app.user_id,v_app.id,v_title,v_message);
 END LOOP;
 RETURN new;
END $$;
DROP TRIGGER IF EXISTS in_app_exam_schedule_published ON public.exam_schedules;
CREATE TRIGGER in_app_exam_schedule_published
AFTER INSERT OR UPDATE OF published,title,exam_at,venue,instructions
ON public.exam_schedules FOR EACH ROW
EXECUTE FUNCTION private.notify_exam_schedule_in_app();

-- Card issue and revocation. Existing 169 card records do not generate past notices.
CREATE OR REPLACE FUNCTION private.notify_exam_card_in_app()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_app record; v_key text; v_title text; v_message text;
BEGIN
 IF tg_op='INSERT' THEN
   IF new.revoked_at IS NOT NULL THEN RETURN new; END IF;
   v_key := 'inapp:card:issued:v1:' || new.assignment_id::text || ':' || new.issued_at::text;
   v_title := 'ออกบัตรประจำตัวผู้สมัครสอบแล้ว';
   v_message := 'เจ้าหน้าที่ออกบัตรประจำตัวผู้สมัครสอบแล้ว กรุณาเข้าสู่ระบบเพื่อเปิดดูหรือดาวน์โหลดบัตรสอบ';
 ELSIF old.revoked_at IS NULL AND new.revoked_at IS NOT NULL THEN
   v_key := 'inapp:card:revoked:v1:' || new.assignment_id::text || ':' || new.revoked_at::text;
   v_title := 'แจ้งยกเลิกบัตรสอบเดิม';
   v_message := 'บัตรสอบเดิมถูกยกเลิก กรุณาตรวจสอบประกาศและติดต่อเจ้าหน้าที่ก่อนใช้บัตรสอบ';
 ELSE
   RETURN new;
 END IF;

 SELECT a.id,a.user_id INTO v_app
 FROM public.exam_assignments ea
 JOIN public.applications a ON a.id=ea.application_id
 WHERE ea.id=new.assignment_id AND a.archived_at IS NULL AND a.submitted_at IS NOT NULL;
 IF v_app.id IS NOT NULL THEN
   PERFORM private.notify_once_in_app(v_key || ':' || v_app.id::text,
     v_app.user_id,v_app.id,v_title,v_message);
 END IF;
 RETURN new;
END $$;
DROP TRIGGER IF EXISTS in_app_exam_card_issued ON public.exam_card_issues;
CREATE TRIGGER in_app_exam_card_issued
AFTER INSERT OR UPDATE OF revoked_at ON public.exam_card_issues
FOR EACH ROW EXECUTE FUNCTION private.notify_exam_card_in_app();

-- The final examination result notification is sent only to listed applicants.
-- It never exposes scores or personal information in the notification itself.
CREATE OR REPLACE FUNCTION private.notify_selection_result_in_app()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_app record; v_key text; v_message text;
BEGIN
 IF new.kind IS DISTINCT FROM 'selection' THEN RETURN new; END IF;
 IF tg_op='UPDATE' AND ROW(new.title,new.rows)
   IS NOT DISTINCT FROM ROW(old.title,old.rows)
 THEN RETURN new; END IF;
 v_key := 'inapp:selection:v1:' || new.id::text || ':' || txid_current()::text
   || ':' || md5(new.title || new.rows::text);
 v_message := 'มหาวิทยาลัยเผยแพร่ประกาศผลสอบ: ' || left(new.title,260)
   || E'\nกรุณาเข้าสู่ระบบและดูประกาศผลคัดเลือกอย่างเป็นทางการ';
 FOR v_app IN
   SELECT a.id,a.user_id FROM public.applications a
   WHERE a.job_id=new.job_id AND a.archived_at IS NULL
     AND a.application_number IS NOT NULL AND a.submitted_at IS NOT NULL
     AND EXISTS (SELECT 1 FROM jsonb_array_elements(new.rows) AS row(item)
                 WHERE row.item->>'number' = a.application_number)
 LOOP
   PERFORM private.notify_once_in_app(v_key || ':' || v_app.id::text,
      v_app.user_id,v_app.id,'ประกาศผลการสอบแล้ว',v_message);
 END LOOP;
 RETURN new;
END $$;
DROP TRIGGER IF EXISTS in_app_selection_published ON public.published_results;
CREATE TRIGGER in_app_selection_published AFTER INSERT OR UPDATE OF title,rows
ON public.published_results FOR EACH ROW EXECUTE FUNCTION private.notify_selection_result_in_app();
