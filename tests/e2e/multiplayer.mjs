// Two real browsers, one shared backend: the actual app (Vite dev server)
// against the Firebase emulator suite. Run via `npm run test:e2e`, which
// starts the emulators first.
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "playwright";

const PORT = 5199;
const URL = `http://127.0.0.1:${PORT}/`;
const SHOTS = "test-results/e2e";

process.env.VITE_USE_EMULATORS = "true";

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

async function join(browser, name) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(URL);
  await page.locator('text="Let\'s go!"').click({ timeout: 20000 });
  await page.locator('[data-modal="auth"]').first().click();
  await page.fill("#am-name", name);
  await page.click("#am-join");
  await page.locator("#am-join").waitFor({ state: "detached", timeout: 20000 });
  return { context, page, errors, name };
}

async function openModal(page, key) {
  await page.locator(`[data-modal="${key}"]`).first().click();
}
async function closeModal(page) {
  await page.locator(".modal .close").first().click();
}

await mkdir(SHOTS, { recursive: true });
const server = await createServer({ server: { port: PORT, strictPort: true, host: "127.0.0.1" }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch();

try {
  console.log("multiplayer e2e");
  const alice = await join(browser, "Alice");
  const bob = await join(browser, "Bob");

  await check("both players see 2 Golden Lions on the Yard", async () => {
    for (const p of [alice, bob]) {
      await p.page.locator("#player-count-label", { hasText: "2 Golden Lions" }).waitFor({ timeout: 20000 });
    }
  });

  await check("signed-in UI shows the player's own name instead of Sign up / Log in", async () => {
    await alice.page.locator('.bottom-card [data-modal="auth"]', { hasText: "👤 Alice" }).waitFor({ timeout: 20000 });
    const signUpVisible = await alice.page.locator('.bottom-card [data-modal="auth"]', { hasText: "Sign up" }).isVisible();
    if (signUpVisible) throw new Error("Sign up still showing for a signed-in player");
  });

  await check("each sees the other's avatar under the name they picked (not 'Golden Lion')", async () => {
    await bob.page.locator(".peer-tag", { hasText: "Alice" }).waitFor({ state: "attached", timeout: 20000 });
    await alice.page.locator(".peer-tag", { hasText: "Bob" }).waitFor({ state: "attached", timeout: 20000 });
  });

  await check("movement replicates: Alice walks, Bob's view of her moves", async () => {
    const tag = bob.page.locator(".peer-tag", { hasText: "Alice" });
    const before = await tag.evaluate((el) => el.style.left);
    await alice.page.keyboard.down("a");
    await alice.page.waitForTimeout(1200);
    await alice.page.keyboard.up("a");
    await bob.page.waitForFunction(
      (prev) => [...document.querySelectorAll(".peer-tag")].find((el) => el.textContent === "Alice")?.style.left !== prev,
      before,
      { timeout: 20000 }
    );
  });
  await bob.page.screenshot({ path: `${SHOTS}/bob-sees-alice.png` });

  await check("chat delivers live between browsers", async () => {
    await openModal(bob.page, "chat");
    await openModal(alice.page, "chat");
    await alice.page.fill("#chat-input", "who's pulling up to the step show?");
    await alice.page.press("#chat-input", "Enter");
    await bob.page.locator("#chat-list", { hasText: "who's pulling up to the step show?" }).waitFor({ timeout: 20000 });
  });

  await check("the browser filter blocks slurs before they're sent", async () => {
    await alice.page.waitForTimeout(3500); // past the rate limit, so only the filter can block
    await alice.page.fill("#chat-input", "you're a b1tch");
    await alice.page.press("#chat-input", "Enter");
    await alice.page.locator("#chat-status", { hasText: "community guidelines" }).waitFor({ timeout: 20000 });
    await bob.page.waitForTimeout(1500);
    const leaked = await bob.page.locator("#chat-list", { hasText: "b1tch" }).count();
    if (leaked) throw new Error("blocked message reached the other player");
  });

  await check("rate limiting: a second message within 3s is refused", async () => {
    await alice.page.waitForTimeout(3500);
    await alice.page.fill("#chat-input", "one");
    await alice.page.press("#chat-input", "Enter");
    await alice.page.locator("#chat-list", { hasText: "one" }).waitFor({ timeout: 20000 });
    await alice.page.fill("#chat-input", "two");
    await alice.page.press("#chat-input", "Enter");
    await alice.page.locator("#chat-status", { hasText: "Slow down" }).waitFor({ timeout: 20000 });
  });

  await check("markup in messages renders as text, never as HTML", async () => {
    await alice.page.waitForTimeout(3500);
    await alice.page.fill("#chat-input", "<img src=x onerror=window.__pwned=1> hi");
    await alice.page.press("#chat-input", "Enter");
    await bob.page.locator("#chat-list", { hasText: "<img src=x" }).waitFor({ timeout: 20000 });
    if (await bob.page.evaluate(() => window.__pwned)) throw new Error("injected markup executed");
  });

  await check("reporting works from the other player's side", async () => {
    const card = bob.page.locator(".corkboard-card", { hasText: "step show" });
    await card.locator(".report-btn").click();
    await card.locator(".report-reason", { hasText: "Spam" }).click();
    await card.locator("text=Reported — thanks.").waitFor({ timeout: 20000 });
  });
  await bob.page.screenshot({ path: `${SHOTS}/chat.png` });
  await closeModal(alice.page);
  await closeModal(bob.page);

  await check("closing a tab removes that player from everyone else's map", async () => {
    await alice.context.close();
    await bob.page.locator("#player-count-label", { hasText: "1 Golden Lions" }).waitFor({ timeout: 20000 });
    await bob.page.locator(".peer-tag", { hasText: "Alice" }).waitFor({ state: "detached", timeout: 20000 });
  });

  await check("no uncaught page errors in either browser", async () => {
    const all = [...alice.errors, ...bob.errors];
    if (all.length) throw new Error(all.join(" | "));
  });
} finally {
  await browser.close();
  await server.close();
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
