# ตั้งค่า Supabase Auth SMTP สำหรับ RMUTI KKC

## ตรวจพบปัจจุบัน (9 พ.ย. 2569)
- Supabase project `rioukmxrgaknayltxxyk` สถานะ ACTIVE_HEALTHY
- `auth.users` 313 บัญชี, ในจำนวนนี้ 312 บัญชีถูกทำเครื่องหมายว่ายืนยันโดยไม่มี `confirmation_sent_at`
- `supabase/config.toml` ตั้ง `auth.email.enable_confirmations = false` สำหรับ **local**; ไม่ใช่หลักฐานยืนยันการตั้งค่า Cloud Production โดยตรง
- Web app รองรับการขอลิงก์ซ้ำแล้ว; ไม่มีการเปิดส่งอีเมลแจ้งสถานะใบสมัคร
- เครื่องมือ Supabase ที่เชื่อมต่อ **ไม่รองรับการจัดการ SMTP/GoTrue config โดยตรง**; ต้องใช้ Dashboard เจ้าของระบบ

## ต้องใช้บริการ SMTP ที่ได้รับอนุญาต
ใช้ SMTP จาก IT มหาวิทยาลัย หรือจากผู้ให้บริการเช่น Brevo/Resend ที่องค์กรจัดทำบัญชีและยืนยันโดเมนผู้ส่งแล้ว อย่าใช้ Gmail ส่วนตัวแบบรหัสผ่านปกติหรือข้อมูลสมมติ

## วิธีกรอกใน Supabase Dashboard
1. เปิด https://supabase.com/dashboard/project/rioukmxrgaknayltxxyk/auth/smtp
2. Authentication > SMTP Settings > Enable Custom SMTP
3. กรอกจากผู้ให้บริการตามจริง: **Sender email**, **Sender name** (แนะนำ RMUTI KKC Recruitment), **Host**, **Port**, **Username**, **Password/API key**
4. ตรวจว่าโดเมนที่ใช้ส่งมี SPF/DKIM/DMARC และกำหนดขีดจำกัดส่งเมลที่สอดคล้องกับจำนวนผู้สมัคร
5. ใน Email Templates > Confirm sign up สามารถนำ HTML จาก `supabase/templates/confirmation.th.html` ไปวาง; ห้ามลบตัวแปร `ConfirmationURL` ที่ Supabase ต้องใช้
6. ใน Authentication > URL Configuration ตั้ง Site URL ตามเว็บจริง `https://wetpisitso-cmyk.github.io/rmuti.hr.kkc/` และตรวจ redirect allowlist ก่อนเปิดการยืนยัน
7. **เปิด Confirm Email เฉพาะ Staging ก่อน**. ทดสอบส่งจริงถึงอีเมลทดสอบ, กดลิงก์, ลงชื่อเข้าใช้ และขอส่งซ้ำ
8. หลังทดสอบผ่าน ให้ IT วางแผนเปิดใช้บน Production ขณะมีผู้สมัครน้อย และตรวจ account ใหม่ได้จริง

## ห้ามทำ
- ห้ามส่งรหัสผ่าน SMTP หรือ API key ผ่านแชตหรือ commit ลง GitHub
- ห้ามเปิด Confirm Email บน Production ก่อน SMTP + redirect + link confirmation ผ่านจริง
- ห้ามรีเซ็ตสถานะยืนยันของบัญชีเก่า 313 บัญชีทั้งหมด
- ห้ามเปิด applicant-email-worker หรือเปิดระบบส่งอีเมลแจ้งสถานะใบสมัครที่ยกเลิกไปแล้ว

สถานะ: **แม่แบบพร้อม แต่ SMTP Production ยังไม่ได้ตั้งค่าหรือทดสอบการส่ง**.
อ้างอิง: https://supabase.com/docs/guides/auth/auth-smtp
