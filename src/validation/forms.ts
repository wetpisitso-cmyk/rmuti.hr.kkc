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
