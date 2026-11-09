# RMUTI KKC — เข้ารหัสสำรอง PostgreSQL 17 อัตโนมัติและทดสอบกู้คืน
สถานะ: **เตรียมระบบเรียบร้อย แต่ยังไม่เปิดใช้งานจริง** จนกว่าจะตั้งค่า Secret, ตรวจการอัปโหลด และทดสอบ Restore กับ Staging

## ข้อสำคัญ
Supabase Free ไม่มี Automatic Database Backups ของแพลตฟอร์ม (อ่าน https://supabase.com/docs/guides/platform/backups) จำเป็นต้องสำรองด้วยตนเองหรือระบบที่องค์กรควบคุม

ไฟล์เอกสาร Google Drive 1,406 รายการที่ตรวจผ่านก่อนหน้านี้ *ไม่ใช่* full database backup. pg_dump ไม่รวมไฟล์ Storage/Google Drive หรือค่า project auth secret, JWT signing keys และการกำหนดค่าภายนอก

## สิ่งที่เพิ่มไว้
- `.github/workflows/backup-database.yml`: กำหนดรันทุกวัน **09:15 น. ประเทศไทย** (02:15 UTC) แต่ job จะไม่ทำงานจนกว่าตั้ง `RMUTI_BACKUP_ENABLED=true`
- `scripts/backup-database.sh`: pg_dump Postgres 17 รูปแบบ custom → pg_restore --list → age encryption → ส่ง Google Drive private folder ด้วย rclone → ตรวจ remote checksums. **ไม่เก็บ plaintext backup ใน GitHub artifacts หรือ repository**
- `scripts/restore-staging-only.sh`: decrypt → archive list → restore บน Staging โดยใช้ confirmation ที่เจาะจงและป้องกัน project id ของ production
- ไม่ใช้ service_role key ของเว็บไซต์หรือบัญชีผู้สมัครในการสำรองฐานข้อมูล

## สิ่งที่ฝ่าย IT ต้องกำหนดด้วยตัวเองก่อนเปิดระบบ
1. สร้าง **โฟลเดอร์เฉพาะสำหรับ DB Backup ที่ห้ามเปิดสาธารณะ** ใน Shared Drive ของมหาวิทยาลัย หรือพื้นที่ Drive ที่ Service Account มีสิทธิ์อัปโหลดจริง
2. สร้างคู่กุญแจ `age` บนคอมพิวเตอร์ของ IT (`age-keygen -o rmuti-kkc-backup-identity.txt`). เก็บ **private identity** อย่างน้อยสองที่แยกกันแบบเข้ารหัส/จำกัดสิทธิ์; ใน GitHub ให้ใส่เฉพาะ recipient **public** (รูปแบบ `age1...`)
3. GitHub → Settings → Secrets and variables → Actions → Repository secrets:
   - `RMUTI_BACKUP_DATABASE_URL`: Supabase Postgres 17 connection URI พร้อมรหัสผ่านฐานข้อมูลที่ URL encode ถูกต้อง (ใช้ session pooler หาก direct IPv6 ใช้ไม่ได้)
   - `RMUTI_BACKUP_AGE_RECIPIENT`: public age recipient ไม่ใช่ private key
   - `RMUTI_BACKUP_GDRIVE_SERVICE_ACCOUNT_BASE64`: Service Account JSON ที่เข้ารหัส base64 **เฉพาะ Secret เท่านั้น** โดย Service Account ต้องเข้าถึง backup folder ได้
   - `RMUTI_BACKUP_GDRIVE_FOLDER_ID`: รหัสโฟลเดอร์ Drive ส่วนตัวที่ใช้เก็บไฟล์ backup นี้
4. ก่อนเปิด schedule ให้ IT ลอง script จากเครื่องที่มี `docker age rclone` และ configuration ที่กำหนด; ตรวจไฟล์เข้ารหัสและ checksum บน Drive จริง
5. ทดสอบการกู้คืนด้วย **Supabase staging project อีกโครงการหนึ่ง** ที่สามารถลบทิ้งได้ ไม่ใช้ข้อมูลผู้สมัครจริงระหว่างทดสอบ และไม่อนุญาตให้ script รับ ref `rioukmxrgaknayltxxyk`.
   - ใช้ `ENCRYPTED_BACKUP_FILE`, `AGE_IDENTITY_FILE`, `STAGING_DATABASE_URL`, `STAGING_PROJECT_REF` และ `RESTORE_STAGING_CONFIRM=RESTORE_ISOLATED_STAGING_ONLY`
   - ***อันตราย: script ใช้ --clean --if-exists และจะลบ/แทนที่ schema/data ใน staging***. ห้ามใช้กับโครงการ production หรือ staging ที่มีข้อมูลที่ต้องรักษา
   - Staging ที่มีโครงสร้าง Auth/Extensions ของ Supabase อยู่แล้วอาจมี object conflict หรือ permissions; ให้ IT บันทึกปัญหาและปรับแผน restore ตามคำแนะนำ Supabase ไม่ถือว่าทดสอบผ่านจากเพียง pg_restore --list
6. ตรวจว่า Auth users/roles, application_documents, round/job/application counts และ RLS เทียบกับต้นฉบับแล้วตรง; ตรวจลิงก์ Drive สิทธิ์เปิด, PDF, ลายเซ็นและบัตรสอบ และปิดระบบแจ้งเตือน/SMTP ใน staging
7. เปิด GitHub repository variable `RMUTI_BACKUP_ENABLED=true` **หลังจาก** ทดสอบ Restore ผ่านและตั้ง monitoring เมื่อ workflow ล้มเหลวเท่านั้น
8. ทบทวน retention, immutable/off-site copies, ผู้รับผิดชอบแจ้งเตือนความล้มเหลว, RPO/RTO และสิทธิ์การเข้าถึงกับ IT มหาวิทยาลัย

## ข้อจำกัดและผลตรวจ
- ยังไม่มี Staging database แยกใน Supabase องค์กร: มีเพียงโครงการ production ที่ตรวจพบ
- ยังไม่ได้รับ Secret DB URL/Drive backup folder/age recipient; จึง **ไม่สามารถยืนยันว่าอัปโหลดสำรองอัตโนมัติสำเร็จได้**
- การตรวจ `pg_restore --list` ตรวจแค่โครงสร้าง archive ไม่ใช่การกู้คืนจริง
- ยังไม่เปลี่ยนโควตา Supabase/แผนราคา และไม่สร้างโครงการเสียเงินโดยไม่ได้รับอนุญาต
- ห้ามส่ง Database URL หรือ private age identity มาทางแชต หรือ commit ลง GitHub

คู่มือ: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
