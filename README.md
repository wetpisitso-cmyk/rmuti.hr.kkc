# ระบบรับสมัครบุคลากรออนไลน์ — มทร.อีสาน วิทยาเขตขอนแก่น

React + TypeScript + Supabase สำหรับแผนกงานบริหารงานบุคคล ใช้อีเมลและรหัสผ่านรายบุคคล ผู้สมัครใหม่ได้บทบาท `applicant` เท่านั้น ไม่มีขั้นตอนกรอก OTP ใช้ GitHub Pages เป็นหน้าเว็บ และ Supabase เป็นฐานข้อมูล Auth และพื้นที่เอกสารส่วนตัว

## สถานะการส่งมอบ

- เขียนหน้าเว็บสาธารณะ ระบบสมาชิก ฟอร์มใบสมัคร Dashboard ผู้สมัคร และหลังบ้านเจ้าหน้าที่แล้ว
- ติดตั้ง migrations ใน Supabase project `rioukmxrgaknayltxxyk` แล้ว: **ห้ามรัน migrations ซ้ำใน project นี้**
- สร้าง private bucket `application-files` และติดตั้ง Edge Function `upload-document` แล้ว
- ไฟล์เชื่อมต่อใน `src/lib/project-config.ts` มีเฉพาะ URL และ publishable key ที่เปิดเผยได้ สามารถใช้ VITE_* เพื่อเปลี่ยน project ได้
- **ยังต้องปิด Confirm Email** ใน Supabase ก่อนให้สมัครแล้วเข้าระบบทันที ปัจจุบันตรวจพบว่ายังเปิดอยู่
- **ยังต้องเปิด GitHub Pages แบบ GitHub Actions** ที่ Settings → Pages ก่อนใช้งาน URL เว็บไซต์
- **email-worker ยังไม่ได้ติดตั้ง**: ระบบตรวจสอบอนุมัติอัตโนมัติปฏิเสธการ deploy ไปยัง Resend เพราะยังไม่มีการอนุญาตให้ส่งอีเมลผู้สมัครและเนื้อหาแจ้งเตือนไปยังผู้ให้บริการนี้ โค้ดเตรียมไว้ให้ตรวจแล้ว ต้องได้รับอนุมัติผู้ให้บริการก่อนติดตั้งหรือส่งจริง
- Auth SMTP / ช่องทางติดต่อ / นโยบายฉบับจริง / โลโก้ / ประกาศรับสมัคร ต้องตั้งโดยเจ้าของระบบ ไม่มีประกาศจริงหรือบัญชี admin รหัสผ่านตายตัว

## เริ่มใช้ใน Visual Studio Code

1. ติดตั้ง Node.js 24 LTS และ Visual Studio Code
2. ดาวน์โหลด ZIP หรือ clone repository แล้วเปิดโฟลเดอร์ที่มี `package.json` ด้วย File → Open Folder
3. เลือก Terminal → New Terminal รัน:

```bash
npm ci
npm run dev
```

4. เปิด URL ที่ Vite แสดง เช่น `http://localhost:5173/rmuti.hr.kkc/`
5. เมื่อเปลี่ยน `.env.local` ต้องหยุดแล้วเริ่ม dev server ใหม่

สำหรับ project ที่ผูกไว้ในชุดนี้ ไม่ต้องกรอก key ใหม่ หากย้ายไป Supabase ใหม่ ให้คัดลอก `.env.example` เป็น `.env.local` แล้วแทนค่า placeholder ทุกช่อง URL ต้องเป็น `https://PROJECT_REF.supabase.co` และ key ใช้ชนิด publishable เท่านั้น

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
VITE_BASE_PATH=/rmuti.hr.kkc/
```

VITE_* และไฟล์ config จะอยู่ใน JavaScript ที่ผู้เยี่ยมชมอ่านได้ **ห้ามใส่ service_role, secret key, รหัส SMTP หรือ API key ส่งอีเมล** ในตำแหน่งนี้

## โครงสร้างไฟล์

```text
src/
  pages/                 หน้าสาธารณะ สมาชิก ใบสมัคร และ pages/staff/
  components/            Layout, Guard, ฟอร์ม และอัปโหลดเอกสาร
  services/              การเรียกฐานข้อมูล / RPC / signed URL / upload
  hooks/                 session, สิทธิ์, catalog, debounce
  types/                 models และ types ที่สร้างจาก Supabase จริง
  validation/            ตรวจฟอร์มและรหัสผ่าน
  lib/                   config, เวลาไทย, CSV, recovery callback
