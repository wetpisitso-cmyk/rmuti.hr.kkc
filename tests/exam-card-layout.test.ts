import { describe, expect, it } from "vitest";
import { layoutExamCardFields, wrapCardText } from "../src/lib/exam-card-layout";
const length = (t:string,px:number) => Array.from(t).length*px*.85;
describe("A4 exam card Thai layout",()=>{
 it("keeps a long Thai exam number below its own label rather than beside it",()=>{
  const layout=layoutExamCardFields({
   examNumber:"เจ้าหน้าที่บริหารงานทั่วไป.คบท./2569/40/101",
   name:"นางสาว อรอุมา ใสมาบุตร",
   jobTitle:"เจ้าหน้าที่บริหารงานทั่วไป",
   department:"คณะบริหารธุรกิจและเทคโนโลยีสารสนเทศ",
  },length);
  expect(layout.fields).toHaveLength(4);
  expect(layout.fields[0].valueYs[0]).toBeGreaterThan(layout.fields[0].labelY);
  expect(layout.fields[0].lines.join("")).toContain("2569/40/101");
  expect(layout.fields[1].valueYs[0]).toBeLessThan(640);
  expect(layout.fields[2].labelY).toBeGreaterThan(640);
  expect(layout.lastValueY).toBeLessThanOrEqual(984);
 });
 it("wraps a very long Thai department rather than dropping words",()=>{
  const title="สังกัดคณะบริหารธุรกิจและเทคโนโลยีสารสนเทศ สาขาวิชาที่มีชื่อยาวมากสำหรับการจัดสอบ";
  const chunks=wrapCardText(title,280,t=>Array.from(t).length*12);
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.join("").replace(/\s+/g,"")).toBe(title.replace(/\s+/g,""));
  expect(chunks.every(x=>Array.from(x).length*12<=280)).toBe(true);
 });
 it("throws instead of rendering a card beyond the signature area",()=>{
  expect(()=>layoutExamCardFields({
   examNumber:"ก".repeat(500),
   name:"ข".repeat(500),
   jobTitle:"ค".repeat(500),
   department:"ง".repeat(500),
  },length)).toThrow("CARD_TEXT_OVERFLOW");
 });
});