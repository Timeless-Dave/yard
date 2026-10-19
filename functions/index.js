import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import Stripe from "stripe";
import { moderateText, MAX_LENGTHS } from "./moderation.js";
import { evaluateEarn } from "./gameRules.js";

// Keep idle cost at zero: no min instances, tiny memory, short timeouts.
setGlobalOptions({
  region: "us-central1",
  memory: "256MiB",
  timeoutSeconds: 30,
  maxInstances: 4,
  concurrency: 20,
});

initializeApp();
const db = getFirestore();

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const siteUrl = defineString("SITE_URL", { default: "http://localhost:5173" });

const DEFAULT_NAME = "Golden Lion";
const DEFAULT_COLOR = "#f4b223";
const AUTO_HIDE_REPORTS = 3;

function requireAuth(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  return request.auth.uid;
}

function requireAdmin(request) {
  const uid = requireAuth(request);
  if (request.auth.token.admin !== true) throw new HttpsError("permission-denied", "Moderators only.");
  return uid;
}

function walletIdentity(userSnap) {
  const user = userSnap.exists ? userSnap.data() : {};
  return { displayName: user.display_name || DEFAULT_NAME, color: user.color || DEFAULT_COLOR };
}

// ---- coin economy. Wallets, inventory, purchases, and the earn log are
// unwritable by clients (see firestore.rules); every change happens here via
// the Admin SDK inside a transaction. ----

export const earnCoins = onCall(async (request) => {
  const uid = requireAuth(request);
  const { source, grade, achievementId } = request.data || {};

  const walletRef = db.collection("wallets").doc(uid);
  const userRef = db.collection("users").doc(uid);
  const logRef = db.collection("earnLog").doc(uid);
  const entryRef = db.collection("walletTransactions").doc(uid).collection("entries").doc();

  return db.runTransaction(async (tx) => {
    const [walletSnap, userSnap, logSnap] = await Promise.all([tx.get(walletRef), tx.get(userRef), tx.get(logRef)]);
    const now = new Date();
    const verdict = evaluateEarn({ source, grade, achievementId }, logSnap.exists ? logSnap.data() : {}, now);
    if (verdict.error) throw new HttpsError("resource-exhausted", verdict.error);

    const current = walletSnap.exists ? walletSnap.data() : { balance: 0, lifetimeEarned: 0 };
    const balance = (current.balance || 0) + verdict.amount;
    tx.set(
      walletRef,
      {
        balance,
        lifetimeEarned: (current.lifetimeEarned || 0) + verdict.amount,
        ...walletIdentity(userSnap),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    const reason = source === "achievement" ? `achievement: ${achievementId}` : grade ? `${source} ${grade}` : source;
    tx.set(entryRef, { delta: verdict.amount, reason, createdAt: FieldValue.serverTimestamp() });

    const logUpdate = { day: verdict.today, earnedToday: verdict.earnedToday };
    if (source === "achievement") logUpdate.claimedAchievements = { [achievementId]: true };
    else Object.assign(logUpdate, { lastAt: { [source]: now.getTime() }, lastDay: { [source]: verdict.today } });
    tx.set(logRef, logUpdate, { merge: true });

    return { balance, amount: verdict.amount };
  });
});

export const spendCoins = onCall(async (request) => {
  const uid = requireAuth(request);
  const amount = request.data?.amount;
  const reason = String(request.data?.reason || "").slice(0, 80);
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1000) {
    throw new HttpsError("invalid-argument", "invalid spend amount");
  }

  const walletRef = db.collection("wallets").doc(uid);
  const entryRef = db.collection("walletTransactions").doc(uid).collection("entries").doc();

  const balance = await db.runTransaction(async (tx) => {
    const walletSnap = await tx.get(walletRef);
    const current = walletSnap.exists ? walletSnap.data().balance || 0 : 0;
    if (current < amount) throw new HttpsError("failed-precondition", "insufficient balance");
    tx.update(walletRef, { balance: current - amount, updatedAt: FieldValue.serverTimestamp() });
    tx.set(entryRef, { delta: -amount, reason, createdAt: FieldValue.serverTimestamp() });
    return current - amount;
  });

  return { balance };
});

export const purchaseWithCoins = onCall(async (request) => {
  const uid = requireAuth(request);
  const itemId = String(request.data?.itemId || "");
  if (!itemId) throw new HttpsError("invalid-argument", "itemId required");

  const itemRef = db.collection("storeItems").doc(itemId);
  const walletRef = db.collection("wallets").doc(uid);
  const invRef = db.collection("inventory").doc(uid).collection("items").doc(itemId);
  const entryRef = db.collection("walletTransactions").doc(uid).collection("entries").doc();
  const purchaseRef = db.collection("purchases").doc();

  const balance = await db.runTransaction(async (tx) => {
    const [itemSnap, walletSnap, invSnap] = await Promise.all([tx.get(itemRef), tx.get(walletRef), tx.get(invRef)]);
    if (!itemSnap.exists || !itemSnap.data().active) throw new HttpsError("not-found", "item not found");
    const item = itemSnap.data();
    if (item.priceCoins == null) throw new HttpsError("failed-precondition", "this item is not coin-priced");
    if (item.kind === "cosmetic" && invSnap.exists) throw new HttpsError("already-exists", "you already own this");

    const charge = item.discountPct ? Math.round(item.priceCoins * (1 - item.discountPct / 100)) : item.priceCoins;
    const current = walletSnap.exists ? walletSnap.data().balance || 0 : 0;
    if (current < charge) throw new HttpsError("failed-precondition", "insufficient balance");

    tx.set(walletRef, { balance: current - charge, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(entryRef, { delta: -charge, reason: "store: " + item.name, createdAt: FieldValue.serverTimestamp() });
    tx.set(invRef, { acquiredAt: FieldValue.serverTimestamp() });
    tx.set(purchaseRef, {
      userId: uid,
      itemId,
      provider: "coins",
      pricePaidCoins: charge,
      createdAt: FieldValue.serverTimestamp(),
    });
    return current - charge;
  });

  return { balance };
});

// ---- Stripe (cash purchases) ----

export const createCheckoutSession = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  const uid = requireAuth(request);
  const itemId = String(request.data?.itemId || "");
  const itemSnap = await db.collection("storeItems").doc(itemId).get();
  if (!itemSnap.exists || !itemSnap.data().active) throw new HttpsError("not-found", "item not found");
  const item = itemSnap.data();
  if (item.priceCents == null) throw new HttpsError("failed-precondition", "this item is not cash-priced");

  const chargeCents = item.discountPct ? Math.round(item.priceCents * (1 - item.discountPct / 100)) : item.priceCents;
  const stripe = new Stripe(stripeSecretKey.value());
  const site = siteUrl.value();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      { price_data: { currency: "usd", unit_amount: chargeCents, product_data: { name: item.name } }, quantity: 1 },
    ],
    metadata: { uid, itemId },
    success_url: `${site}/?purchase=success`,
    cancel_url: `${site}/?purchase=cancelled`,
  });

  return { url: session.url };
});

