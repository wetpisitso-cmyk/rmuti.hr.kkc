import { describe, expect, it } from "vitest";
import {
  applicantOrderNumber, applicantOrderLabel, sortSlipsByApplicantOrder,
  type SequencedApplicant,
} from "../src/lib/payment-slip-order";

const applicants = new Map<string, SequencedApplicant>([
  ["uuid-z", {id:"uuid-z",display_position_order:1,position_order:3,submitted_at:"2026-11-02T07:00:00Z"}],
  ["uuid-a", {id:"uuid-a",display_position_order:2,position_order:4,submitted_at:"2026-11-02T08:00:00Z"}],
  ["uuid-b", {id:"uuid-b",display_position_order:3,position_order:5,submitted_at:"2026-11-02T09:00:00Z"}],
]);

describe("payment slip applicant sequence", () => {
  it("sorts by active displayed position order and not UUID or official number", () => {
    const slips = [
      {id:"s3",application_id:"uuid-b",paid_at:null},
      {id:"s2",application_id:"uuid-a",paid_at:null},
      {id:"s1",application_id:"uuid-z",paid_at:null},
    ];
    expect(sortSlipsByApplicantOrder(slips, applicants).map(s=>s.id)).toEqual(["s1","s2","s3"]);
    expect(slips[0].id).toBe("s3"); // Does not mutate caller data.
    expect(applicantOrderLabel(applicants.get("uuid-z"))).toBe("(1)");
  });

  it("keeps repeat payments for an applicant together in chronological order", () => {
    const slips = [
      {id:"b",application_id:"uuid-z",paid_at:"2026-11-02T11:00:00Z"},
      {id:"c",application_id:"uuid-a",paid_at:"2026-11-02T07:00:00Z"},
      {id:"a",application_id:"uuid-z",paid_at:"2026-11-02T10:00:00Z"},
    ];
    expect(sortSlipsByApplicantOrder(slips, applicants).map(s=>s.id)).toEqual(["a","b","c"]);
  });

  it("falls back to immutable submission order on older applications", () => {
    expect(applicantOrderNumber({id:"legacy",position_order:7})).toBe(7);
    expect(applicantOrderLabel({id:"legacy",position_order:7})).toBe("(7)");
    expect(applicantOrderLabel({id:"none"})).toBe("(ไม่ระบุลำดับ)");
  });

  it("is deterministic when numbers are absent", () => {
    const missing = new Map([
      ["a",{id:"a",submitted_at:"2026-11-02T05:00:00Z"}],
      ["b",{id:"b",submitted_at:"2026-11-02T04:00:00Z"}],
    ]);
    const items=[{id:"a1",application_id:"a"},{id:"b1",application_id:"b"}];
    expect(sortSlipsByApplicantOrder(items,missing).map(s=>s.id)).toEqual(["b1","a1"]);
  });
});
