# RMUTI KKC – Audit ความปลอดภัย Supabase / 9 พฤศจิกายน 2569

## ผลตรวจ read-only จาก Supabase production
- สถานะ Supabase project `rioukmxrgaknayltxxyk`: `ACTIVE_HEALTHY`
- PUBLIC SECURITY DEFINER RPC ที่ `anon` เรียกได้: **0**
- ตารางใน `public` ที่ SELECT ได้โดย `anon` และไม่ได้เปิด RLS: **0**
- ตารางใน `public` ที่ SELECT ได้โดย `authenticated` และไม่ได้เปิด RLS: **0**
- SECURITY DEFINER functions ที่ role `authenticated` เรียกได้: **26** (Advisor ระดับ WARN)
- ทั้ง 26 มีอย่างน้อยรูปแบบ identity/role check ที่มองเห็นจาก source. **การค้นหารูปแบบไม่ใช่การพิสูจน์ว่า authorization ปลอดภัย**; ต้องทดสอบ IDOR/BOLA/roles ใน staging
- สองฟังก์ชันที่ไม่ได้ใช้ `FORBIDDEN` guard ตรง ๆ ได้แก่ `applicant_archived_job` (จำกัด `user_id=auth.uid()`) และ `my_exam_cards` (จำกัด `a.user_id=auth.uid()` พร้อมเงื่อนไขบัตรสอบ); ไม่ใช่เหตุให้ต้อง revoke โดยพลการ
- `applications`, `application_documents`, `notifications`, `profiles`, `staff_notes`, `user_roles` เปิด RLS และไม่ grant SELECT ให้ `anon`
- Supabase Advisor แจ้ง `auth_leaked_password_protection`: **ยังปิดอยู่**. ต้องให้ผู้ดูแลที่มีสิทธิ์ตั้งค่า Auth เปิดและทดสอบ
- Advisor แจ้ง `rls_enabled_no_policy` 10 ตาราง: อาจเป็นตาราง internal/service-only อย่าสร้าง allow policy ให้เฉย ๆ
- Advisor แจ้ง Foreign Keys ที่ไม่มีดัชนี 3 รายการ: 2 ตาราง private/test และ `email_outbox` ที่ยุติแล้ว; ไม่ใช่ปัญหาความปลอดภัยวิกฤต

## สิ่งที่ยังไม่ได้พิสูจน์
- การข้ามสิทธิ์ข้อมูลผู้สมัคร A/B ผ่าน Browser/API และผ่าน Signed URLs จริง
- HR permission matrix ต่อแต่ละ RPC, resource ownership, stale tokens, admin account recovery
- MFA ของ admin, leaking service secrets, upload/download policy กับ Drive ใน session จริง
- การเปลี่ยน password ที่ตรวจ compromised passwords (Leaked Password Protection)

## ไฟล์ชุดทดสอบ
- `supabase/tests/production-readonly-security.sql`: query อ่านอย่างเดียวสำหรับเจ้าหน้าที่
- `scripts/staging-auth-permissions.mjs`: ทดสอบบัญชี fixture A/B จริงบน staging, ปฏิเสธ production ref โดยอัตโนมัติ
- `.github/workflows/staging-applicant-e2e.yml`: workflow แบบ manual และ **disabled** จนกว่าตั้ง `RMUTI_STAGING_E2E_ENABLED=true`
- `supabase/tests/security.sql`: fixture SQL สำหรับ staging เท่านั้น มี transaction rollback แต่ห้ามรันกับ production

## งาน IT ก่อนลงนามรับรอง
1. จัดหาหรือสร้าง staging project ที่ไม่ใช้ข้อมูลจริง (ตรวจค่าใช้จ่ายก่อนสร้าง)
2. สร้างสองบัญชีผู้สมัคร A/B และ HR/Admin test โดยใช้ที่อยู่อีเมลทดสอบที่เป็นเจ้าของ
3. ทดสอบ A ดูข้อมูล B ไม่ได้ทั้ง SQL, API, Storage/Drive signed URL และ PDF
4. ทดสอบ applicant เรียก admin RPC ไม่ได้, HR ที่ไม่มี permission เรียก sensitive RPC ไม่ได้
5. เปิด Leaked Password Protection ใน Supabase Authentication settings หากแผนบริการรองรับ
6. เปิด MFA/strong auth สำหรับแอดมินและตั้งแจ้งเตือนพฤติกรรมเข้าสู่ระบบผิดปกติ
7. รัน Advisors ซ้ำหลังปรับ; ห้าม revoke 26 function จาก authenticated โดยตรง เพราะระบบแอดมินที่ล็อกอินต้องเรียกใช้หลายรายการ

**ผล: ผ่านการตรวจแบบอ่านอย่างเดียว / รอ penetration + staging A/B UAT**
