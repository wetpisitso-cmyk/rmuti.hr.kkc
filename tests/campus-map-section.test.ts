import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

describe("Home campus map section", () => {
  const page = readFileSync("src/pages/Public.tsx", "utf8");
  const component = readFileSync("src/components/CampusMap.tsx", "utf8");
  const styles = readFileSync("src/campus-map.css", "utf8");
  it("places the campus map below applying steps and above the footer", () => {
    const home = page.slice(page.indexOf("export function Home()"), page.indexOf("export function JobDetail()"));
    expect(home.indexOf("<CampusMap />")).toBeGreaterThan(home.indexOf('className="home-steps-section'));
    expect(styles).toContain("order: 6;");
  });
  it("keeps the original image inside the public assets and preserves its aspect ratio", () => {
    expect(existsSync("public/campus-map-kkc.png")).toBe(true);
    expect(component).toContain("campus-map-kkc.png");
    expect(styles).toContain("object-fit: contain");
  });
  it("allows an accessible enlarged view and opening the original file", () => {
    expect(component).toContain('role="dialog"');
    expect(component).toContain('aria-modal="true"');
    expect(component).toContain('key === "Escape"');
    expect(component).toContain("campus-map-open-original");
  });
});
