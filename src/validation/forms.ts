import { z } from "zod";
export const registrationSchema = z
  .object({
    prefix: z.string().min(1, "กรุณาเลือกคำนำหน้า"),
    first_name: z.string().trim().min(1, "กรุณากรอกชื่อ"),
    last_name: z.string().trim().min(1, "กรุณากรอกนามสกุล"),
    email: z.email("อีเมลไม่ถูกต้อง"),
    phone: z.string().regex(/^[0-9+ -]{9,20}$/, "เบอร์โทรศัพท์ไม่ถูกต้อง"),
    password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร"),
    confirm: z.string(),
    consent: z.boolean().refine(Boolean, "กรุณารับทราบนโยบายข้อมูลส่วนบุคคล"),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "รหัสผ่านทั้งสองช่องไม่ตรงกัน",
  });
export const passwordSchema = z
  .object({
    password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "รหัสผ่านทั้งสองช่องไม่ตรงกัน",
  });
export const personalSchema = z.object({
  prefix: z.string().min(1),
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
  birth_date: z.string().min(1),
  phone: z.string().regex(/^[0-9+ -]{9,20}$/),
  address: z.string().trim().min(1),
});
export function validThaiID(id: string) {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}

/** Validate education data before sending it to Supabase.
 * The application's graduation year uses the Buddhist Era (BE).
 */
export type EducationInput = {
  degree: string;
  major: string;
  institution: string;
  graduation_year?: string | number | null;
  gpa?: string | number | null;
};
export function educationIssue(rows: EducationInput[], allowIncomplete = false): string | null {
  if (!rows.length && !allowIncomplete) return "กรุณากรอกข้อมูลการศึกษาอย่างน้อยหนึ่งรายการ";
  for (const [index, ed] of rows.entries()) {
    const name = "รายการการศึกษาที่ " + (index + 1);
    if (!allowIncomplete && (!ed.degree?.trim() || !ed.major?.trim() || !ed.institution?.trim())) {
      return "กรุณากรอกวุฒิ สาขาวิชา และสถานศึกษาให้ครบ (" + name + ")";
    }
    const year = String(ed.graduation_year ?? "").trim();
    if (year && (!/^\d{4}$/.test(year) || Number(year) < 2400 || Number(year) > 2800)) {
      return "กรุณากรอกปีสำเร็จการศึกษาเป็น พ.ศ. ระหว่าง 2400–2800 (" + name + ")";
    }
    const gpa = String(ed.gpa ?? "").trim();
    if (gpa && (!Number.isFinite(Number(gpa)) || Number(gpa) < 0 || Number(gpa) > 4)) {
      return "กรุณากรอกเกรดเฉลี่ย GPA ระหว่าง 0.00–4.00 (" + name + ")";
    }
  }
  return null;
}
