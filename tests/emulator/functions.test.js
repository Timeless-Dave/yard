// Cloud Functions, exercised end-to-end through the Auth, Firestore, RTDB,
// and Functions emulators with real client SDK calls — the same path the
// browser uses. Run via `npm run test:emulator`.
import { createHmac } from "node:crypto";
import { describe, it, expect, beforeAll } from "vitest";
import { initializeApp as initClient } from "firebase/app";
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { initializeApp as initAdmin } from "firebase-admin/app";
import { getFirestore as adminFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth as adminAuth } from "firebase-admin/auth";
import { getDatabase as adminDatabase } from "firebase-admin/database";

const PROJECT = "demo-yard";
const WEBHOOK_SECRET = "whsec_emulator_test_secret"; // matches functions/.secret.local
const WEBHOOK_URL = `http://127.0.0.1:5001/${PROJECT}/us-central1/stripeWebhook`;

const admin = initAdmin({ projectId: PROJECT, databaseURL: `http://127.0.0.1:9000?ns=${PROJECT}-default-rtdb` }, "admin");
const adb = adminFirestore(admin);
const aauth = adminAuth(admin);

let appCount = 0;
async function player(name) {
  const app = initClient({ apiKey: "demo-key", authDomain: `${PROJECT}.firebaseapp.com`, projectId: PROJECT }, `player-${appCount++}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const fns = getFunctions(app);
  connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  const { user } = await signInAnonymously(auth);
  await setDoc(doc(db, "users", user.uid), { display_name: name, color: "#f4b223", created_at: serverTimestamp() });
  const call = (fn, data) => httpsCallable(fns, fn)(data).then((r) => r.data);
  // Public posts go out the only way rules accept: batched with a rate-limit bump.
  const publish = (col, id, data) => {
    const batch = writeBatch(db);
    batch.set(doc(db, col, id), { ...data, createdAt: serverTimestamp(), hidden: false, reportCount: 0 });
    batch.set(doc(db, "rateLimits", user.uid), { lastPostAt: serverTimestamp() });
    return batch.commit();
  };
  return { db, user, uid: user.uid, name, call, publish };
}

async function waitFor(check, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("timed out waiting for condition");
}
const read = async (path) => (await adb.doc(path).get()).data();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uniq = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

beforeAll(async () => {
  const batch = adb.batch();
  batch.set(adb.doc("storeItems/gold-trim-fit"), { name: "Gold Trim Fit", kind: "cosmetic", icon: "✨", priceCoins: 150, meta: { color: "#ffd84d" }, active: true });
  batch.set(adb.doc("storeItems/coin-pack-500"), { name: "500 Yard Coin", kind: "coin_pack", icon: "🪙", priceCents: 199, meta: { coins: 500 }, active: true });
  batch.set(adb.doc("storeItems/crimson-fit"), { name: "Crimson Fit", kind: "cosmetic", icon: "🔴", priceCents: 299, meta: { color: "#b4182f" }, active: true });
  await batch.commit();
});

describe("earnCoins: the server decides payouts", () => {
  it("pays by grade, then enforces the cooldown", async () => {
    const p = await player("Earner");
    await expect(p.call("earnCoins", { source: "stepshow", grade: "S" })).resolves.toMatchObject({ amount: 100, balance: 100 });
    await expect(p.call("earnCoins", { source: "stepshow", grade: "S" })).rejects.toThrow(/cooldown/);
  });

  it("ignores a client-supplied amount", async () => {
    const p = await player("Cheater");
    await expect(p.call("earnCoins", { source: "spades_win", amount: 99999 })).resolves.toMatchObject({ amount: 15 });
  });

  it("rejects invented sources", async () => {
    const p = await player("Inventor");
    await expect(p.call("earnCoins", { source: "free_money" })).rejects.toThrow(/unknown source/);
  });

  it("pays each achievement once", async () => {
    const p = await player("Achiever");
    await expect(p.call("earnCoins", { source: "achievement", achievementId: "voter" })).resolves.toMatchObject({ amount: 25 });
    await expect(p.call("earnCoins", { source: "achievement", achievementId: "voter" })).rejects.toThrow(/already claimed/);
  });

  it("band cheer pays once per day no matter how many clicks", async () => {
    const p = await player("Fan");
    await p.call("earnCoins", { source: "band_cheer" });
    await expect(p.call("earnCoins", { source: "band_cheer" })).rejects.toThrow(/today/);
    expect((await read(`wallets/${p.uid}`)).balance).toBe(10);
  });

  it("records a transaction log entry and denormalizes the name for the leaderboard", async () => {
    const p = await player("Ledger");
    await p.call("earnCoins", { source: "dominoes_win" });
    const wallet = await read(`wallets/${p.uid}`);
    expect(wallet).toMatchObject({ balance: 20, lifetimeEarned: 20, displayName: "Ledger" });
    const entries = await adb.collection(`walletTransactions/${p.uid}/entries`).get();
    expect(entries.docs.map((d) => d.data().delta)).toEqual([20]);
  });
});

describe("spending and the coin store", () => {
  it("spendCoins validates amounts and balance", async () => {
    const p = await player("Spender");
    await adb.doc(`wallets/${p.uid}`).set({ balance: 100, lifetimeEarned: 100 });
    await expect(p.call("spendCoins", { amount: 500, reason: "x" })).rejects.toThrow(/insufficient/);
    await expect(p.call("spendCoins", { amount: -5, reason: "x" })).rejects.toThrow(/invalid/);
    await expect(p.call("spendCoins", { amount: 2.5, reason: "x" })).rejects.toThrow(/invalid/);
    await expect(p.call("spendCoins", { amount: 6, reason: "vending" })).resolves.toEqual({ balance: 94 });
  });

  it("buys a cosmetic once, then lets the owner (and only the owner) wear it", async () => {
    const p = await player("Shopper");
    await adb.doc(`wallets/${p.uid}`).set({ balance: 400, lifetimeEarned: 400 });
    await expect(p.call("purchaseWithCoins", { itemId: "gold-trim-fit" })).resolves.toEqual({ balance: 250 });
    expect(await read(`inventory/${p.uid}/items/gold-trim-fit`)).toBeTruthy();
    await expect(p.call("purchaseWithCoins", { itemId: "gold-trim-fit" })).rejects.toThrow(/already own/);
    await expect(updateDoc(doc(p.db, "users", p.uid), { color: "#ffd84d", equippedItem: "gold-trim-fit" })).resolves.toBeUndefined();

    const other = await player("Copycat");
    await expect(updateDoc(doc(other.db, "users", other.uid), { color: "#ffd84d", equippedItem: "gold-trim-fit" })).rejects.toThrow();
  });

  it("won't sell cash-priced items for coins", async () => {
    const p = await player("Bargain");
    await adb.doc(`wallets/${p.uid}`).set({ balance: 10000, lifetimeEarned: 10000 });
    await expect(p.call("purchaseWithCoins", { itemId: "coin-pack-500" })).rejects.toThrow(/not coin-priced/);
  });
});

describe("tally triggers", () => {
  it("keeps candidate vote counts right as ballots are cast and changed", async () => {
    const [c1, c2] = [uniq("cand"), uniq("cand")];
    for (const id of [c1, c2]) {
      await adb.doc(`candidates/${id}`).set({ category: "king", name: id, nominatedBy: "seed", voteCount: 0, hidden: false, reportCount: 0, createdAt: Timestamp.now() });
    }
    const voter = await player("Voter");
    const ballot = (candidateId) =>
      setDoc(doc(voter.db, "votes", `${voter.uid}_king`), { userId: voter.uid, category: "king", candidateId, createdAt: serverTimestamp() });

    await ballot(c1);
    await waitFor(async () => (await read(`candidates/${c1}`)).voteCount === 1);
    await ballot(c2);
    await waitFor(async () => (await read(`candidates/${c1}`)).voteCount === 0 && (await read(`candidates/${c2}`)).voteCount === 1);
  });

  it("counts an RSVP once, even when repeated, and un-counts it on cancel", async () => {
    const partyId = uniq("party");
    await adb.doc(`parties/${partyId}`).set({ title: "Kickback", hostId: "seed", rsvpCount: 0, hidden: false, endsAt: Timestamp.fromMillis(Date.now() + 3600_000) });
    const guest = await player("Guest");
    const rsvpRef = doc(guest.db, "partyRsvps", `${partyId}_${guest.uid}`);
    const rsvp = () => setDoc(rsvpRef, { partyId, userId: guest.uid, displayName: "Guest", createdAt: serverTimestamp() });

    await rsvp();
    await waitFor(async () => (await read(`parties/${partyId}`)).rsvpCount === 1);
    await rsvp();
    await sleep(2000);
    expect((await read(`parties/${partyId}`)).rsvpCount).toBe(1);
    await deleteDoc(rsvpRef);
    await waitFor(async () => (await read(`parties/${partyId}`)).rsvpCount === 0);
  });
});

describe("server-side moderation", () => {
  it("hides a slur posted by a client that skipped the browser filter", async () => {
    const p = await player("Bypasser");
    const id = uniq("msg");
    await p.publish("chatMessages", id, { userId: p.uid, name: p.name, msg: "f u c k all of y'all" });
    const hidden = await waitFor(async () => {
      const m = await read(`chatMessages/${id}`);
      return m.hidden && m;
    });
    expect(hidden.hiddenReason).toMatch(/^auto: msg/);
  });

  it("leaves normal messages alone", async () => {
    const p = await player("Regular");
    const id = uniq("msg");
    await p.publish("chatMessages", id, { userId: p.uid, name: p.name, msg: "summa cum laude, class of 2027!" });
    await sleep(3000);
    expect((await read(`chatMessages/${id}`)).hidden).toBe(false);
  });

  it("resets an offensive display name", async () => {
    const p = await player("Renamer");
    await updateDoc(doc(p.db, "users", p.uid), { display_name: "f4ggot" });
    await waitFor(async () => (await read(`users/${p.uid}`)).display_name === "Golden Lion");
  });

  it("auto-hides after reports from 3 different players", async () => {
    const id = uniq("msg");
    await adb.doc(`chatMessages/${id}`).set({ userId: "seed", name: "Seed", msg: "borderline", hidden: false, reportCount: 0, createdAt: Timestamp.now() });
    for (const name of ["R1", "R2", "R3"]) {
      const r = await player(name);
      await setDoc(doc(r.db, "reports", `chatMessages_${id}_${r.uid}`), {
        targetCollection: "chatMessages",
        targetId: id,
        reporterId: r.uid,
        reason: "harassment",
        createdAt: serverTimestamp(),
      });
    }
    const target = await waitFor(async () => {
      const m = await read(`chatMessages/${id}`);
      return m.reportCount === 3 && m;
    });
    expect(target).toMatchObject({ hidden: true, hiddenReason: "auto: 3 reports" });
  });

  it("moderators can ban; banned players can't post; regular players can't moderate", async () => {
    const author = await player("Troll");
    const id = uniq("msg");
    await author.publish("chatMessages", id, { userId: author.uid, name: author.name, msg: "you all are trash" });
    const reporter = await player("Reporter");
    const reportId = `chatMessages_${id}_${reporter.uid}`;
    await setDoc(doc(reporter.db, "reports", reportId), {
      targetCollection: "chatMessages",
      targetId: id,
      reporterId: reporter.uid,
      reason: "harassment",
      createdAt: serverTimestamp(),
    });
    await waitFor(async () => (await read(`reports/${reportId}`))?.status === "open");

    await expect(reporter.call("resolveReport", { reportId, action: "ban" })).rejects.toThrow(/Moderators only/);

    const mod = await player("Mod");
    await aauth.setCustomUserClaims(mod.uid, { admin: true });
    await mod.user.getIdToken(true);
    await expect(mod.call("resolveReport", { reportId, action: "ban" })).resolves.toEqual({ ok: true });

    expect(await read(`bannedUsers/${author.uid}`)).toBeTruthy();
    expect(await read(`chatMessages/${id}`)).toMatchObject({ hidden: true });
    expect(await read(`reports/${reportId}`)).toMatchObject({ status: "actioned", action: "ban" });
    const log = await adb.collection("modLog").where("reportId", "==", reportId).get();
    expect(log.size).toBe(1);

    await sleep(3200);
    await expect(author.publish("chatMessages", uniq("msg"), { userId: author.uid, name: author.name, msg: "back again" })).rejects.toThrow();
  });
});

describe("Stripe webhook", () => {
  function deliver(event, signature) {
    const payload = JSON.stringify(event);
    const t = Math.floor(Date.now() / 1000);
    const v1 = createHmac("sha256", WEBHOOK_SECRET).update(`${t}.${payload}`).digest("hex");
    return fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": signature ?? `t=${t},v1=${v1}` },
      body: payload,
    });
  }
  const checkout = (uid, itemId, sessionId, paymentStatus = "paid") => ({
    id: uniq("evt"),
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: sessionId, object: "checkout.session", payment_status: paymentStatus, amount_total: 199, metadata: { uid, itemId } } },
  });

  it("grants a paid coin pack exactly once, even when Stripe retries", async () => {
    const p = await player("Buyer");
    const event = checkout(p.uid, "coin-pack-500", uniq("cs_test"));
    const first = await deliver(event);
    expect(first.status).toBe(200);
    expect(await read(`wallets/${p.uid}`)).toMatchObject({ balance: 500, lifetimeEarned: 500 });

    const retry = await deliver(event);
    expect(await retry.json()).toMatchObject({ result: "already fulfilled" });
    expect((await read(`wallets/${p.uid}`)).balance).toBe(500);
    expect(await read(`purchases/stripe_${event.data.object.id}`)).toMatchObject({ provider: "stripe", userId: p.uid });
  });

  it("grants a paid cosmetic into inventory", async () => {
    const p = await player("FitBuyer");
    await deliver(checkout(p.uid, "crimson-fit", uniq("cs_test")));
    expect(await read(`inventory/${p.uid}/items/crimson-fit`)).toBeTruthy();
  });

  it("ignores sessions that haven't actually been paid", async () => {
    const p = await player("Unpaid");
    const res = await deliver(checkout(p.uid, "coin-pack-500", uniq("cs_test"), "unpaid"));
    expect(await res.json()).toMatchObject({ ignored: "checkout.session.completed" });
    expect(await read(`wallets/${p.uid}`)).toBeUndefined();
  });

  it("rejects forged events", async () => {
    const p = await player("Forger");
    const res = await deliver(checkout(p.uid, "coin-pack-500", uniq("cs_test")), "t=1,v1=deadbeef");
    expect(res.status).toBe(400);
    expect(await read(`wallets/${p.uid}`)).toBeUndefined();
  });
});

describe("deleteMyAccount", () => {
  it("removes the account and everything it owns", async () => {
    const p = await player("Leaver");
    await p.call("earnCoins", { source: "stepshow", grade: "A" });
    const msgId = uniq("msg");
    await p.publish("chatMessages", msgId, { userId: p.uid, name: p.name, msg: "bye yall" });
    await adminDatabase(admin).ref(`presence/${p.uid}`).set({ name: "Leaver", color: "#f4b223", x: 0, z: 0, rotY: 0, updatedAt: Date.now() });

    await expect(p.call("deleteMyAccount")).resolves.toEqual({ ok: true });

    expect(await read(`users/${p.uid}`)).toBeUndefined();
    expect(await read(`wallets/${p.uid}`)).toBeUndefined();
    expect(await read(`chatMessages/${msgId}`)).toBeUndefined();
    expect((await adb.collection(`walletTransactions/${p.uid}/entries`).get()).size).toBe(0);
    expect((await adminDatabase(admin).ref(`presence/${p.uid}`).get()).exists()).toBe(false);
    await expect(aauth.getUser(p.uid)).rejects.toThrow();
  });
});
