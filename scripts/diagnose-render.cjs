const { chromium, webkit, devices } = require("playwright");
const target = "https://wetpisitso-cmyk.github.io/rmuti.hr.kkc/";
(async () => {
  for (const [engine, type] of [["Chromium", chromium], ["WebKit", webkit]]) {
    const browser = await type.launch({ headless: true });
    try {
      const context = await browser.newContext({ ...devices["iPhone 13"] });
      for (const hash of ["#/", "#/login", "#/results"]) {
        const page = await context.newPage();
        console.log("CHECK", engine, hash);
        page.on("pageerror", e => console.log("PAGE_ERROR", engine, hash, e.name, e.message, (e.stack || "").slice(0, 900)));
        page.on("console", m => {
          if (m.type() === "error") console.log("CONSOLE_ERROR", engine, hash, m.text().slice(0, 1100));
        });
        page.on("response", response => {
          if (response.status() >= 400) {
            try {
              const u = new URL(response.url());
              console.log("HTTP_ERROR", engine, hash, response.status(), u.origin + u.pathname);
            } catch {}
          }
        });
        try {
          const response = await page.goto(target + "?smoke=" + Date.now() + hash, { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForTimeout(7500);
          const body = (await page.locator("body").innerText()).slice(0, 900);
          console.log("RESULT", engine, hash, "status", response?.status(), "body", JSON.stringify(body));
        } catch (e) {
          console.log("NAV_ERROR", engine, hash, e.message);
        }
        await page.close();
      }
      await context.close();
    } finally {
      await browser.close();
    }
  }
})().catch(err => { console.error("FATAL", err); process.exitCode = 1; });
