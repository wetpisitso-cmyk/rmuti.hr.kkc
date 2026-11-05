import { describe, expect, it } from "vitest";
import { visibleNotifications } from "../src/lib/notification-inbox";

describe("applicant notification inbox", () => {
  const rows = [
    { id:"older-read", read_at:"2026-11-03T00:00:00Z", created_at:"2026-11-03T00:00:00Z" },
    { id:"newer-read", read_at:"2026-11-05T00:00:00Z", created_at:"2026-11-05T00:00:00Z" },
    { id:"unread-older", read_at:null, created_at:"2026-11-02T00:00:00Z" },
    { id:"unread-new", read_at:null, created_at:"2026-11-04T00:00:00Z" },
  ];
  it("prioritizes unread first and then newest for all", () => {
    expect(visibleNotifications(rows,"all").map(x=>x.id)).toEqual([
      "unread-new","unread-older","newer-read","older-read",
    ]);
  });
  it("shows only unread notices under the unread filter", () => {
    expect(visibleNotifications(rows,"unread").map(x=>x.id)).toEqual(["unread-new","unread-older"]);
  });
  it("preserves the cached query order", () => {
    const before = rows.map(x=>x.id);
    visibleNotifications(rows,"all");
    expect(rows.map(x=>x.id)).toEqual(before);
  });
  it("handles an empty inbox", () => {
    expect(visibleNotifications([],"unread")).toEqual([]);
  });
});