supabase/
  migrations/            SQL ตามลำดับเวลา
  functions/             upload-document และ email-worker (รออนุมัติ)
  tests/security.sql     ทดสอบฐานข้อมูลและ RLS โดย rollback
  seed.sql               ข้อมูลสมมุติ เฉพาะ development
docs/                    คู่มือติดตั้ง ผู้สมัคร เจ้าหน้าที่ และการทดสอบ
.github/workflows/       build/test/deploy เฉพาะ frontend
```

## ตั้งค่าระบบสมาชิกให้ตรงข้อกำหนด

เปิด [Supabase Dashboard ของ project](https://supabase.com/dashboard/project/rioukmxrgaknayltxxyk)

1. Authentication → Sign In / Providers → Email: เปิด Email provider และ **ปิด Confirm Email** แล้ว Save
2. Authentication → URL Configuration:

| ค่า | URL |
|---|---|
| Site URL | `https://wetpisitso-cmyk.github.io/rmuti.hr.kkc/` |
| Redirect URL สำหรับเว็บจริง | `https://wetpisitso-cmyk.github.io/rmuti.hr.kkc/?auth=recovery` |
| Redirect URL สำหรับพัฒนา | `http://localhost:5173/rmuti.hr.kkc/?auth=recovery` |

3. ตั้งรหัสผ่านขั้นต่ำ 8 ตัวอักษร หลีกเลี่ยงการเปิด reauthentication ที่ทำให้ผู้ใช้ต้องกรอก OTP หากต้องการคงขั้นตอนตามโจทย์
4. Authentication → Email → SMTP Settings: ตั้ง Custom SMTP ของหน่วยงาน เก็บ host, username, password และ sender ใน Dashboard เท่านั้น
5. Email Templates → Reset Password ใช้ลิงก์ `{{ .ConfirmationURL }}` ไม่ใช้ข้อความแสดงรหัส `{{ .Token }}`

Recovery ใช้ implicit flow: browser รับ session จาก fragment ก่อนเริ่ม HashRouter แล้วลบ token ออกจาก URL และไป `#/reset-password` ใช้ `resetPasswordForEmail` และ `updateUser` จริง ไม่เรียก `signInWithOtp` หรือ `verifyOtp` หน้าลิงก์หมดอายุขอ link ใหม่ได้ ส่วนการสมัครและ sign-in ไม่ต้องรออีเมลเมื่อปิด Confirm Email แล้ว

## สร้างผู้ดูแลระบบคนแรก

1. สมัครสมาชิกตามปกติด้วยอีเมลของผู้ดูแล และตั้งรหัสผ่านเอง
2. เจ้าของ Supabase เปิด SQL Editor แล้วแทนอีเมลในคำสั่งนี้:

```sql
update public.user_roles
set role = 'admin', permissions = '{}', updated_at = now()
where user_id = (select id from auth.users where lower(email) = lower('ADMIN_EMAIL_HERE'));
```

3. ตรวจว่าอัปเดตได้หนึ่งแถว ออกจากระบบแล้วเข้าสู่ระบบใหม่ จากนั้นเปิดเมนูเจ้าหน้าที่
4. มอบ/ถอนสิทธิ์บัญชีอื่นใน “บัญชีและสิทธิ์” ผู้ดูแลไม่สามารถเปลี่ยนบทบาทตนเองผ่านหน้าเว็บ
5. HR มีสิทธิ์แยก ตรวจคุณสมบัติ, ตรวจสลิป, จัดการตำแหน่ง, การสอบ, เผยแพร่ และส่งออก

อย่าเปลี่ยน role ผ่าน `user_metadata` หรือหน้าโปรไฟล์ ไม่ต้องสร้างรหัสผ่านร่วม `admin/123456` และอย่าส่งรหัสผ่านหรือ backend secrets ในแชต

## เปิด GitHub Pages

