# ตั้งค่า Cloudflare R2 — ระบบรับสมัครบุคลากร RMUTI KKC

## สถานะที่ปลอดภัยก่อนเชื่อม

- ฐานข้อมูล, สิทธิ์, บัญชี, ใบสมัคร, สลิป, สถานะ, PDF และ Admin ยังอยู่ใน Supabase ตามเดิม
- ไฟล์เดิมใน private bucket `application-files` **ไม่ถูกย้ายหรือลบ** และยังเปิดผ่าน signed URL เดิม
- ถ้ายังไม่ตั้ง `R2_ENABLED=true`, ไฟล์ใหม่ยังลง Supabase Storage ตามเดิม
- เมื่อตั้ง `R2_ENABLED=true` และ secrets ครบ **รวมถึง `R2_CLEANUP_READY=true` หลังตรวจสอบการลบไฟล์ R2** ไฟล์ใหม่จะเก็บใน private R2 bucket และบันทึก metadata/path ใน Supabase
- **สถานะปัจจุบัน:** การเผยแพร่ `admin-cleanup-files` เวอร์ชัน R2 ถูกระงับด้วยระบบความปลอดภัย จึงยังใช้เวอร์ชันเดิมที่ลบได้เฉพาะ Supabase Storage ต้องคง `R2_ENABLED=false` และ `R2_CLEANUP_READY=false` จนกว่าส่วนนี้จะได้รับอนุมัติและทดสอบ
- ปัจจุบันฐานข้อมูลมี guard บล็อกการลบข้อมูลอ้างอิงไฟล์ R2 เพื่อไม่ให้เกิด orphan files โดยไม่ทราบตัว
- R2 ไม่ได้เป็น public bucket และไม่มี public URL ของเอกสารผู้สมัคร
- ถ้าตั้งเปิด R2 แต่ secret ไม่ครบ ระบบอัปโหลดจะขึ้น `R2_NOT_CONFIGURED` ไม่บันทึกไฟล์ใหม่ลงผิดพื้นที่

## 1. สร้าง Cloudflare R2

1. เข้า https://dash.cloudflare.com/ → เลือกบัญชี → **R2 object storage**
2. เปิดใช้งาน R2 ตามขั้นตอนใน Dashboard (ผู้ให้บริการอาจขอวิธีชำระเงินเพื่อเปิดบัญชี)
3. กด **Create bucket** ตั้งชื่อ เช่น `rmuti-kkc-applications` ใช้ Storage Class **Standard**
4. ไม่เปิด Public Development URL / Custom Domain ให้กับ bucket นี้
5. ดู **Account ID** จากหน้า Dashboard (รหัส 32 ตัว)

เอกสารทางการ: https://developers.cloudflare.com/r2/get-started/cli/

## 2. สร้าง API Token เฉพาะ bucket

1. R2 → **Manage R2 API Tokens** → **Create**
2. เลือก **Object Read & Write** และจำกัดสิทธิ์ **เฉพาะ bucket ที่สร้าง**
3. คัดลอก `Access Key ID` และ `Secret Access Key` ไปเก็บในตัวจัดการรหัสผ่านของหน่วยงาน
4. **ห้าม** ส่งคีย์ผ่านแชต, GitHub Issue, GitHub Secrets ของ frontend, หน้าเว็บ, ไฟล์ README, ภาพหน้าจอ หรือโค้ด

เอกสารทางการ: https://developers.cloudflare.com/r2/api/tokens/

## 3. ใส่ Supabase Edge Function Secrets

เปิด https://supabase.com/dashboard/project/rioukmxrgaknayltxxyk/settings/functions

ตั้งค่าดังนี้ในหน้า Edge Functions → Secrets:

| Secret name | ค่า |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare Account ID 32 ตัว |
| `R2_BUCKET` | `rmuti-kkc-applications` หรือชื่อ bucket ที่สร้าง |
| `R2_ACCESS_KEY_ID` | Access Key ID จาก R2 token |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key จาก R2 token |
| `R2_ENABLED` | `false` จนกว่าส่วนลบไฟล์ R2 ผ่านการตรวจสอบและ Deploy แล้ว |
| `R2_CLEANUP_READY` | `false` จนกว่าทดสอบส่วนลบไฟล์สำเร็จและยกเลิก database guard อย่างปลอดภัย |

**สำคัญ:** ต้องตั้งค่าใน Supabase Edge Functions Secrets เท่านั้น ไม่ใช่ `VITE_*`, `.env` ที่ deploy หน้าเว็บ, หรือ GitHub Pages เนื่องจาก frontend เป็น public และมีผู้สมัครเข้าถึงได้

เมื่อยังไม่พร้อม ให้เว้น `R2_ENABLED` หรือกำหนด `false` เพื่อใช้ storage เดิมต่อไป

