import { it, expect } from "vitest";
import { sniff } from "../supabase/functions/_shared/file-validation";
it("recognizes PDF magic bytes", () =>
  expect(sniff(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf"));
it("recognizes JPG magic bytes", () =>
  expect(sniff(new Uint8Array([255, 216, 255, 224]))).toBe("image/jpeg"));
it("recognizes PNG magic bytes", () =>
  expect(sniff(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
    "image/png",
  ));
it("rejects executable content and empty files", () => {
  expect(
    sniff(new TextEncoder().encode("<script>alert(1)</script>")),
  ).toBeNull();
  expect(sniff(new Uint8Array())).toBeNull();
});
