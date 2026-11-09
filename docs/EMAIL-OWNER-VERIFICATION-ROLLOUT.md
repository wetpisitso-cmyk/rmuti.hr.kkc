# RMUTI KKC – การเปิดใช้ยืนยันอีเมลจริงอย่างปลอดภัย
ตรวจ 9 พฤศจิกายน 2569

## ปัจจุบัน
- ระบบยังใช้รหัสผ่านและอีเมล โดยให้พิมพ์อีเมลซ้ำและเตือนโดเมนพิมพ์ผิดแล้ว
- Supabase Auth มี 312 บัญชีที่ถูกทำเครื่องหมาย email confirmed แต่ 311 บัญชีไม่มี timestamp ว่าเคยส่งลิงก์ยืนยัน: **ห้ามถือว่าพิสูจน์การเป็นเจ้าของกล่องเมลแล้ว**
- Supabase Auth ของ production ยังไม่ยืนยันว่ามี Custom SMTP และ Confirm Email เปิด; การแสดงผลบัญชีที่มี session ทันทีเป็นพฤติกรรมเดิม
- การแจ้งสถานะการสมัครผ่านเว็บ (ไม่ใช่ email) ต้องคงเดิม ไม่เปิด outbound applicant-email-worker

## ข้อควรระวัง
Supabase Auth SMTP สำหรับส่ง link confirmation/password reset **ต่างจาก** ระบบส่งอีเมลแจ้งสถานะที่ยกเลิกแล้ว
ถ้าเปิด Confirm Email โดย SMTP ยังใช้ไม่ได้ สมัครใหม่จะไม่สามารถเข้าสู่ระบบได้ทันที
ไม่ยกเลิกสถานะ confirmed เดิมจำนวนมากโดยไม่มีแผนสื่อสารและผู้ดูแลแก้ไขบัญชี

## ขั้นตอนทดสอบที่ staging ก่อน production
1. ให้ IT จัดหา SMTP ที่รองรับผู้รับภายนอก ทดสอบส่งจริงด้วยกล่องจดหมายมหาวิทยาลัยและ Gmail อย่างน้อยสองโดเมน
2. ยืนยันโดเมนผู้ส่ง SPF, DKIM และ DMARC ตามบริการ, ตั้ง sender name/email ที่ผู้สมัครจดจำได้
3. ใน **Supabase Staging project ที่ไม่ใช้ข้อมูลจริง** ตั้ง Authentication → SMTP ให้พร้อมและทดสอบการส่ง
4. ตั้ง Authentication → URL Configuration: Site URL `https://wetpisitso-cmyk.github.io/rmuti.hr.kkc/` ใน production และ Redirect URLs ตาม URL ที่ใช้จริง; staging ต้องชี้ URL staging ที่แยกจาก production
5. เปิด Confirm Email เฉพาะ staging ก่อน ทดสอบสมัครด้วยบัญชีใหม่: ไม่ได้ session ก่อนกดลิงก์ → รับลิงก์จริง → กดลิงก์แล้ว sign in สำเร็จ
6. ทดสอบลิงก์หมดอายุ ส่งซ้ำไม่เกิน rate limit, อีเมลซ้ำ, อีเมลผิด, ลืมรหัสผ่าน, มือถือ Safari และ Chrome
7. ตรวจ guard ว่า identity ที่ไม่ผ่านการยืนยันไม่สามารถเข้าสู่ขั้นตอนสมัครงานได้ใน staging
8. ทดสอบขั้นตอน rollback กรณีผู้ให้บริการ SMTP ขัดข้อง โดยปรึกษา IT ก่อนเปลี่ยน setting จริง
9. ค่อยนำค่า Auth SMTP และ Confirm Email ขึ้น production นอกช่วงรับสมัครหนาแน่น และตรวจผู้สมัครทดสอบใหม่โดยไม่เปลี่ยนบัญชีเก่า

## รหัสที่แก้ไว้ในเว็บ
- หน้า Register แสดงข้อความเหมาะสมเมื่อ signup สำเร็จแต่ไม่มี session; ไม่สั่งให้แอดมินปิด Confirm Email อีก
- มีปุ่มขอส่งลิงก์ยืนยันซ้ำพร้อมจัดการข้อผิดพลาด
- ยังไม่ตั้ง redirect URL แทนค่าปัจจุบันจนกว่า Auth Allowlist จะได้รับการทดสอบ
- **ปุ่มส่งซ้ำไม่รับประกันว่าข้อความถูกส่ง หาก SMTP ไม่พร้อม**

## รายการที่ยังต้องมีสิทธิ์ของ IT
- ผู้ให้บริการ SMTP/โดเมนผู้ส่ง, Secret SMTP, Auth config permissions
- นโยบายบัญชีเก่า 312 บัญชี: ควรตรวจความเป็นเจ้าของอีเมลแบบทยอยดำเนินการโดยไม่ล็อกผู้สมัครที่ใช้งานจริง
- Leaked Password Protection ใน Auth settings (ยังปิดอยู่จาก Security Advisor)
- เปิด CAPTCHA สำหรับสมัครสมาชิกเมื่อ Auth emails เริ่มใช้จริง

เอกสารทางการ: https://supabase.com/docs/guides/auth/auth-smtp
