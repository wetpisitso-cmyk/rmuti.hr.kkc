# ระบบอีเมลแจ้งเตือนผู้สมัคร (เตรียมพร้อม / ยังไม่เปิดส่งจริง)

ระบบรับสมัครงาน RMUTI KKC ใช้ Supabase Auth/DB และ GitHub Pages โดยข้อความแจ้งเตือนในหน้าเว็บยังใช้งานตามเดิม ส่วนอีเมลออกนอกองค์กรเป็นฟังก์ชันแยก.

## หัวข้อที่รองรับ

1. สมัครงานสำเร็จ (เมื่อเปลี่ยนสถานะเป็น submitted)
2. ชำระค่าสมัครผ่านการตรวจสอบ (เมื่อ payment_records confirmed)
3. ผ่านคุณสมบัติ
4. ไม่ผ่านคุณสมบัติ
5. ประกาศวัน เวลา สถานที่สอบ (เผยแพร่หรือเปลี่ยนวัน/สถานที่จริง โดยไม่แจ้งเมื่อแก้ไขร่าง)
6. ออกบัตรประจำตัวผู้สมัครสอบ (ออกบัตรสำเร็จ)
7. ประกาศผลการสอบ (มีการเผยแพร่และมีรายชื่อผู้สมัครในประกาศ)

หน้าแอดมินอยู่ที่ **ตั้งค่าและประวัติระบบ → แจ้งเตือนผู้สมัครผ่านอีเมล** มีรายการให้เลือกครบหกหัวข้อ โดยผลคุณสมบัติแยกเป็นสองเหตุการณ์เพื่อความแม่นยำ.

## Safety defaults

- สร้าง migration `supabase/migrations/20261104162000_applicant_email_notifications.sql` และติดตั้งก่อนเปิดหน้า UI.
- `app_settings.applicant_mail.enabled = false` จนกว่าจะเปิดใช้งานโดยผู้ดูแลและยืนยันบริการส่ง. หน้า UI บันทึกตัวเลือกได้ในสถานะปิดเท่านั้น.
- `private.notify` ยังคงสร้างการแจ้งเตือนในเว็บ แต่จะไม่สร้างคิว legacy ที่เคยค้าง 1,501 รายการ.
- ไม่ backfill ประวัติ ไม่ส่งอีเมลเก่า ไม่มี Scheduler / Cron / GitHub workflow สำหรับส่งอีเมล.
- `email_outbox` ออกแบบให้กันซ้ำด้วย `dedup_key`; worker ส่งได้เฉพาะรายการที่มี `event_type` และเกิดหลังเวลาเปิดใช้.
- `claim_emails` และ `finish_email` เปิดเฉพาะ `service_role`; ไม่เปิดคีย์ให้ผู้สมัครหรือ frontend.
- หลีกเลี่ยงการแนบเอกสารราชการ รูปถ่าย เลขบัตรประชาชน หรือข้อมูลคะแนนส่วนบุคคลในอีเมล.

## ก่อนเปิดใช้งานจริง

1. ขออนุมัติผู้ให้บริการส่งเมลจากหน่วยงาน และตรวจนโยบายข้อมูลส่วนบุคคล/การส่งข้อมูลออกนอกระบบ.
2. สร้างและตรวจสอบ sender domain ของมหาวิทยาลัยในผู้ให้บริการ (ตัวอย่าง Resend). ควรเปิดใช้ SPF/DKIM/DMARC.
3. ตั้ง secrets ใน Supabase Edge Function Secrets: `RESEND_API_KEY`, `MAIL_FROM` และ `WORKER_SECRET` (สุ่มยาวอย่างน้อย 32 ตัวอักษร); ห้ามใช้ `VITE_*` หรือ commit ขึ้น GitHub.
4. Deploy Edge Function `applicant-email-worker` โดยตั้ง `verify_jwt=false` เพราะใช้ `x-worker-secret` และตรวจในโค้ด. ฟังก์ชันจะคืน 401 ถ้าไม่มี secret.
5. ทดสอบด้วยบัญชีและอีเมลทดสอบที่ยินยอมเท่านั้น. ตรวจว่า dedup, error, retry และตารางอีเมลแสดงถูกต้อง.
6. เมื่อผ่านทั้งหมด ให้เปิดค่า `enabled` ผ่าน RPC `admin_set_applicant_mail_settings(true, selectedEvents)` โดยแอดมินที่ได้รับอนุญาต. การเปิดครั้งแรกบันทึก `active_since` เพื่อกันการส่งย้อนหลัง.
7. ค่อยตั้ง scheduler แบบ server-side สำหรับเรียก POST พร้อม header `x-worker-secret`; **ยังไม่มี scheduler ในชุดงานนี้**.
8. หากต้องหยุดส่ง ให้แอดมินเรียก `admin_set_applicant_mail_settings(false, selectedEvents)`. หยุด scheduler ด้วย.

## การตรวจสอบ

SQL อ่านอย่างเดียว:

```sql
select key,value from public.app_settings where key='applicant_mail';
select status,event_type,count(*) from public.email_outbox group by status,event_type;
select count(*) from public.applications;
select count(*) from public.exam_card_issues;
```

การแจ้งเตือนที่ส่งผ่าน Resend มีการใช้ idempotency key ตาม UUID คิวแต่ละรายการ และส่งอีเมลเป็น text-only. หากส่งแล้วแต่การตอบกลับเครือข่ายขัดข้อง ให้ตรวจรายงาน provider ก่อน retry.

**สำคัญ:** การเปิดตั้งค่าที่ฐานข้อมูลโดยไม่กำหนด secrets และทดสอบ worker จะทำให้คิวสะสมแต่ไม่ส่งเมลจริง. ห้ามเปิดใช้ก่อนครบ checklist.
