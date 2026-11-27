import type { Education } from "../types/models";
import type { DocRequirement } from "../types/models";

export const EDUCATION_LEVELS = ["มัธยมศึกษาตอนปลาย","ปวช.","ปวส.","ปริญญาตรี","ปริญญาโท","ปริญญาเอก"] as const;

export function requiredEducationIssue(rows: Education[], levels: string[]): string | null {
  if (!levels.length) return null;
  if (rows.length !== levels.length || levels.some(level => !rows.some(row =>
    row.education_level === level && row.degree.trim() && row.major.trim() && row.institution.trim()
    && String(row.graduation_year ?? "").trim() && String(row.gpa ?? "").trim()
  ))) return "กรุณากรอกข้อมูลการศึกษาให้ครบทุกคุณวุฒิที่กำหนด: " + levels.join(" / ");
  return null;
}

// Keep data for matching levels; unclassified entries can be reviewed in the new slots.
export function alignEducation(rows: Education[], levels: string[]): Education[] {
  if (!levels.length) return rows;
  const remaining = rows.filter(row => !row.education_level || !levels.includes(row.education_level));
  return levels.map(level => ({
    ...(rows.find(row => row.education_level === level) ?? remaining.shift() ??
      { degree: "", major: "", institution: "", graduation_year: "", gpa: "" }),
    education_level: level,
  }));
}

export function educationDocuments(docs: DocRequirement[], levels: string[]): DocRequirement[] {
  if (!levels.length) return docs;
  const other = docs.filter(d => !/^(degree|transcript)(_[123])?$/.test(d.key));
  return [...other, ...levels.flatMap((level, i) => [
    { key: i === 0 ? "degree" : "degree_" + (i + 1), label: "หลักฐานคุณวุฒิ — " + level, required: true },
    { key: i === 0 ? "transcript" : "transcript_" + (i + 1), label: "ใบรายงานผลการศึกษา — " + level, required: true },
  ])];
}
