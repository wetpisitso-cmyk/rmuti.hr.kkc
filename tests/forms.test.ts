import { describe, it, expect } from "vitest";
import {
  registrationSchema,
  passwordSchema,
  personalSchema,
  validThaiID,
} from "../src/validation/forms";
import { csv, bangkokISO, bangkokInput, safeUrl } from "../src/lib/format";
import { normalizeRegistrationEmail, registrationEmailIssue, suggestedEmailCorrection } from "../src/validation/registration-email";
describe("registration and privacy", () => {
  const sample = {
    prefix: "นาย",
    first_name: "ทดสอบ",
    last_name: "ระบบ",
    email: "person@gmail.com",
    confirm_email: "person@gmail.com",
    phone: "0800000000",
    password: "testpassword",
    confirm: "testpassword",
    consent: true,
  };
  it("rejects missing consent", () =>
    expect(
      registrationSchema.safeParse({ ...sample, consent: false }).success,
    ).toBe(false));
  it("rejects a mismatched password", () =>
    expect(
      registrationSchema.safeParse({ ...sample, confirm: "otherpassword" })
        .success,
    ).toBe(false));
  it("rejects short passwords", () =>
    expect(
      passwordSchema.safeParse({ password: "1234567", confirm: "1234567" })
        .success,
    ).toBe(false));
  it("accepts the complete registration form", () =>
    expect(registrationSchema.safeParse(sample).success).toBe(true));
  it("rejects mistyped provider domains and suggests the correct spelling", () => {
    expect(registrationEmailIssue("person@gamil.com")).toContain("person@gmail.com");
    expect(suggestedEmailCorrection("person@GMAIL.CON")).toBe("person@gmail.com");
    expect(registrationSchema.safeParse({ ...sample, email: "person@gamil.com", confirm_email: "person@gamil.com" }).success).toBe(false);
  });
  it("rejects mismatched confirmation even when the email has valid syntax", () => {
    expect(registrationSchema.safeParse({ ...sample, confirm_email: "other@gmail.com" }).success).toBe(false);
  });
  it("normalizes surrounding spaces and letter case", () => {
    expect(normalizeRegistrationEmail(" Person@GMAIL.COM ")).toBe("person@gmail.com");
    expect(registrationSchema.safeParse({ ...sample, email: " Person@GMAIL.COM ", confirm_email: "person@gmail.com" }).success).toBe(true);
  });
  it("rejects test and temporary email domains", () => {
    for (const domain of ["example.invalid","example.com","mailinator.com","gmail.con"]) {
      expect(registrationEmailIssue("person@" + domain)).toBeTruthy();
    }
  });
  it("rejects invalid national ID lengths and checksum", () => {
    expect(validThaiID("123")).toBe(false);
    expect(validThaiID("1234567890123")).toBe(false);
  });
});
describe("applicant English name is required before submission", () => {
  const personal = { prefix: "นางสาว", first_name: "ทดสอบ", last_name: "ระบบ", english_name: "TEST PERSON", birth_date: "2000-01-01", phone: "0800000000", address: "Khon Kaen", gender: "ไม่ประสงค์ระบุ", nationality: "ไทย", ethnicity:"ไทย", religion:"พุทธ", line_id:"ไม่มี", skills:"ไม่มี", marital_status: "โสด", registered_address: "Khon Kaen" };
  it("accepts complete English names", () => expect(personalSchema.safeParse(personal).success).toBe(true));
  it("rejects missing English names", () => expect(personalSchema.safeParse({ ...personal, english_name: "" }).success).toBe(false));
  it("rejects Thai-only names in the English field", () => expect(personalSchema.safeParse({ ...personal, english_name: "ทดสอบ ระบบ" }).success).toBe(false));
  for (const field of ["gender","nationality","marital_status","registered_address"] as const) {
    it(`requires ${field}`, () => expect(personalSchema.safeParse({ ...personal, [field]: "" }).success).toBe(false));
  }
});
describe("export and timezone", () => {
  it("prevents spreadsheet formulas in exported text", () => {
    const s = csv([{ ชื่อ: '=HYPERLINK("url")', หมายเหตุ: "+test" }]);
    expect(s).toContain("'=HYPERLINK");
    expect(s).toContain("'+test");
    expect(s.charCodeAt(0)).toBe(0xfeff);
  });
  it("converts Bangkok form inputs independently of browser timezone", () => {
    expect(bangkokISO("2026-10-14T09:30")).toBe("2026-10-14T02:30:00.000Z");
    expect(bangkokInput("2026-10-14T02:30:00.000Z")).toBe("2026-10-14T09:30");
  });
  it("rejects executable attachment URLs", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("https://example.com/file.pdf")).toBe(
      "https://example.com/file.pdf",
    );
  });
});

