import { describe, expect, it } from "vitest";
import { safeClientError } from "../src/lib/client-diagnostics";

describe("safeClientError", () => {
  it("preserves a useful property-access failure without exposing URLs", () => {
    expect(safeClientError(new TypeError("Cannot read properties of undefined (reading 'name')"))).toContain("reading 'name'");
    expect(safeClientError(new Error("Failed at https://example.com/account?id=1"))).not.toContain("example.com");
  });
  it("redacts personal identifiers and tokens", () => {
    const message = "For user test@example.org 1234567890123 token " + "a".repeat(52);
    const text = safeClientError(new Error(message));
    expect(text).not.toContain("test@example.org");
    expect(text).not.toContain("1234567890123");
    expect(text).not.toContain("a".repeat(52));
  });
});
