# อีเมลและคิวงาน

**สถานะปัจจุบัน: email-worker ยังไม่ได้ deploy ระบบตรวจอนุมัติอัตโนมัติปฏิเสธการส่งข้อมูลไป Resend ต้องอนุมัติผู้ให้บริการก่อนทำหัวข้อการติดตั้งจริงด้านล่าง** ไม่มีการตั้ง cron หรือส่งอีเมลจริงในรอบส่งมอบนี้

Auth SMTP ใช้ส่งลิงก์ลืมรหัสผ่าน ตั้งใน Authentication SMTP settings ด้วยข้อมูลจากผู้ให้บริการของหน่วยงาน ไม่เปิด OTP หรือ email confirmation สำหรับ sign-in/signup ตามโจทย์

อีเมล notification แยกออกมาใน email_outbox เมื่อเปลี่ยนสถานะ ระบบบันทึก notification และ outbox ใน transaction เดียวกัน การส่งจะเกิดภายหลัง ไม่ทำให้ใบสมัครสูญหายเมื่อ provider ล้มเหลว

## หลังอนุมัติ Resend หรือปรับใช้ provider ที่ได้รับอนุมัติแล้ว

Payload: recipient email, subject, message text ข้อความรับใบสมัคร/แก้ไข/ผลสถานะไม่มี attachments รหัสผ่าน tokens หรือเลขบัตร แต่อาจมีข้อความที่เจ้าหน้าที่กรอก จึงต้องตรวจเนื้อหาให้เหมาะสมกับขอบเขตที่อนุมัติ

1. ตั้ง sender domain ตาม provider ตรวจค่าใช้บริการและนโยบายของหน่วยงาน
2. สุ่ม WORKER_SECRET อย่างน้อย 32 ตัว ตั้ง Secrets ใน Supabase Dashboard ได้แก่ WORKER_SECRET, RESEND_API_KEY, MAIL_FROM ไม่ใส่ใน frontend หรือ git
3. ตรวจคำสั่ง CLI ก่อน deploy:

```bash
npx supabase functions deploy --help
npx supabase functions deploy email-worker --project-ref YOUR_PROJECT_REF
```

4. ทดสอบการเรียก POST ผ่านเครื่องมือของหน่วยงาน โดยใช้ header `x-worker-secret` ค่าเดียวกับ backend secret ห้ามใส่ secret ใน log หรือคำสั่งที่ถูกแชร์
5. ตรวจ email_outbox: pending → processing → sent หาก error จะ retry backoff จนครบ 5 ครั้ง แล้วเป็น failed การส่งข้าม provider ใช้ idempotency key ตาม outbox.id เพื่อลดการส่งซ้ำ

## ตั้ง scheduler หลังอนุมัติและทดสอบการส่งแล้วเท่านั้น

เปิด pg_cron และ pg_net ใน Extensions ใส่ Vault secrets ผ่าน Dashboard ชื่อ `recruitment_project_url`, `recruitment_worker_secret`, `recruitment_publishable_key` แล้วใช้ SQL นี้โดยไม่วางค่าลับใน SQL:

```sql
select cron.schedule('recruitment-email-worker', '* * * * *', $$
 select net.http_post(
   url := (select decrypted_secret from vault.decrypted_secrets where name='recruitment_project_url') || '/functions/v1/email-worker',
   headers := jsonb_build_object(
     'Content-Type','application/json',
     'apikey',(select decrypted_secret from vault.decrypted_secrets where name='recruitment_publishable_key'),
     'x-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='recruitment_worker_secret')
   ),
   body := '{}'::jsonb
 );
$$);
```

Function gateway ไม่ตรวจ JWT ของ browser แต่ worker ตรวจ secret ที่สุ่มและจำกัดการเรียกเอง ไม่สามารถเรียกส่งด้วย publishable key เพียงอย่างเดียว

หยุดงาน:

```sql
select cron.unschedule('recruitment-email-worker');
```

หากครบ retry แล้ว แก้สาเหตุ provider ก่อน เจ้าของ project จึง reset เฉพาะ outbox ID ที่ต้อง retry ใน SQL Editor โดยตั้ง status='pending', attempts=0, next_attempt_at=now(), lease_until=null, lease_token=null ระวังส่งซ้ำหาก provider ส่งแล้วแต่ acknowledgement ล้มเหลวและพ้นช่วงเก็บ idempotency key ของ provider