// Grants a paid Stripe session exactly once. Stripe retries webhook delivery,
// so the purchase doc is keyed by session id and checked inside the same
// transaction that grants — a retry finds it and does nothing.
async function fulfillCheckout(session) {
  const uid = session.metadata?.uid;
  const itemId = session.metadata?.itemId;
  if (!uid || !itemId) return { status: 400, body: "missing metadata" };

  const itemRef = db.collection("storeItems").doc(itemId);
  const purchaseRef = db.collection("purchases").doc(`stripe_${session.id}`);
  const walletRef = db.collection("wallets").doc(uid);
  const userRef = db.collection("users").doc(uid);
  const invRef = db.collection("inventory").doc(uid).collection("items").doc(itemId);
  const entryRef = db.collection("walletTransactions").doc(uid).collection("entries").doc();

  return db.runTransaction(async (tx) => {
    const [purchaseSnap, itemSnap, walletSnap, userSnap] = await Promise.all([
      tx.get(purchaseRef),
      tx.get(itemRef),
      tx.get(walletRef),
      tx.get(userRef),
    ]);
    if (purchaseSnap.exists) return { status: 200, body: "already fulfilled" };
    if (!itemSnap.exists) return { status: 404, body: "item not found" };
    const item = itemSnap.data();

    tx.set(purchaseRef, {
      userId: uid,
      itemId,
      provider: "stripe",
      pricePaidCents: session.amount_total ?? item.priceCents,
      stripeSessionId: session.id,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (item.kind === "coin_pack") {
      // admin_grant_coins equivalent: uncapped, only reachable from a
      // signature-verified Stripe event.
      const coins = item.meta?.coins ?? Math.round((item.priceCents ?? 0) * 2.5);
      const current = walletSnap.exists ? walletSnap.data() : { balance: 0, lifetimeEarned: 0 };
      tx.set(
        walletRef,
        {
          balance: (current.balance || 0) + coins,
          lifetimeEarned: (current.lifetimeEarned || 0) + coins,
          ...walletIdentity(userSnap),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      tx.set(entryRef, { delta: coins, reason: "store: " + item.name, createdAt: FieldValue.serverTimestamp() });
    } else {
      tx.set(invRef, { acquiredAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    return { status: 200, body: "fulfilled" };
  });
}

// Raw HTTPS endpoint (not onCall) — Stripe posts here directly with its own
// signature header, which a callable function's body-wrapping breaks.
export const stripeWebhook = onRequest({ secrets: [stripeSecretKey, stripeWebhookSecret] }, async (req, res) => {
  const stripe = new Stripe(stripeSecretKey.value());
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], stripeWebhookSecret.value());
  } catch (err) {
    res.status(400).send(`Webhook signature verification failed: ${err.message}`);
    return;
  }

  const paid =
    (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid") ||
    event.type === "checkout.session.async_payment_succeeded";
  if (!paid) {
    res.json({ received: true, ignored: event.type });
    return;
  }

  const { status, body } = await fulfillCheckout(event.data.object);
  res.status(status).json({ received: true, result: body });
});

// ---- denormalized tally triggers (replace the old SQL views) ----

export const onVoteWrite = onDocumentWritten("votes/{voteId}", async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  const candidates = db.collection("candidates");
  const updates = [];
  if (before?.candidateId && before.candidateId !== after?.candidateId) {
    updates.push(candidates.doc(before.candidateId).update({ voteCount: FieldValue.increment(-1) }));
  }
  if (after?.candidateId && after.candidateId !== before?.candidateId) {
    updates.push(candidates.doc(after.candidateId).update({ voteCount: FieldValue.increment(1) }));
  }
  await Promise.all(updates);
});

export const onRsvpWrite = onDocumentWritten("partyRsvps/{rsvpId}", async (event) => {
  const existedBefore = event.data.before.exists;
  const existsAfter = event.data.after.exists;
  if (existedBefore === existsAfter) return; // a re-RSVP update: no count change
  const data = existsAfter ? event.data.after.data() : event.data.before.data();
  const partyRef = db.collection("parties").doc(data.partyId);
  if (!(await partyRef.get()).exists) return; // party already deleted
  await partyRef.update({ rsvpCount: FieldValue.increment(existsAfter ? 1 : -1) });
});

// ---- moderation ----
// The browser runs the same moderateText() before writing, so this only
// catches modified clients — but it's the check that actually counts.

const MODERATED = {
  chatMessages: { fields: { msg: MAX_LENGTHS.chat, name: MAX_LENGTHS.displayName }, author: "userId" },
  corkboardPosts: { fields: { msg: MAX_LENGTHS.corkboard, name: MAX_LENGTHS.displayName }, author: "userId" },
  candidates: { fields: { name: MAX_LENGTHS.nominee }, author: "nominatedBy" },
  parties: { fields: { title: MAX_LENGTHS.partyTitle, hostName: MAX_LENGTHS.displayName }, author: "hostId" },
};

function firstViolation(data, fields) {
  for (const [field, maxLength] of Object.entries(fields)) {
    const result = moderateText(data[field], { maxLength });
    if (!result.ok) return `${field}: ${result.reason}`;
  }
  return null;
}

function autoModerate(collection) {
  return onDocumentCreated(`${collection}/{id}`, async (event) => {
    if (!event.data) return;
    const reason = firstViolation(event.data.data(), MODERATED[collection].fields);
    if (reason) await event.data.ref.update({ hidden: true, hiddenReason: "auto: " + reason });
  });
}

export const moderateChat = autoModerate("chatMessages");
export const moderateCorkboard = autoModerate("corkboardPosts");
export const moderateCandidate = autoModerate("candidates");
export const moderateParty = autoModerate("parties");

export const moderateProfile = onDocumentWritten("users/{uid}", async (event) => {
  const after = event.data.after;
  if (!after.exists) return;
  if (!moderateText(after.data().display_name, { maxLength: MAX_LENGTHS.displayName }).ok) {
    await after.ref.update({ display_name: DEFAULT_NAME });
  }
});

export const onReportCreated = onDocumentCreated("reports/{reportId}", async (event) => {
  if (!event.data) return;
  const report = event.data.data();
  const targetRef = db.collection(report.targetCollection).doc(report.targetId);
  await db.runTransaction(async (tx) => {
    const target = await tx.get(targetRef);
    tx.update(event.data.ref, { status: "open" });
    if (!target.exists) return;
    const reportCount = (target.data().reportCount || 0) + 1;
    const update = { reportCount };
    if (reportCount >= AUTO_HIDE_REPORTS && !target.data().hidden) {
      Object.assign(update, { hidden: true, hiddenReason: `auto: ${reportCount} reports` });
    }
    tx.update(targetRef, update);
  });
});

const MOD_ACTIONS = ["dismiss", "hide", "restore", "ban"];

export const resolveReport = onCall(async (request) => {
  const moderatorId = requireAdmin(request);
  const { reportId, action } = request.data || {};
  if (!MOD_ACTIONS.includes(action)) throw new HttpsError("invalid-argument", "invalid action");

  const reportRef = db.collection("reports").doc(String(reportId));
  const reportSnap = await reportRef.get();
  if (!reportSnap.exists) throw new HttpsError("not-found", "report not found");
  const { targetCollection, targetId } = reportSnap.data();
  const targetRef = db.collection(targetCollection).doc(targetId);
  const targetSnap = await targetRef.get();
  const authorId = targetSnap.exists ? targetSnap.get(MODERATED[targetCollection].author) : null;

  const batch = db.batch();
  if (targetSnap.exists && (action === "hide" || action === "ban")) {
    batch.update(targetRef, { hidden: true, hiddenReason: `moderator: ${action}` });
  }
  if (targetSnap.exists && action === "restore") {
    batch.update(targetRef, { hidden: false, hiddenReason: FieldValue.delete(), reportCount: 0 });
  }
  if (action === "ban" && authorId) {
    batch.set(db.collection("bannedUsers").doc(authorId), {
      bannedAt: FieldValue.serverTimestamp(),
      by: moderatorId,
      reportId: reportRef.id,
    });
  }

  const resolution = {
    status: action === "dismiss" ? "dismissed" : "actioned",
    action,
    resolvedBy: moderatorId,
    resolvedAt: FieldValue.serverTimestamp(),
  };
  const openReports = await db
    .collection("reports")
    .where("targetCollection", "==", targetCollection)
    .where("targetId", "==", targetId)
    .where("status", "==", "open")
    .get();
  openReports.forEach((r) => batch.update(r.ref, resolution));
  batch.update(reportRef, resolution);
  batch.set(db.collection("modLog").doc(), {
    action,
    reportId: reportRef.id,
    targetCollection,
    targetId,
    authorId,
    by: moderatorId,
    at: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return { ok: true };
});

// ---- account self-service ----

export const deleteMyAccount = onCall(async (request) => {
  const uid = requireAuth(request);

  for (const path of [`walletTransactions/${uid}`, `inventory/${uid}`, `achievementProgress/${uid}`]) {
    await db.recursiveDelete(db.doc(path));
  }
  const batch = db.batch();
  for (const path of [`users/${uid}`, `wallets/${uid}`, `earnLog/${uid}`, `rateLimits/${uid}`, `orgMembers/${uid}`]) {
    batch.delete(db.doc(path));
  }
  batch.delete(db.doc(`votes/${uid}_king`));
  batch.delete(db.doc(`votes/${uid}_queen`));
  await batch.commit();

  const authored = [
    ["chatMessages", "userId"],
    ["corkboardPosts", "userId"],
    ["partyRsvps", "userId"],
    ["probateSignups", "userId"],
    ["plotClaims", "userId"],
    ["purchases", "userId"],
    ["parties", "hostId"],
  ];
  for (const [collection, field] of authored) {
    const snap = await db.collection(collection).where(field, "==", uid).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }

  await getDatabase().ref(`presence/${uid}`).remove();
  await getAuth().deleteUser(uid);
  return { ok: true };
});
