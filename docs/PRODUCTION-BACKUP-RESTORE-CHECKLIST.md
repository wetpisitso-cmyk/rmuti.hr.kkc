# RMUTI KKC — การสำรองข้อมูลและตรวจสอบการกู้คืน (5 พ.ย. 2569)

## ผลตรวจจริง (read-only, production)
- Supabase project: `rioukmxrgaknayltxxyk`; โครงสร้าง Storage ใหม่ `applicant_uploads → gdrive`
- `application_documents`: 1,428 ระเบียน ประกอบด้วย 188 อ้างอิง Drive โดยตรง และ 1,240 เส้นทางเก่าที่มีรายการสำรองตรวจยืนยันแล้ว
- `storage_drive_backup_manifest`: 1,406 รายการ สถานะ `verified` ทั้งหมด; 705 รายการลบต้นฉบับ Supabase แล้วโดยมีบันทึกสำรอง
- ไม่มีเส้นทางเอกสารแบบเก่าที่ทั้งต้นฉบับและรายการสำรองหายไปในแบบตรวจข้างล่าง (0 รายการ)
- **ยังไม่ได้ตรวจเปิดไฟล์ Google Drive ครบทุกฉบับ / ยังไม่ได้ทดสอบกู้คืนฐานข้อมูลทั้งก้อน / ยังไม่มีหลักฐานว่าตั้ง scheduled database dump จริง** ดังนั้นห้ามตีความว่าได้ backup+restore แบบ end-to-end แล้ว

## คำสั่งตรวจรายการ (read-only)
```sql
SELECT count(*) AS all_documents,
count(*) FILTER(WHERE ad.storage_path LIKE '%/gdrive/%') AS direct_drive,
count(*) FILTER(WHERE ad.storage_path NOT LIKE '%/gdrive/%' AND m.source_path IS NOT NULL) AS verified_legacy,
count(*) FILTER(WHERE ad.storage_path NOT LIKE '%/gdrive/%' AND m.source_path IS NULL AND o.name IS NULL) AS unaccounted_legacy
FROM public.application_documents ad
LEFT JOIN public.storage_drive_backup_manifest m
 ON m.source_path=ad.storage_path AND m.status='verified'
LEFT JOIN storage.objects o ON o.name=ad.storage_path AND o.bucket_id='application-files';

SELECT status,count(*),count(*) FILTER(WHERE source_deleted_at IS NOT NULL) AS originals_removed
FROM public.storage_drive_backup_manifest GROUP BY status;
```

## ขั้นตอนที่ผู้ดูแลระบบต้องทำก่อนรับรองการสำรองฐานข้อมูล
1. ให้ฝ่าย IT มหาวิทยาลัยกำหนดพื้นที่สำรองแบบเข้ารหัสที่ควบคุมสิทธิ์และ retention โดย **ห้าม** อัปโหลดข้อมูลผู้สมัครหรือ SQL dump ไปยัง GitHub repository, GitHub Actions artifact สาธารณะ หรือห้องแชต
2. ตรวจแผนบริการ Supabase ใน Dashboard > Database > Backups ว่ารองรับ automated backups หรือ PITR หรือไม่ (Free ไม่ควรสมมติว่ามี). ให้ผู้ดูแลใช้ Supabase CLI รุ่นล่าสุด และตรวจ `supabase db dump --help` และ `supabase db dump --project-id ...` ตามคู่มือ CLI รุ่นที่ใช้จริง; ถ้าใช้ direct connection ต้องใช้รหัสผ่าน DB ผ่าน secret manager ขององค์กร
3. สำรอง schema, roles, data (รวม `auth` ที่จำเป็นต่อการย้ายผู้ใช้งาน) ตามคำแนะนำ Supabase, เก็บ backup encrypted, versioned และ checksum SHA-256 ภายในบัญชีองค์กรเท่านั้น
4. แยกเอกสาร Google Drive backup, โครงสร้างโฟลเดอร์ และ manifest; ตรวจสุ่มเปิดไฟล์จริงให้ตรง `drive_path`, ขนาด, hash และสิทธิ์เปิดในฐานะผู้สมัคร/แอดมิน
5. ตั้งตารางสำรองซ้ำตามการรับสมัครจริง และ alert เมื่อ backup ล้มเหลว/เก่าเกินเกณฑ์ พร้อมบันทึกเวลา จำนวนแถว จำนวนไฟล์ และ checksum โดยไม่เปิดเผยข้อมูลส่วนบุคคล
6. ทดลอง restore ไปยัง **โครงการทดสอบที่แยกจาก Production** เท่านั้น และไม่ส่งอีเมล/ข้อความแจ้งเตือนระหว่างทดสอบ ตรวจ auth/permissions, foreign keys, เอกสาร, signed URLs, บัตรสอบ และข้อมูลประกาศ
7. เก็บรายงานผล restore (วัน, ผู้ดำเนินการ, เวลาที่ใช้, ปัญหา, บทสรุป) และกำหนด RPO/RTO กับหน่วยงานก่อนถือว่า backup พร้อมจริง

## ข้อจำกัดงานตรวจครั้งนี้
เครื่องมือ Supabase ที่เชื่อมต่อสำหรับงานนี้มี SQL, migration, read log และ Edge Function แต่ไม่มี API ที่ยืนยันดาวน์โหลด `pg_dump` และ restore แบบครบกระบวนการ หรือสร้าง secret/schedule ในบัญชีองค์กรโดยได้รับอนุญาต เราจึงไม่สร้าง backup ปลอมจากการคัดลอกข้อมูลบางตาราง ไม่แอบคัดลอกข้อมูลส่วนบุคคลออกจาก production และไม่อ้างว่ากู้คืนผ่านแล้ว
