import { describe, it, expect } from "vitest";
import { educationIssue } from "../src/validation/forms";

const base = { degree: "ปริญญาตรี", major: "วิศวกรรม", institution: "มหาวิทยาลัย", graduation_year: "2568", gpa: "3.25" };
describe("application education validation", () => {
  it("accepts GPA between zero and four", () => {
    expect(educationIssue([base])).toBeNull();
    expect(educationIssue([{...base,gpa:"0"}])).toBeNull();
    expect(educationIssue([{...base,gpa:"4"}])).toBeNull();
  });
  it("rejects invalid GPA before sending to database", () => {
    expect(educationIssue([{...base,gpa:"4.5"}])).toContain("GPA");
    expect(educationIssue([{...base,gpa:"-1"}])).toContain("GPA");
    expect(educationIssue([{...base,gpa:"abc"}])).toContain("GPA");
  });
  it("checks the Buddhist calendar graduation year", () => {
    expect(educationIssue([{...base,graduation_year:"2026"}])).toContain("พ.ศ.");
  });
  it("requires education identity fields", () => {
    expect(educationIssue([{...base,major:""}])).toContain("สาขาวิชา");
  });
});