describe("conditional military status on applicant forms", () => {
  const form = { prefix:"นาย",first_name:"ทดสอบ",last_name:"ระบบ",english_name:"TEST APPLICANT",birth_date:"2000-01-01",phone:"0800000000",address:"Khon Kaen",gender:"ชาย",nationality:"ไทย",ethnicity:"ไทย",religion:"พุทธ",line_id:"ไม่มี",skills:"ไม่มี",marital_status:"โสด",registered_address:"Khon Kaen",military_status:"" };
  it("blocks males with no military status",()=>expect(personalSchema.safeParse(form).success).toBe(false));
  it("blocks males with not-applicable military status",()=>expect(personalSchema.safeParse({...form,military_status:"ไม่เกี่ยวข้อง"}).success).toBe(false));
  it("accepts completed military selection",()=>expect(personalSchema.safeParse({...form,military_status:"ผ่านการเกณฑ์ทหาร"}).success).toBe(true));
  it("requires detail for other military choice",()=>{
    expect(personalSchema.safeParse({...form,military_status:"อื่น ๆ: "}).success).toBe(false);
    expect(personalSchema.safeParse({...form,military_status:"อื่น ๆ: ผ่อนผันตามประกาศ"}).success).toBe(true);
  });
  it("does not require female applicants to fill military status",()=>expect(personalSchema.safeParse({...form,gender:"หญิง",military_status:""}).success).toBe(true));
  it("keeps legacy other gender values for draft correction",()=>expect(personalSchema.safeParse({...form,gender:"อื่น ๆ",military_status:""}).success).toBe(true));
});

describe("male military eligibility excludes pending states", () => {
  const personal = { prefix:"นาย",first_name:"ทดสอบ",last_name:"ระบบ",english_name:"TEST APPLICANT",birth_date:"2000-01-01",phone:"0800000000",address:"Khon Kaen",gender:"ชาย",nationality:"ไทย",ethnicity:"ไทย",religion:"พุทธ",line_id:"ไม่มี",skills:"ไม่มี",marital_status:"โสด",registered_address:"Khon Kaen" };
  for (const value of ["อยู่ระหว่างดำเนินการ","ยังไม่ผ่านเกณฑ์ทหาร","อื่น ๆ: รอดำเนินการ","อื่น ๆ: รอเกณฑ์ทหาร"]) {
    it(`rejects a pending status: ${value}`, () =>
      expect(personalSchema.safeParse({ ...personal, military_status:value }).success).toBe(false));
  }
  it("accepts passed military service",()=>
    expect(personalSchema.safeParse({...personal,military_status:"ผ่านการเกณฑ์ทหาร"}).success).toBe(true));
  it("accepts legally exempted status",()=>
    expect(personalSchema.safeParse({...personal,military_status:"ได้รับการยกเว้น"}).success).toBe(true));
});

describe("all remaining applicant personal fields required", () => {
  const applicant = { prefix:"นางสาว",first_name:"ทดสอบ",last_name:"ระบบ",
    english_name:"TEST PERSON",birth_date:"2000-01-01",phone:"0800000000",
    address:"Khon Kaen",gender:"หญิง",nationality:"ไทย",ethnicity:"ไทย",
    religion:"พุทธ",line_id:"ไม่มี",skills:"ไม่มี",
    marital_status:"โสด",registered_address:"Khon Kaen" };
  for (const field of ["ethnicity","religion","line_id","skills"] as const) {
    it(`rejects blank ${field} on the personal step`, () => {
      expect(personalSchema.safeParse({...applicant,[field]:""}).success).toBe(false);
      expect(personalSchema.safeParse({...applicant,[field]:"   "}).success).toBe(false);
    });
  }
  it("permits applicants without LINE or special skills to state none", () =>
    expect(personalSchema.safeParse(applicant).success).toBe(true));
  it("continues to validate preexisting mandatory information", () =>
    expect(personalSchema.safeParse({...applicant,first_name:""}).success).toBe(false));
});
