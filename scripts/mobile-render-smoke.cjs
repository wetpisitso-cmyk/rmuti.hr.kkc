/* Public-page mobile rendering smoke tests for the published site.
 * No credentials, applicant data, test account, or backend mutation.
 * Run: npm install --no-save --package-lock=false playwright@1.58.2
 *      npx playwright install chromium webkit
 *      node scripts/mobile-render-smoke.cjs
 */
const { chromium, webkit, devices } = require("playwright");
const SITE = "https://wetpisitso-cmyk.github.io/rmuti.hr.kkc/";
const ROUTES = [
  { hash: "#/", marker: "มหาวิทยาลัย" },
  { hash: "#/login", marker: "เข้าสู่ระบบ" },
  { hash: "#/register", marker: "สมัครสมาชิก" },
  { hash: "#/results", marker: "ผล" },
];
(async () => {
  let failed = false;
  for (const [engine, type] of [["Chromium", chromium], ["WebKit", webkit]]) {
    const browser = await type.launch({ headless: true });
    try {
      const context = await browser.newContext({
        ...devices["iPhone 13"],
        locale: "th-TH",
      });
      for (const { hash, marker } of ROUTES) {
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", e => errors.push("RENDER_EXCEPTION " + e.name + " " + String(e.message).slice(0, 180)));
        try {
          const target = SITE + "?mobile_smoke=1" + hash;
          const response = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(1200);
          // Browser integration: validate registration typo and matching-email
          // controls, without submitting forms or creating real user accounts.
          if (hash === "#/register") {
            const emailInput = page.locator('input[name="email"]');
            const confirmInput = page.locator('input[name="confirm_email"]');
            if (await emailInput.count() !== 1 || await confirmInput.count() !== 1) {
              throw new Error("Missing registration email confirmation fields");
            }
            await emailInput.fill("browser-smoke@gamil.com");
            const tip = page.getByText(/โดเมนอีเมลอาจพิมพ์ผิด/);
            if (!(await tip.isVisible())) {
              throw new Error("Misspelled-email warning not shown");
            }
            await emailInput.fill("browser-smoke@gmail.com");
            if (await tip.isVisible()) {
              throw new Error("Email typo warning persisted after correction");
            }
            // No click on Submit; real accounts are never created.
          }
          const content = (await page.locator("body").innerText()).slice(0, 12000);
          const unexpected = content.includes("APP_RENDER") || content.includes("ASSET_UPDATE") || content.includes("ไม่สามารถแสดงหน้านี้ได้") || content.includes("ยังไม่ได้ตั้งค่าการเชื่อมต่อ");
          if (!response || response.status() >= 400 || !content.includes(marker) || unexpected || errors.length) {
            failed = true;
            console.error("FAIL", engine, hash, "http", response?.status(), "marker", content.includes(marker), "boundary", unexpected, errors.join("; "), "excerpt", JSON.stringify(content.slice(0, 240)));
          } else {
            console.log("PASS", engine, hash, "http", response.status());
          }
        } catch (e) {
          failed = true;
          console.error("FAIL", engine, hash, "NAVIGATION", String(e.message).slice(0, 240));
        } finally {
          await page.close();
        }
      }
      await context.close();
    } finally {
      await browser.close();
    }
  }
  if (failed) process.exitCode = 1;
})().catch(e => { console.error("MOBILE_SMOKE_FATAL", String(e.message)); process.exitCode = 1; });
