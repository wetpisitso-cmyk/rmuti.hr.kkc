# สำรองและกู้คืน

แยกการสำรองฐานข้อมูลกับไฟล์ Storage เพราะ database backup ไม่ใช่การสำรอง bytes ของเอกสารใน bucket โดยอัตโนมัติ

## สำรอง

1. เก็บ source/migrations และ lockfile ใน GitHub ไม่มี backend secrets หรือเอกสารผู้สมัครอยู่ใน repository
2. ตรวจความสามารถ automatic backups/PITR ตามแผน Supabase ขององค์กรใน Dashboard ก่อนเลือกวิธี อย่าเข้าใจว่า Free plan มี PITR โดยอัตโนมัติ
3. เจ้าของ project ใช้ CLI login/link แล้วตรวจ `npx supabase db dump --help` เพื่อสำรอง roles/schema/data ตามรูปแบบที่ CLI เวอร์ชันนั้นรองรับ เก็บ backup ในพื้นที่เข้ารหัสที่หน่วยงานควบคุม ห้าม commit หรือแชร์ public
4. Auth users และข้อมูลที่เกี่ยวกับการเข้าสู่ระบบต้องสำรองด้วยวิธีที่ Supabase รองรับครบถ้วน การ export เฉพาะตาราง public ไม่พอสำหรับการย้ายบัญชี
5. สำรอง object bytes ทุกไฟล์ใน private bucket ผ่าน Storage/S3 credentials ฝั่งเจ้าหน้าที่ที่ได้รับสิทธิ์ รักษา path เดิม และ manifest ชื่อ/ขนาด/hash เก็บ credentials นอก git
6. บันทึก project ref, เวลา backup, migration version และผลตรวจจำนวนตาราง/ไฟล์ไว้ในบันทึกที่ไม่เปิดเผย PII

## กู้คืน

1. หยุดรับสมัครระหว่างการกู้คืน ตั้ง project ทดสอบแยกจาก production
2. Restore database ด้วยเครื่องมือที่เหมาะกับ backup ตรวจ auth schema, user IDs และ foreign keys ก่อน restore ตารางใบสมัคร
3. คืน object bytes และ path เดิมใน application-files **คง bucket private** ตรวจ metadata และ document versions
4. ตรวจ functions, policies, grants, Auth/URL/SMTP settings และ Edge Secrets การคืนฐานข้อมูลไม่รับประกันว่าจะคืนบริการ/secret settings ครบ
5. ทดสอบ owner A/B, signed URLs, draft/submit, review และผลเผยแพร่ก่อนสลับหน้าเว็บไป project ที่กู้คืน

## ระยะเวลาเก็บและทำลายข้อมูล

ค่าจำนวนเดือนในหลังบ้านเป็นค่าตามนโยบายของหน่วยงาน ไม่มี auto-delete สำหรับข้อมูลสำคัญ ผู้รับผิดชอบต้องตรวจภาระเก็บเอกสาร สำรอง และอนุมัติการทำลายก่อนลบ เอกสารรุ่นเก่าก็อยู่ในขอบเขตนี้ด้วย
