import { describe, expect, it } from "vitest";
import { alignEducation, requiredEducationIssue, educationDocuments } from "../src/lib/required-education";
const row = { degree: "วุฒิตัวอย่าง", major: "สาขา", institution: "มหาวิทยาลัย", graduation_year: "2569", gpa: "0" };
const levels = ["ปริญญาตรี", "ปริญญาโท", "ปริญญาเอก"];
describe("required education", () => {
  it("leaves legacy jobs unchanged", () => {
    expect(alignEducation([row], [])).toEqual([row]);
    expect(requiredEducationIssue([row], [])).toBeNull();
  });
  it("creates fixed slots and rejects incomplete and duplicate levels", () => {
    const aligned = alignEducation([row], levels);
    expect(aligned.map(r => r.education_level)).toEqual(levels);
    expect(requiredEducationIssue(aligned, levels)).not.toBeNull();
    const complete = levels.map(education_level => ({ ...row, education_level }));
    expect(requiredEducationIssue(complete, levels)).toBeNull();
    expect(requiredEducationIssue([complete[0], complete[0], complete[2]], levels)).not.toBeNull();
    expect(requiredEducationIssue(complete.slice(0,2), levels)).not.toBeNull();
  });
  it("preserves the degree data by level across unordered DB rows", () => {
    const complete = levels.map(education_level => ({ ...row, degree: education_level, education_level }));
    expect(alignEducation([...complete].reverse(), levels)).toEqual(complete);
  });
  it("requires separate documents without duplicate keys", () => {
    const docs = educationDocuments([{key:"photo",label:"รูป",required:true},{key:"degree",label:"เดิม",required:false}], levels);
    expect(docs.map(d => d.key)).toEqual(["photo","degree","transcript","degree_2","transcript_2","degree_3","transcript_3"]);
    expect(docs.every(d=>d.required)).toBe(true);
  });
});
