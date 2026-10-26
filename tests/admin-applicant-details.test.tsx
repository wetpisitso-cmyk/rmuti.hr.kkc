import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminApplicantDetails } from "../src/components/AdminApplicantDetails";
import type { Personal } from "../src/types/models";

const person: Personal = {
  prefix: "นางสาว",
  first_name: "ทดสอบ",
  last_name: "ระบบ",
  english_name: "TEST APPLICANT",
  gender: "หญิง",
  nationality: "ไทย",
  marital_status: "โสด",
  registered_address: "99 ถนนทดสอบ ขอนแก่น",
  address: "88 ถนนปัจจุบัน",
  birth_date: "1999-02-23",
  phone: "0800000000",
  national_id: "",
  line_id: "",
};

describe("Admin review applicant details", () => {
  it("displays the required new fields and retained PDF data", () => {
    const html = renderToStaticMarkup(<AdminApplicantDetails person={person} email="example@example.invalid" />);
    for (const value of ["TEST APPLICANT", "หญิง", "ไทย", "โสด", "99 ถนนทดสอบ", "example@example.invalid"]) {
      expect(html).toContain(value);
    }
    expect(html).not.toContain("ไม่พบข้อมูลบางช่อง");
  });
  it("indicates absent fields on applications created before the new form", () => {
    const html = renderToStaticMarkup(<AdminApplicantDetails
      person={{ ...person, english_name: undefined, gender: undefined,
        nationality: undefined, marital_status: undefined, registered_address: undefined }}
    />);
    expect(html).toContain("ไม่ได้ระบุในใบสมัครเดิม");
    expect(html).toContain("ไม่พบข้อมูลบางช่อง");
  });
});
