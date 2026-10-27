import { describe,expect,it } from "vitest";
import { EXAM_CARD_INSTRUCTIONS } from "../src/lib/exam-card-pdf";
describe("exam admission card official notices",()=>{
 it("preserves the two exact rules for examination access",()=>{
  expect(EXAM_CARD_INSTRUCTIONS).toHaveLength(2);
  expect(EXAM_CARD_INSTRUCTIONS[0]).toContain("ทุกครั้งที่เข้าสอบข้อเขียน สอบปฏิบัติ");
  expect(EXAM_CARD_INSTRUCTIONS[0]).toContain("อาจไม่ได้รับอนุญาต");
  expect(EXAM_CARD_INSTRUCTIONS[1]).toContain("ผู้กระทำการทุจริต");
  expect(EXAM_CARD_INSTRUCTIONS[1]).toContain("เป็นผู้ขาดคุณสมบัติที่จะจัดจ้าง");
 });
});