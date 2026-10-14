# ผลทดสอบและข้อจำกัด ณ 14 ตุลาคม 2569

## ทดสอบที่ดำเนินการจริง

| การตรวจ | ผล |
|---|---|
| TypeScript typecheck | ผ่าน |
| ESLint | ผ่าน |
| Vitest | 16 tests ผ่าน: ฟอร์ม consent/รหัสผ่าน, national ID, callback recovery, CSV injection, เวลาไทย, attachment URL และ file signatures |
| Database / RLS ใน project จริง | 34 assertions ผ่าน โดยใช้ผู้ใช้สมมุติและ JWT claims ใน transaction ที่ rollback ทั้งหมด |
| HTTP API จริง | 6 checks ผ่าน: Email provider, public positions/joins, public settings, anonymous applications denied, anonymous privileged RPC denied, upload ไม่มี JWT ถูกปฏิเสธ |
| Supabase Security Advisors | ไม่พบรายการแจ้งเตือน หลังติดตั้งและแก้ไข migrations |
| Production frontend build | ผ่าน |
| npm audit รวม development dependencies | ไม่พบช่องโหว่ |

Database assertions ทดสอบ flow บันทึกร่าง → เอกสาร metadata → ส่ง → ออกเลข → ตรวจ → ขอแก้ → ส่งใหม่ → ผ่าน → กำหนดสอบ → ผลร่าง → เผยแพร่ รวมถึง quota, เวลาปิดรับ, กำหนดแก้หมดอายุ, reference ซ้ำ, สลิปรอตรวจและ HR confirmation

การทดสอบผู้สมัคร A/B ใช้บทบาท `authenticated` และ claims ใน PostgreSQL ไม่ใช่การจำลองผ่านหน้าเว็บ ทดสอบ A อ่าน/แก้ข้อมูลตามสถานะ B อ่านใบสมัคร เอกสาร Storage objects ของ A ไม่ได้ และไม่มีสิทธิ์เรียก completion สำหรับอัปโหลดหรือ admin RPC

Storage fixture ใน SQL เป็น object metadata ภายใน transaction ไม่ได้อัปโหลดไฟล์ส่วนบุคคลหรือส่งอีเมลจริง เมื่อตรวจจบ ยืนยันว่า auth.users, applications, job_positions และ email_outbox ไม่มีข้อมูลทดสอบค้างอยู่

## ผลวัดประสิทธิภาพ

- สภาพ: Node.js 24.19.0 ใน Linux workspace ของงานนี้, production Vite build
- build ที่วัดระหว่างพัฒนา: ประมาณ 0.7 วินาที (เฉพาะ Vite build ไม่รวมติดตั้ง/typecheck)
- HTTP query ตำแหน่งสาธารณะพร้อม relationship จาก workspace ไป Supabase Singapore: 879 ms ในหนึ่งรอบ และ 1,103 ms ในอีกรอบ
- ค่านี้เป็น **เวลาคำขอฐานข้อมูล** ไม่ใช่เวลาโหลดหน้าแรกทั้งหมด จึงยังไม่รับรองหน้าเว็บโหลดภายใน 1 วินาที
- มี lazy chunks ของเจ้าหน้าที่/form, public catalog cache, pagination หลังบ้าน, server aggregate และ upload progress

## ส่วนที่ยังไม่ทดสอบจริง

- สมัครบัญชีใหม่แล้วเข้าใช้งานทันที: ปัจจุบัน Auth ยังเปิด Confirm Email ต้องปิดก่อนทดสอบขั้นตอนนี้
- การลงทะเบียนซ้ำ/รหัสผ่านผิด/ลืมรหัสผ่าน/ลิงก์หมดอายุ/เปลี่ยนรหัสผ่าน/session หมดอายุ/ออกจากระบบแบบครบ flow ด้วยบัญชีจริง: ต้องทดสอบหลังตั้ง Auth, redirect และ Custom SMTP
- การอัปโหลดไฟล์จริงขณะเข้าสู่ระบบ และดาวน์โหลด signed document/ใบสมัคร PDF ใน browser: มีโค้ดและ backend พร้อม แต่รอบนี้ตรวจ HTTP auth boundary และ SQL permissions เท่านั้น
- การส่งพร้อมกันหลาย HTTP sessions: SQL มี row lock, quota lock, year counter และ unique constraints ทดสอบ retry แบบลำดับแล้ว ยังไม่ได้ทำ concurrent HTTP load test
- การส่งอีเมล provider จริง/SMTP/cron: **email-worker ยังไม่ deploy เพราะ auto-review ปฏิเสธ destination Resend ที่ยังไม่ได้อนุมัติ** API test รายการนี้เป็น SKIP ไม่ใช่ PASS
- GitHub Pages URL ยังต้องตรวจ job deploy หลังเจ้าของเปิด Settings → Pages → GitHub Actions
- UI บนมือถือจริง และการพิมพ์ A4 หลายหน้า: มี media queries, labels, print styles และ reduced-motion support แต่ยังไม่มี browser/device visual QA ในรอบนี้

## ทำซ้ำการตรวจโค้ด

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run test:api
npm audit
```

`test:api` ไม่สร้างบัญชี ไม่เขียนใบสมัคร และไม่ส่งอีเมล ใช้ public config ของ project ในชุดงานนี้ ถ้าเปลี่ยน project ให้ส่ง VITE_SUPABASE_URL และ VITE_SUPABASE_PUBLISHABLE_KEY เป็น environment variables

Database test อยู่ที่ `supabase/tests/security.sql` รันเป็นเจ้าของ project ใน SQL Editor ใน development project ที่ว่างและตั้ง privacy version draft-1 เท่านั้น คำสั่งเริ่มด้วย BEGIN และจบด้วย ROLLBACK หาก assertion ล้มเหลว ให้ rollback ก่อนรันใหม่ อย่านำชุดทดสอบไปใช้กับ project ที่มีข้อมูลจริงโดยไม่ตรวจ fixture และผล assertions ที่อ้างจำนวนรายการ

## รับรองการใช้งานก่อนเปิดจริง

1. ตั้ง Auth/SMTP/URLs แล้วใช้บัญชีทดสอบ A และ B ที่สมัครผ่านหน้าเว็บจริง
2. เปิดรอบ/ตำแหน่งทดสอบที่ติดป้ายชัดเจน ไม่ใช้ประกาศจริง
3. ทำ flow จากหน้าเว็บทั้งหมดและตรวจเลขผู้สมัคร ปิดหน้าต่างระหว่างบันทึกและ retry
4. ใช้สอง browser sessions ตรวจ A/B ด้วย REST และ signed URL จริง รวมถึง role escalation, payment approval และข้ามขั้นตอนสถานะ
5. ทดสอบพร้อมกันอย่างน้อยสองคำขอส่งใบสมัครเดียวกัน และสองตำแหน่งในรอบ quota=1
6. ทดสอบไฟล์ผิด MIME/ใหญ่เกินกำหนดและฟอร์มบนจอมือถือหลายขนาด
7. หลังอนุมัติ provider ให้ทดสอบ email-worker ด้วยอีเมลทดสอบของหน่วยงาน และกรณี provider fail โดยใบสมัครยังอยู่
8. ทดสอบ Print to PDF ฝัง/โหลดฟอนต์ไทย การแบ่งหน้า รูป และบัตรสอบ
