import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

describe("RMUTI KKC official crest icon metadata", () => {
  const html = readFileSync("index.html", "utf8");
  const manifest = JSON.parse(readFileSync("public/site.webmanifest", "utf8")) as {
    name: string;
    short_name: string;
    start_url: string;
    scope: string;
    icons: Array<{src:string;sizes:string;type:string}>;
  };

  it("references square icons generated from the existing official crest", () => {
    expect(existsSync("public/logo.png")).toBe(true);
    expect(existsSync("scripts/generate-site-icons.py")).toBe(true);
    expect(html).toContain('sizes="16x16" href="%BASE_URL%rmuti-crest-16.png?v=2"');
    expect(html).toContain('sizes="32x32" href="%BASE_URL%rmuti-crest-32.png?v=2"');
    expect(html).not.toContain('href="%BASE_URL%favicon.svg"');
    expect(html).not.toContain('rel="icon" type="image/png" href="%BASE_URL%logo.png');
  });
  it("supports Apple devices and old Windows favicon paths", () => {
    expect(html).toContain('rel="shortcut icon" href="%BASE_URL%favicon.ico?v=2"');
    expect(html).toContain('rel="apple-touch-icon" sizes="180x180" href="%BASE_URL%rmuti-crest-180.png?v=2"');
    expect(html).toContain("<title>มทร.ขอนแก่น | ระบบรับสมัครบุคลากรออนไลน์</title>");
  });
  it("keeps Android manifest icons relative to GitHub Pages subpath", () => {
    expect(manifest.short_name).toBe("มทร.ขอนแก่น");
    expect(manifest.start_url).toBe("./");
    expect(manifest.scope).toBe("./");
    expect(manifest.icons).toEqual([
      {src:"rmuti-crest-192.png?v=2",sizes:"192x192",type:"image/png",purpose:"any"},
      {src:"rmuti-crest-512.png?v=2",sizes:"512x512",type:"image/png",purpose:"any"},
    ]);
  });
});
