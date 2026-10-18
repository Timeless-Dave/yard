// Phone check: the real app on emulated phones (touch, mobile viewport),
// single-player. Run via `npm run test:mobile`.
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium, devices } from "playwright";

const PORT = 5198;
const URL = `http://127.0.0.1:${PORT}/`;
const SHOTS = "test-results/mobile";
const PHONES = ["iPhone 14", "Pixel 7"];

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
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

await mkdir(SHOTS, { recursive: true });
const server = await createServer({ server: { port: PORT, strictPort: true, host: "127.0.0.1" }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch();

try {
  for (const phone of PHONES) {
    console.log(phone);
    const context = await browser.newContext({ ...devices[phone] });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const slug = phone.replace(/\s+/g, "-").toLowerCase();
    const vw = devices[phone].viewport.width;
    const vh = devices[phone].viewport.height;

    await page.goto(URL);

    await check("onboarding fits the screen and dismisses with a tap", async () => {
      const box = await page.locator(".modal").first().boundingBox({ timeout: 20000 });
      assert(box.x >= 0 && box.x + box.width <= vw, `modal is ${box.width}px wide on a ${vw}px screen`);
      await page.screenshot({ path: `${SHOTS}/${slug}-onboarding.png` });
      await page.locator('text="Let\'s go!"').tap();
      await page.locator(".modal-backdrop").waitFor({ state: "detached", timeout: 20000 });
    });

    await check("no horizontal page scroll; the chip row scrolls on its own", async () => {
      const { page: pageW, row, rowScroll } = await page.evaluate(() => {
        const r = document.querySelector(".chip-row");
        return { page: document.documentElement.scrollWidth, row: r.clientWidth, rowScroll: r.scrollWidth };
      });
      assert(pageW <= vw, `page is ${pageW}px wide on a ${vw}px screen`);
      assert(rowScroll > row, "expected the chip row to be horizontally scrollable on a phone");
    });

    await check("touch D-pad and interact button are on screen", async () => {
      for (const sel of ['.touch-btn[data-key="w"]', '.touch-btn[data-key="a"]', "#touch-interact"]) {
        const box = await page.locator(sel).boundingBox();
        assert(box && box.y + box.height <= vh && box.x >= 0 && box.x + box.width <= vw, `${sel} is off-screen`);
      }
    });
    await page.screenshot({ path: `${SHOTS}/${slug}-yard.png` });

    await check("holding ↑ on the D-pad walks the avatar to an interaction spot", async () => {
      const up = page.locator('.touch-btn[data-key="w"]');
      await up.dispatchEvent("pointerdown");
      await page.locator(".interact-prompt").waitFor({ state: "visible", timeout: 20000 });
      await up.dispatchEvent("pointerup");
    });

    await check("tapping the interact button opens that spot's modal, which fits and closes", async () => {
      await page.locator("#touch-interact").dispatchEvent("pointerdown");
      const modal = page.locator(".modal").first();
      const box = await modal.boundingBox({ timeout: 20000 });
      assert(box.x >= 0 && box.x + box.width <= vw && box.height <= vh, `modal ${Math.round(box.width)}x${Math.round(box.height)} overflows ${vw}x${vh}`);
      await page.screenshot({ path: `${SHOTS}/${slug}-modal.png` });
      await page.locator(".modal .close").first().tap();
      await page.locator(".modal-backdrop").waitFor({ state: "detached", timeout: 20000 });
    });

    await check("no uncaught page errors", async () => assert(!errors.length, errors.join(" | ")));
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
