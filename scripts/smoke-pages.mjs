// Public-only GitHub Pages smoke test: never accesses applicant data.
const url = process.env.PUBLIC_PAGE_URL || "https://wetpisitso-cmyk.github.io/rmuti.hr.kkc/";
const sha = process.env.GITHUB_SHA || "manual";
let failure = "";
for (let attempt = 1; attempt <= 6; attempt++) {
  try {
    const page = new URL(url);
    page.searchParams.set("deploy_check", sha);
    const response = await fetch(page, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error("Home page HTTP " + response.status);
    const html = await response.text();
    if (!html.includes('id="root"') || !html.includes("รับสมัครบุคลากร"))
      throw new Error("Missing expected application root/title in deployed HTML");
    const js = html.match(/<script\b[^>]*\bsrc="([^"]+\.js)"[^>]*>/);
    if (!js) throw new Error("No bundled JavaScript tag in deployed HTML");
    const assetUrl = new URL(js[1],page);
    if (assetUrl.origin !== page.origin) throw new Error("JS asset origin differs from page origin");
    const asset = await fetch(assetUrl, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!asset.ok) throw new Error("Bundle HTTP " + asset.status);
    const body = await asset.text();
    if (body.length < 1000) throw new Error("Bundle is unexpectedly empty");
    console.log("GitHub Pages smoke check passed", { page: page.origin + page.pathname, bundle: assetUrl.pathname, length: body.length });
    process.exit(0);
  } catch (e) {
    failure = e instanceof Error ? e.message : String(e);
    console.warn("Attempt", attempt, "failed:",failure);
    if (attempt < 6) await new Promise(resolve => setTimeout(resolve,10000));
  }
}
console.error("Deployed website smoke check failed:", failure);
process.exit(1);
