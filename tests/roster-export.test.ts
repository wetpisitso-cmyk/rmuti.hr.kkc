import { describe, expect, it } from "vitest";
import { rosterLines, rosterSheetXml, rosterFilename, buildRosterXlsx } from "../src/lib/roster-export";
import type { StaffRow } from "../src/types/models";

const meta = {
  jobTitle: "เจ้าหน้าที่บริหารงานทั่วไป",
  department: "สำนักงานวิทยาเขตขอนแก่น",
  round: "รอบตุลาคม",
  yearBE: 2569,
  generatedAt: "2026-10-27T01:00:00Z",
};
const record = (firstName: string, number: string | null): StaffRow => ({
  id: number || "unassigned",
  status: "submitted",
  payment_status: "awaiting_payment",
  application_number: number,
  personal_data: { prefix: "นางสาว", first_name: firstName, last_name: "ทดสอบ", birth_date: "", phone: "", address: "" },
  created_at: "2026-10-27T00:00:00Z",
  submitted_at: "2026-10-27T00:00:00Z",
  job_title: meta.jobTitle,
  department_name: meta.department,
  round_name: meta.round,
  year_be: 2569,
});
describe("recruitment applicant roster", () => {
  it("includes only allowed fields and preserves UTF-8 Thai", () => {
    const rows = rosterLines([record("หนึ่งทอง", null)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toContain("หนึ่งทอง");
    expect(rows[0].applicationNumber).toBe("รอออกเลข");
    expect(Object.keys(rows[0])).toEqual(["order", "applicationNumber", "name", "status", "payment", "submitted"]);
  });
  it("generates XML-escaped inline strings instead of spreadsheet formulas", () => {
    const lines = rosterLines([record("=HYPERLINK(\"https://example.com\") & <test>", "0099")]);
    const xml = rosterSheetXml(lines, meta);
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&lt;test&gt;");
    expect(xml).not.toContain("<f>");
    expect(xml).toContain('t="inlineStr"');
    expect(xml).toContain("0099");
  });
  it("produces valid ZIP header and Excel MIME type", async () => {
    const blob = buildRosterXlsx(rosterLines([record("หนึ่งทอง", "0100")]), meta);
    expect(blob.type).toContain("spreadsheetml.sheet");
    const arr = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(arr.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(arr.length).toBeGreaterThan(2000);
  });
  it("sanitizes unsafe filenames and correctly marks extension", () => {
    expect(rosterFilename({ ...meta, jobTitle: "เลข/ชื่อ:*" }, "xlsx")).not.toContain("/");
    expect(rosterFilename(meta, "pdf")).toMatch(/\.pdf$/);
  });
});
