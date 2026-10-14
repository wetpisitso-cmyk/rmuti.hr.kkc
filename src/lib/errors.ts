const errors: Record<string, string> = {
  UNAUTHORIZED: "กรุณาเข้าสู่ระบบอีกครั้ง",
  CONFIRMATION_MISMATCH: "เลขใบสมัครที่ยืนยันไม่ตรงกัน",
  APPLICATION_NOT_FOUND: "ไม่พบใบสมัครนี้ อาจถูกลบไปแล้ว",
  FORBIDDEN: "คุณไม่มีสิทธิ์ทำรายการนี้",
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
  PAYMENT_LOCKED: "ไม่สามารถแก้ไขรายการชำระเงินนี้ได้",
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
