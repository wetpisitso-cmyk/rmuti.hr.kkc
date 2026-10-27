import { describe, expect, it } from "vitest";
import { EXAM_CARD_FONT_FAMILY, examCardFont } from "../src/lib/exam-card-font";
describe("exam card official Thai font",()=>{
 it("uses Sarabun for normal and bold exam card text",()=>{
  expect(EXAM_CARD_FONT_FAMILY).toBe("Sarabun");
  expect(examCardFont(29)).toBe('400 29px "Sarabun", sans-serif');
  expect(examCardFont(29,true)).toBe('700 29px "Sarabun", sans-serif');
 });
});