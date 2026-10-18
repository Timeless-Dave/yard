// Smoke-tests a deployed copy of the site the way a visitor would:
//   node tests/e2e/live-smoke.mjs https://timeless-dave.github.io/yard/
import { mkdir } from "node:fs/promises";
import { chromium, devices } from "playwright";

const URL = process.argv[2];
if (!URL) {
  console.error("Usage: node tests/e2e/live-smoke.mjs <url>");
  process.exit(1);
}
const SHOTS = "test-results/live";
await mkdir(SHOTS, { recursive: true });

let failures = 0;
async function check(label, fn) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
  } catch (e) {
    failures++;
    console.log(`  ✗ ${label}\n      ${e.message.split("\n")[0]}`);
  }
}

const browser = await chromium.launch();
for (const [label, options] of [
  ["desktop", { viewport: { width: 1280, height: 800 } }],
  ["iPhone 14", devices["iPhone 14"]],
]) {
  console.log(label);
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  const failedRequests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("response", (r) => r.status() >= 400 && failedRequests.push(`${r.status()} ${r.url()}`));

  await check("loads and shows onboarding", async () => {
    const res = await page.goto(URL, { waitUntil: "load" });
    if (!res.ok()) throw new Error(`HTTP ${res.status()}`);
    await page.locator('text="Let\'s go!"').waitFor({ timeout: 20000 });
  });
  await check("every asset loads (no 4xx/5xx — base path is right)", async () => {
    if (failedRequests.length) throw new Error(failedRequests.join(", "));
  });
  await check("3D scene renders into a canvas", async () => {
    await page.locator('text="Let\'s go!"').click();
    const size = await page.locator("canvas").first().boundingBox();
    if (!size || size.width < 300) throw new Error("no rendered canvas");
  });
  await check("a minigame opens", async () => {
    await page.locator('[data-modal="achievements"]').first().click();
    await page.locator(".modal", { hasText: "Homecoming Checklist" }).waitFor({ timeout: 10000 });
    await page.screenshot({ path: `${SHOTS}/${label.replace(/\s+/g, "-").toLowerCase()}.png` });
    await page.locator(".modal .close").first().click();
  });
  await check("PWA: manifest resolves with icons, service worker registers", async () => {
    const result = await page.evaluate(async () => {
      const href = document.querySelector('link[rel="manifest"]').href;
      const manifest = await (await fetch(href)).json();
      const icons = await Promise.all(manifest.icons.map((i) => fetch(new URL(i.src, href)).then((r) => r.status)));
      const reg = await navigator.serviceWorker.ready;
      return { icons, scope: reg.scope, start: new URL(manifest.start_url, href).href };
    });
    if (result.icons.some((s) => s !== 200)) throw new Error(`icon statuses ${result.icons}`);
    if (!result.scope.startsWith(URL)) throw new Error(`service worker scope ${result.scope}`);
  });
  await check("no console or page errors", async () => {
    if (errors.length) throw new Error(errors.join(" | "));
  });
  await context.close();
}
await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