## 4. ส่วนโค้ดที่เชื่อมให้แล้ว

- `upload-document`: ตรวจ JWT + เจ้าของใบสมัคร + จำนวนครั้งต่อเวลา + นามสกุล/magic bytes + ขนาดจากประกาศ ก่อน upload
- `document-url`: ตรวจว่าไฟล์อยู่ในใบสมัครจริง ตรวจเจ้าของหรือเจ้าหน้าที่ แล้วสร้าง signed GET URL อายุ **120 วินาที**
- `admin-cleanup-files`: โค้ดฉบับใหม่เตรียมรองรับไฟล์เก่าบน Supabase และไฟล์ใหม่บน R2 แต่ **ยังไม่เผยแพร่ขึ้นระบบจริง** และมี database guard ป้องกันการลบใบสมัครที่มี R2 ระหว่างรอความพร้อม
- `application_documents`: เก็บ path แบบ `r2/<user_id>/<application_id>/<random_uuid>.pdf` เมื่อใช้ R2 เพื่อแยกจากไฟล์ Supabase
- `complete_r2_upload`: PostgreSQL function ที่ให้ service role เรียกได้เท่านั้น ตรวจสอบ path, ประเภท, ขนาด และสถานะอีกครั้ง

การเปลี่ยนไฟล์เดิมจะเก็บเวอร์ชันเก่าไว้ในฐานข้อมูลและ bucket ของ provider เดิมตามนโยบายตรวจสอบย้อนหลัง

## 5. ทดสอบก่อนเปิดรับสมัครจริง

1. **หลัง** Deploy ส่วนลบ R2 ที่ผ่านการอนุมัติ และยกเลิก database guard อย่างปลอดภัย จึงตั้ง `R2_CLEANUP_READY=true` และ `R2_ENABLED=true` แล้วทดสอบด้วยบัญชีผู้สมัครทดสอบ
2. อัปโหลด PDF ตัวอย่างและรูป JPG/PNG แล้วตรวจว่ามี object ใน Cloudflare R2 bucket
3. ตรวจตาราง `public.application_documents`: `storage_path` ต้องขึ้นต้นด้วย `r2/`
4. ทดสอบดูเอกสารในหน้าใบสมัครและหน้า Admin; ตรวจว่าผู้สมัครอื่นเปิดไฟล์ไม่ได้
5. ทดสอบเปลี่ยนไฟล์เดิมและเปิดใบสมัคร A4 / รูปติดใบสมัคร
6. ทดสอบ Admin ลบ **ใบสมัครทดสอบเท่านั้น** แล้วตรวจว่าคิวลบไฟล์ทำงาน; อย่าทดสอบด้วยข้อมูลจริง
7. ตรวจปริมาณ Storage และ Egress ใน Dashboard ของ R2 และ Supabase

## 6. ย้อนกลับอย่างปลอดภัย

ตั้ง `R2_ENABLED=false` เพื่อให้ **ไฟล์ใหม่** กลับไปอัปโหลด Supabase Storage ชั่วคราว แต่ไฟล์เก่าบน R2 ยังคงเปิดดูได้หากเก็บ Account ID, Bucket และ Access Key/Secret ไว้ การลบไฟล์ R2 จะทำได้เมื่อส่วนลบที่ผ่านการอนุมัติพร้อมใช้งาน

**ห้ามลบ Bucket/Token/Secrets ของ R2** หากยังมีไฟล์ R2 อยู่ เพราะหน้า Preview ต้องใช้ token เพื่ออ่านไฟล์ที่เก็บไว้แล้ว ต้องเปิด R2 และ secrets ไว้สำหรับเอกสารเก่าที่ยังอยู่

## 7. พื้นที่ฟรีและขอบเขต

R2 Free tier มี storage allowance 10 GB (Standard) และมีโควตาจำนวนคำขอแยกต่างหาก ระบบ 1,000 คน × 5 MB = ประมาณ 5 GB ของไฟล์ ไม่รวมการรับส่งข้อมูล, การ backup, การใช้ซ้ำและเอกสารจากรอบเก่า

Supabase Free ยังมีข้อจำกัดด้าน **500 MB database**, จำนวนคำขอ/ประสิทธิภาพ, bandwidth และการสำรองข้อมูล การใช้ R2 ไม่ได้เพิ่มโควตาฐานข้อมูล Supabase โดยอัตโนมัติ และ **ไม่ได้รับประกัน** 1,000 คนเข้าใช้พร้อมกัน

ข้อแนะนำ: เอกสารผู้สมัครเป็นข้อมูลส่วนบุคคล ต้องตกลงเรื่องผู้ประมวลผลข้อมูล ระยะเวลาเก็บรักษา การสำรองและสิทธิ์เข้าถึงตามนโยบายมหาวิทยาลัยก่อนใช้งานจริง
