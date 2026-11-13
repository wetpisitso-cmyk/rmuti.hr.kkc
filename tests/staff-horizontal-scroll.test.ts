import { describe, expect, it, vi } from "vitest";
import { resetPageHorizontalScroll } from "../src/lib/layout-scroll";

describe("staff dashboard horizontal scroll reset", () => {
  it("returns to the left edge but preserves vertical scroll", () => {
    const scrollTo = vi.fn();
    resetPageHorizontalScroll({ scrollX: 320, scrollY: 840, scrollTo });
    expect(scrollTo).toHaveBeenCalledOnce();
    expect(scrollTo).toHaveBeenCalledWith(0, 840);
  });
  it("does not move a page that is already left-aligned", () => {
    const scrollTo = vi.fn();
    resetPageHorizontalScroll({ scrollX: 0, scrollY: 840, scrollTo });
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
