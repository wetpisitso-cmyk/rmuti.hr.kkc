import { describe, it, expect } from "vitest";
import { parseRecovery } from "../src/lib/recovery";
describe("password recovery before HashRouter", () => {
  it("extracts recovery tokens from the root fragment", () => {
    const p = parseRecovery(
      "https://example.github.io/repo/?auth=recovery#access_token=a&refresh_token=b&type=recovery",
    );
    expect(p).toMatchObject({
      access: "a",
      refresh: "b",
      recovery: true,
      error: null,
    });
  });
  it("leaves application routes alone", () => {
    expect(
      parseRecovery("https://example.github.io/repo/#/application/123").access,
    ).toBeNull();
  });
  it("supports a PKCE code in query without treating it as a route", () => {
    expect(
      parseRecovery("https://example.github.io/repo/?code=test&auth=recovery")
        .code,
    ).toBe("test");
  });
  it("recognizes expired reset links", () => {
    expect(
      parseRecovery(
        "https://example.github.io/repo/#error=access_denied&error_description=Expired+link",
      ).error,
    ).toBe("Expired link");
  });
});
