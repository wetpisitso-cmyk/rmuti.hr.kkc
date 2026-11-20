import { describe, expect, it } from "vitest";
import { documentConfigurationError, nextUnusedDocumentOption } from "../src/lib/job-document-config";

const options: [string,string][] = [
  ["degree", "หนังสือรับรองคุณวุฒิ / ปริญญาบัตร"],
  ["transcript", "ใบรายงานผลการศึกษา"],
  ["other", "เอกสารอื่น ๆ"],
];

describe("job position document configuration", () => {
  it("accepts a single degree document regardless of the degrees supported by the job", () => {
    expect(documentConfigurationError([{ key: "degree", label: options[0][1], required: true }])).toBeNull();
  });
  it("blocks duplicate keys before the admin save RPC", () => {
    expect(documentConfigurationError([
      { key: "degree", label: "ปริญญาตรี" },
      { key: "degree", label: "ปวส." },
    ])).toMatch(/ซ้ำ/);
  });
  it("picks the next unused document type instead of duplicating other", () => {
    expect(nextUnusedDocumentOption([
      { key: "degree", label: "degree" },
      { key: "other", label: "other" },
    ], options)).toEqual(options[1]);
  });
  it("returns undefined once every type has been used", () => {
    expect(nextUnusedDocumentOption(options.map(([key,label])=>({key,label})), options)).toBeUndefined();
  });
});
