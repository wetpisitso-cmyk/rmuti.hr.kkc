import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

describe("RMUTI KKC browser and mobile icon metadata", () => {
  const html = readFileSync("index.html", "utf8");
  const manifest = JSON.parse(readFileSync("public/site.webmanifest", "utf8")) as {
    name: string; short_name: string; scope: string; start_url: string;
    icons: Array<{ src: string; type: string }>;
  };

  it("uses the official university crest instead of the old generic SVG favicon", () => {
    expect(existsSync("public/logo.png")).toBe(true);
    expect(html).toContain('rel="icon" type="image/png" href="%BASE_URL%logo.png');
    expect(html).not.toContain('href="%BASE_URL%favicon.svg"');
  });
  it("provides Apple touch and browser shortcut metadata", () => {
    expect(html).toContain('rel="apple-touch-icon" href="%BASE_URL%logo.png');
    expect(html).toContain('rel="manifest" href="%BASE_URL%site.webmanifest"');
    expect(html).toContain("<title>มทร.ขอนแก่น | ระบบรับสมัครบุคลากรออนไลน์</title>");
    expect(html).toContain('name="apple-mobile-web-app-title"');
  });
  it("uses relative manifest paths that work with GitHub Pages subdirectories", () => {
    expect(manifest.short_name).toBe("มทร.ขอนแก่น");
    expect(manifest.start_url).toBe("./");
    expect(manifest.scope).toBe("./");
    expect(manifest.icons[0]).toMatchObject({type:"image/png"});
    expect(manifest.icons[0].src).toMatch(/^logo\.png/);
  });
});
