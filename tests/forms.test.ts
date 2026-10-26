import { describe, it, expect } from "vitest";
import {
  registrationSchema,
  passwordSchema,
  personalSchema,
  validThaiID,
} from "../src/validation/forms";
import { csv, bangkokISO, bangkokInput, safeUrl } from "../src/lib/format";
describe("registration and privacy", () => {
  const sample = {
    prefix: "นาย",
    first_name: "ทดสอบ",
    last_name: "ระบบ",
    email: "example@example.invalid",
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
  it("rejects invalid national ID lengths and checksum", () => {
    expect(validThaiID("123")).toBe(false);
    expect(validThaiID("1234567890123")).toBe(false);
  });
});
describe("applicant English name is required before submission", () => {
  const personal = { prefix: "นางสาว", first_name: "ทดสอบ", last_name: "ระบบ", english_name: "TEST PERSON", birth_date: "2000-01-01", phone: "0800000000", address: "Khon Kaen" };
  it("accepts complete English names", () => expect(personalSchema.safeParse(personal).success).toBe(true));
  it("rejects missing English names", () => expect(personalSchema.safeParse({ ...personal, english_name: "" }).success).toBe(false));
  it("rejects Thai-only names in the English field", () => expect(personalSchema.safeParse({ ...personal, english_name: "ทดสอบ ระบบ" }).success).toBe(false));
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
