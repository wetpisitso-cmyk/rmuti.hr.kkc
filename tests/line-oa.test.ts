import { describe, expect, it } from "vitest";
import { getLineOAUrl } from "../src/lib/line-oa";

describe("official LINE OA add-friend URL", () => {
  it("uses the official contact link", () => {
    expect(getLineOAUrl("https://lin.ee/WDP0knw")).toBe("https://lin.ee/WDP0knw");
  });
  it("accepts surrounding whitespace", () => {
    expect(getLineOAUrl("  https://lin.ee/WDP0knw  ")).toBe("https://lin.ee/WDP0knw");
  });
  it("hides the CTA if not configured", () => {
    expect(getLineOAUrl("")).toBeNull();
    expect(getLineOAUrl(null)).toBeNull();
    expect(getLineOAUrl({url:"https://lin.ee/WDP0knw"})).toBeNull();
  });
  it("rejects unsafe or misleading URLs", () => {
    for (const value of [
      "javascript:alert(1)",
      "http://lin.ee/WDP0knw",
      "https://lin.ee.attacker.example/WDP0knw",
      "https://lin.ee@attacker.example/WDP0knw",
      "https://attacker.example/lin.ee/WDP0knw",
      "https://lin.ee/",
      "https://lin.ee/WDP0knw?redirect=evil",
      "https://lin.ee/WDP0knw#redirect",
    ]) expect(getLineOAUrl(value)).toBeNull();
  });
});