Repository: [wetpisitso-cmyk/rmuti.hr.kkc](https://github.com/wetpisitso-cmyk/rmuti.hr.kkc)

1. Repository → Settings → Pages → Source เลือก **GitHub Actions**
2. หากใช้ project เดิม ไม่ต้องเพิ่ม Variables เพราะมี fallback public config แล้ว หากย้าย project ให้ตั้ง Settings → Secrets and variables → Actions → Variables: `VITE_SUPABASE_URL` และ `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Actions → Build and deploy recruitment portal → Run workflow หรือ push ไป `main`
4. Workflow ติดตั้ง dependencies จาก lockfile รัน lint/test/typecheck/build แล้ว deploy `dist/` เท่านั้น ไม่ deploy Edge Functions ไม่รัน migrations และไม่ส่ง secrets ของ Supabase ไป frontend
5. รอ job `deploy` สีเขียว ใช้ URL จาก deployment ที่ GitHub แสดง **อย่าสรุปว่า deploy สำเร็จจาก build อย่างเดียว**
6. ทดสอบเปิดลิงก์ `#/jobs/...` แล้ว Refresh จะอยู่หน้าเดิม เพราะ HashRouter

หากสร้าง repository ใหม่ ใช้ชื่อที่ต้องการ แล้ว Vite base ใน Actions จะเป็น `/<repository-name>/` อัตโนมัติ หากพัฒนาชื่ออื่นในเครื่อง ให้เปลี่ยน VITE_BASE_PATH ตามชื่อด้วย

## ตั้งฐานข้อมูลใน project ใหม่

project ปัจจุบันติดตั้งแล้ว ส่วนนี้สำหรับ project ใหม่ที่ไม่มี schema นี้เท่านั้น:

1. Supabase Dashboard → New project เลือกองค์กร แผนบริการ และ region ให้เหมาะสม
2. ตั้ง Email/Password ตามหัวข้อด้านบน
3. รัน SQL ใน `supabase/migrations/` เรียงตามชื่อไฟล์ใน SQL Editor หรือใช้ CLI หลัง login และ link:

```bash
npx supabase --help
npx supabase login
npx supabase link --help
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --help
npx supabase db push
```

หากใช้ SQL Editor จะไม่ได้บันทึกประวัติ CLI อัตโนมัติ จึงอย่าสลับไปรัน db push โดยไม่จัด migration history ให้ตรงก่อน อย่ารัน `seed.sql` บน production: มีเฉพาะข้อมูลสมมุติที่ติดป้ายทดสอบ ไม่มีบัญชีผู้ใช้หรือ admin

Migrations สร้างทุกตาราง RLS, constraints, transaction RPC, private helpers และ bucket เอกสาร ห้ามปิด RLS เพื่อแก้ error การตรวจสิทธิ์ใน database เป็นตัวตัดสิน แม้เรียก REST API ข้ามหน้าเว็บ

## ไฟล์แนบและ Edge Functions

เอกสารอยู่ใน private bucket `application-files` path `user_id/application_id/random_uuid.ext` preview ใช้ signed URL อายุ 120 วินาที Storage client มีสิทธิ์อ่านเฉพาะไฟล์ของตนหรือเจ้าหน้าที่ ไม่มี direct client INSERT/UPDATE/DELETE

อัปโหลดผ่าน `upload-document`: ตรวจ JWT ด้วย `getUser`, จำกัด 15 ครั้ง/นาทีต่อผู้ใช้ ตรวจเจ้าของ/สถานะผ่าน RPC ตรวจขนาดและ magic bytes ของ PDF/JPEG/PNG ก่อน upload บันทึก metadata ด้วย service-only function ภายใต้ lock และตรวจสถานะซ้ำ รุ่นไฟล์เดิมยังเป็นส่วนตัวสำหรับ audit/snapshot

`verify_jwt=false` ใน gateway เป็นการใช้การตรวจ JWT ใน function body เอง ฟังก์ชัน upload ยังปฏิเสธผู้ไม่มี JWT และไม่ได้ใช้ CORS เป็นการอนุญาตสิทธิ์ `SUPABASE_SERVICE_ROLE_KEY` ใช้เฉพาะ backend ที่ Supabase จัดให้

สำหรับ project ใหม่ ตรวจ CLI help แล้ว deploy เฉพาะ upload:

```bash
npx supabase functions deploy --help
npx supabase functions deploy upload-document --project-ref YOUR_PROJECT_REF
```

ตั้ง Edge Secrets `ALLOWED_ORIGINS` เป็น origin เท่านั้น เช่น `https://wetpisitso-cmyk.github.io` และ `http://localhost:5173` ไม่ใส่ path

## อีเมลธุรกรรม — ส่วนที่ต้องอนุมัติก่อนติดตั้ง

การแจ้งเตือนในเว็บและคิว `email_outbox` ทำงานแยกจากการส่งจริง ใบสมัครไม่ถูกย้อนกลับเมื่อผู้ให้บริการอีเมลขัดข้อง

มีโค้ด `email-worker` เตรียมสำหรับ Resend **แต่ยังไม่ได้ deploy เนื่องจากการตรวจอนุมัติอัตโนมัติปฏิเสธการส่งข้อมูลไปผู้ให้บริการนี้** Payload ที่จะส่งคืออีเมลผู้รับ หัวเรื่อง และข้อความแจ้งสถานะ ไม่มีไฟล์แนบ เลขบัตร ที่อยู่ หรือเบอร์โทร ทั้งนี้ข้อความที่เจ้าหน้าที่กรอกอาจมีข้อมูลเพิ่มเติม ต้องได้รับอนุมัติผู้ให้บริการและขอบเขตข้อมูลก่อนติดตั้ง หรือปรับใช้ผู้ให้บริการที่หน่วยงานอนุมัติ

หลังอนุมัติเท่านั้น เจ้าของระบบตั้ง backend secrets จาก `supabase/backend-secrets.example`: WORKER_SECRET สุ่มอย่างน้อย 32 ตัว, RESEND_API_KEY, MAIL_FROM ของโดเมนที่ยืนยันแล้ว ห้ามส่งค่าในแชตหรือ git ตั้ง Auth SMTP แยกต่างหาก: ไม่ใช่คีย์ส่ง notification เดียวกันโดยอัตโนมัติ

Worker รับ POST พร้อม `x-worker-secret`, rate limit 4 ครั้ง/นาที, claim งานด้วย SKIP LOCKED และ lease 3 นาที ใช้ idempotency key รายงาน/อีเมลละหนึ่งค่า retry ด้วย backoff สูงสุด 5 ครั้ง ไม่มีการ log token หรือ payload

ขั้นตอนติดตั้ง/เรียก worker หลังได้รับอนุมัติอยู่ใน [docs/EMAIL.md](docs/EMAIL.md) ขณะส่งมอบไม่มี cron ส่งอีเมลและไม่มีการส่งอีเมลจริง

## ก่อนเปิดรับสมัครจริง

1. ตั้งนโยบายข้อมูลส่วนบุคคลฉบับจริงและเวอร์ชันในหลังบ้าน ชุดนี้มีร่างที่ติดป้ายชัดเจน
2. ใส่โทรศัพท์/อีเมลหน่วยงาน และวางโลโก้จริงที่ `public/logo.png` หากไม่มี ใช้ icon ทั่วไปและข้อความชื่อมหาวิทยาลัย
3. สร้างหน่วยงาน → รอบ → ตำแหน่ง ตรวจปี พ.ศ. จำนวนอัตรา คุณสมบัติ เอกสารบังคับ และวันเวลา Asia/Bangkok
4. ค่าธรรมเนียมเริ่มต้น 0 บาท = ปิดการเรียกเก็บ เปิดใช้เมื่อประกาศจริงกำหนด ใส่บัญชี/วิธีชำระ/QR ตามจริง ไม่มีการยืนยันเงินอัตโนมัติจากรูปสลิป
5. ใส่ไฟล์ประกาศผ่าน URL HTTPS ของเอกสารสาธารณะ เช่น Google Drive ที่หน่วยงานเผยแพร่ให้ผู้เยี่ยมชมอ่านได้ เอกสารผู้สมัครห้ามใช้ public Drive link
6. ทดสอบการสมัครจริง หลังปิด Confirm Email และตั้ง SMTP แล้ว ด้วยบัญชีทดสอบแยกก่อนประชาสัมพันธ์

## ตรวจสอบและคู่มือ

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:api
npm audit --omit=dev
```

- [คู่มือผู้สมัคร](docs/APPLICANT.md)
- [คู่มือเจ้าหน้าที่และผู้ดูแล](docs/STAFF.md)
- [ผลทดสอบและข้อจำกัด](docs/TESTING.md)
- [อีเมลและคิวงาน](docs/EMAIL.md)
- [สำรองและกู้คืน](docs/BACKUP.md)

## เอกสารเทคโนโลยี

- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Vite deployment / base path](https://vite.dev/guide/static-deploy.html)
- [Supabase Email/Password](https://supabase.com/docs/guides/auth/passwords)
- [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Scheduled Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
