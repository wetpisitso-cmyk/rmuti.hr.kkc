import { describe, expect, it } from "vitest";
import { staffQueueView } from "../src/lib/staff-application-view";
describe("staff application queue views", () => {
  it("keeps only open deadlines and pending work on the review screen", () => {
    expect(staffQueueView(true, false)).toBe("open_pending");
  });
  it("routes completed or closed-deadline submissions to the records list", () => {
    expect(staffQueueView(true, true)).toBe("records");
  });
  it("does not filter the existing overview or reporting screens", () => {
    expect(staffQueueView(false, false)).toBeUndefined();
    expect(staffQueueView(false, true)).toBeUndefined();
  });
});
