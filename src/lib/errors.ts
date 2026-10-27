const errors: Record<string, string> = {
  EXAM_CARD_FONT_UNAVAILABLE: "ไม่สามารถโหลดฟอนต์สารบรรณสำหรับบัตรสอบได้ กรุณาตรวจอินเทอร์เน็ตและลองเปิด PDF อีกครั้ง",
  EXAM_CARD_ALREADY_ISSUED: "บัตรสอบนี้อนุมัติออกแล้ว ไม่จำเป็นต้องอนุมัติซ้ำ",
  EXAM_CARD_RULES_NOT_APPROVED: "กรุณาอนุมัติข้อความข้อปฏิบัติสำหรับผู้เข้าสอบในหน้าจัดการบัตรสอบก่อน",
  NOT_ELIGIBLE_FOR_EXAM_CARD: "ผู้สมัครยังไม่ครบเงื่อนไข: ต้องผ่านคุณสมบัติ ยืนยันชำระเงิน และเผยแพร่กำหนดสอบ",
  VALID_ADMIN_SIGNATURE_AND_APPROVAL_REQUIRED: "ลายเซ็นเจ้าหน้าที่หรือการอนุมัติ PDF ใบสมัครยังไม่สมบูรณ์",
  APPLICANT_PHOTO_REQUIRED: "ยังไม่มีรูปถ่ายที่ถูกต้องสำหรับออกบัตรสอบ",
  EXAM_ASSIGNMENT_NOT_FOUND: "ไม่พบเลขประจำตัวสอบที่ผูกกับผู้สมัครรายนี้",
  EXAM_CARD_NOT_AVAILABLE: "บัตรสอบยังไม่พร้อมดาวน์โหลดหรือถูกยกเลิก กรุณาติดต่อเจ้าหน้าที่",
  CARD_TEXT_OVERFLOW: "ข้อมูลบนบัตรสอบยาวเกินพื้นที่ A4 กรุณาตรวจสอบข้อมูลก่อนออก PDF",
  CARD_NOTICE_OVERFLOW: "ข้อความข้อปฏิบัติล้นพื้นที่บัตรสอบ กรุณาติดต่อผู้ดูแลระบบ",
  BATCH_MAX_20: "ดาวน์โหลดบัตรสอบรวมได้สูงสุดครั้งละ 20 ใบ",
  UNAUTHORIZED: "กรุณาเข้าสู่ระบบอีกครั้ง",
  CONFIRMATION_MISMATCH: "เลขใบสมัครที่ยืนยันไม่ตรงกัน",
  APPLICATION_NOT_FOUND: "ไม่พบใบสมัครนี้ อาจถูกลบไปแล้ว",
  FORBIDDEN: "คุณไม่มีสิทธิ์ทำรายการนี้",
  ADMIN_USERNAME_TAKEN: "ชื่อผู้ใช้ Admin นี้มีคนใช้แล้ว กรุณาเลือกชื่ออื่น",
  INVALID_ADMIN_USERNAME: "ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษ เริ่มด้วยตัวอักษร และยาว 4–32 ตัวอักษร",
  ADMIN_USE_SEPARATE_LOGIN: "บัญชี Admin กรุณาเข้าใช้ผ่านหน้าเข้าสู่ระบบ Admin ด้วย Username และ Password",
  ADMIN_LOGIN_RATE_LIMITED: "ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่",
  SIGNER_PROFILE_NAME_REQUIRED: "กรุณากรอกชื่อและนามสกุลในโปรไฟล์บัญชีของคุณก่อนเซ็นรับรอง",
  APPLICATION_NUMBER_REQUIRED: "ต้องกำหนดเลขผู้สมัครก่อนอนุมัติผ่านคุณสมบัติ",
  APPLICATION_NUMBER_ALREADY_ASSIGNED: "ใบสมัครนี้ได้รับเลขแล้ว",
  DUPLICATE_APPLICATION_NUMBER: "เลขผู้สมัครนี้มีผู้ใช้แล้ว",
  INVALID_APPLICATION_NUMBER: "รูปแบบเลขผิดหรือปีไม่ตรงกับรอบ",
  APPLICATION_NOT_READY: "ใบสมัครยังไม่พร้อมออกเลข",
  ROUND_CLOSED: "ยังไม่เปิดรับสมัครหรือหมดเวลารับสมัครแล้ว",
  APPLICATION_LOCKED: "ใบสมัครนี้ถูกล็อกหรือหมดเวลาแก้ไขแล้ว",
  DUPLICATE_APPLICATION:
    "มีใบสมัครตำแหน่งนี้อยู่แล้ว กรุณาเปิดจากใบสมัครของฉัน",
  ROUND_QUOTA: "จำนวนใบสมัครในรอบนี้ครบตามที่กำหนดแล้ว",
  INCOMPLETE_APPLICATION: "กรุณากรอกข้อมูลส่วนตัวให้ครบ",
  EDUCATION_REQUIRED: "กรุณากรอกข้อมูลการศึกษาให้ครบ",
  DOCUMENTS_REQUIRED: "กรุณาแนบเอกสารบังคับให้ครบ",
  CONSENT_REQUIRED: "กรุณารับทราบนโยบายฉบับปัจจุบัน",
  INVALID_NATIONAL_ID: "เลขประจำตัวประชาชนไม่ถูกต้อง",
  INVALID_TRANSITION: "ไม่สามารถเปลี่ยนสถานะตามขั้นตอนนี้ได้",
  PAYMENT_REQUIRED: "ต้องยืนยันการชำระเงินก่อนผ่านคุณสมบัติ",
  PAYMENT_SLIP_REQUIRED: "กรุณาแนบสลิปและส่งข้อมูลชำระเงินก่อนยืนยันส่งใบสมัคร",
  PAYMENT_LOCKED: "ไม่สามารถแก้ไขรายการชำระเงินนี้ได้",
  PAYMENT_ALREADY_CONFIRMED: "ใบสมัครนี้ยืนยันรับชำระเงินแล้ว ไม่ต้องตรวจสลิปซ้ำ",
  STALE_PAYMENT: "มีหลักฐานใหม่กว่า กรุณาตรวจรายการล่าสุด",
  POSITION_LOCKED: "มีผู้ส่งใบสมัครแล้ว ไม่สามารถเปลี่ยนรอบหรือค่าธรรมเนียม",
  REASON_REQUIRED: "กรุณาระบุเหตุผล",
  DEADLINE_REQUIRED: "กรุณากำหนดเวลาแก้ไขในอนาคต",
  INVALID_FILE:
    "รองรับไฟล์ PDF/JPG/PNG ที่ถูกต้องเท่านั้น รูปติดใบสมัครต้องเป็นรูปภาพ",
  FILE_TOO_LARGE: "ไฟล์ใหญ่เกินกำหนด",
  RATE_LIMITED: "ทำรายการถี่เกินไป กรุณาลองใหม่ในอีกสักครู่",
  EMPTY_RESULTS: "ยังไม่มีผลให้เผยแพร่",
  SELF_ROLE_CHANGE: "ไม่สามารถเปลี่ยนสิทธิ์ของตนเองได้",
  INVALID_EXAM_ASSIGNMENT:
    "ใบสมัครต้องผ่านคุณสมบัติและตรงกับตำแหน่งของกำหนดสอบ",
  INVALID_PAYMENT: "กรุณาตรวจยอดเงินและวันเวลาชำระ",
  INVALID_DOCUMENT_TYPE: "ประเภทเอกสารไม่ถูกต้อง",
  INVALID_INPUT: "กรุณาตรวจข้อมูลในแบบฟอร์ม",
  INVALID_PAYMENT_SETTINGS: "กรุณาตรวจชื่อธนาคาร ชื่อบัญชี และเลขบัญชีให้ถูกต้อง",
  PAYMENT_QR_NOT_FOUND: "ไม่พบ QR Code ที่อัปโหลด กรุณาอัปโหลดอีกครั้ง",
  application_education_gpa_check: "เกรดเฉลี่ย GPA ต้องอยู่ระหว่าง 0.00–4.00 กรุณาย้อนกลับไปแก้ไขข้อมูลการศึกษา",
  application_education_graduation_year_check: "ปีสำเร็จการศึกษาต้องใช้ปี พ.ศ. ระหว่าง 2400–2800",
  application_experience_check: "วันที่สิ้นสุดการทำงานต้องไม่อยู่ก่อนวันเริ่มงาน",
  FILE_CHECK_FAILED: "ระบบตรวจสิทธิ์เปิดเอกสารขัดข้อง กรุณาลองใหม่",
  FILE_NOT_FOUND: "ไม่พบไฟล์เอกสารที่ร้องขอ",
  PDF_LIBRARY_FAILED: "ไม่สามารถโหลดเครื่องมือรวมไฟล์ PDF ได้ กรุณารีเฟรชหน้าเว็บแล้วลองอีกครั้ง",
  PDF_RENDER_FAILED: "ไม่สามารถสร้างหน้าปก PDF ได้ กรุณาลองใหม่",
  FILE_DOWNLOAD_FAILED: "ไม่สามารถอ่านไฟล์แนบจากพื้นที่เก็บข้อมูลได้ กรุณาลองใหม่",
  NO_APPLICANT_DOCUMENTS: "ผู้สมัครรายนี้ยังไม่มีเอกสารแนบให้ดาวน์โหลด",
  TOO_MANY_DOCUMENTS: "มีเอกสารแนบมากเกินกว่าจะรวมในครั้งเดียว กรุณาติดต่อผู้ดูแลระบบ",
  TOO_MANY_PAGES: "เอกสาร PDF มีจำนวนหน้ามากเกินข้อจำกัดการรวมไฟล์",
  UNSUPPORTED_FILE: "มีไฟล์แนบที่ไม่รองรับการรวม PDF",
  UPLOAD_FAILED: "อัปโหลดไม่สำเร็จ กรุณาลองใหม่",
};
export function errorTH(e: unknown): string {
  const x = e as { message?: string; code?: string };
  const msg = x?.message || String(e);
  for (const [code, text] of Object.entries(errors))
    if (msg.includes(code)) return text;
  if (msg.includes("Invalid login credentials"))
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (msg.includes("already registered"))
    return "อีเมลนี้มีบัญชีแล้ว กรุณาเข้าสู่ระบบ";
  if (msg.includes("Email not confirmed"))
    return "บัญชียังใช้งานไม่ได้ กรุณาติดต่อผู้ดูแลเพื่อตรวจการตั้งค่า Email Confirmation";
  if (msg.includes("rate limit") || msg.includes("too many"))
    return "ทำรายการถี่เกินไป กรุณารอสักครู่";
  if (x?.code === "23505")
    return "พบข้อมูลซ้ำ เช่น เลขอ้างอิงชำระเงินหรือเลขประจำตัวสอบ";
  if (msg.includes("fetch") || msg.includes("network"))
    return "เชื่อมต่อไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตและลองใหม่";
  return "ทำรายการไม่สำเร็จ กรุณาตรวจข้อมูลหรือติดต่อผู้ดูแล";
}
