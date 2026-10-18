import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import Stripe from "stripe";

initializeApp();
const db = getFirestore();

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const siteUrl = defineString("SITE_URL", { default: "http://localhost:5173" });

const EARN_CAP = 250; // same per-call cap the old earn_coins() SQL function enforced

function requireAuth(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  return request.auth.uid;
}

// ---- coin economy (client-unwritable wallets/inventory/purchases; all
// mutation happens here via the Admin SDK, which bypasses Firestore rules) ----

export const earnCoins = onCall(async (request) => {
  const uid = requireAuth(request);
  const amount = Number(request.data?.amount);
  const reason = String(request.data?.reason || "");
  if (!Number.isFinite(amount) || amount <= 0 || amount > EARN_CAP) {
    throw new HttpsError("invalid-argument", "invalid earn amount");
  }

  const walletRef = db.collection("wallets").doc(uid);
  const userRef = db.collection("users").doc(uid);
  const entryRef = db.collection("walletTransactions").doc(uid).collection("entries").doc();

  const balance = await db.runTransaction(async (tx) => {
    const [walletSnap, userSnap] = await Promise.all([tx.get(walletRef), tx.get(userRef)]);
    const current = walletSnap.exists ? walletSnap.data() : { balance: 0, lifetimeEarned: 0 };
    const userData = userSnap.exists ? userSnap.data() : {};
    const newBalance = (current.balance || 0) + amount;
    tx.set(
      walletRef,
      {
        balance: newBalance,
        lifetimeEarned: (current.lifetimeEarned || 0) + amount,
        displayName: userData.display_name || "Golden Lion",
        color: userData.color || "#f4b223",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    tx.set(entryRef, { delta: amount, reason, createdAt: FieldValue.serverTimestamp() });
    return newBalance;
  });

  return { balance };
});

export const spendCoins = onCall(async (request) => {
  const uid = requireAuth(request);
  const amount = Number(request.data?.amount);
  const reason = String(request.data?.reason || "");
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpsError("invalid-argument", "invalid spend amount");
  }

  const walletRef = db.collection("wallets").doc(uid);
  const entryRef = db.collection("walletTransactions").doc(uid).collection("entries").doc();

  const balance = await db.runTransaction(async (tx) => {
    const walletSnap = await tx.get(walletRef);
    const current = walletSnap.exists ? walletSnap.data().balance || 0 : 0;
    if (current < amount) throw new HttpsError("failed-precondition", "insufficient balance");
    const newBalance = current - amount;
    tx.update(walletRef, { balance: newBalance, updatedAt: FieldValue.serverTimestamp() });
    tx.set(entryRef, { delta: -amount, reason, createdAt: FieldValue.serverTimestamp() });
    return newBalance;
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
    const newBalance = current - charge;

    tx.set(walletRef, { balance: newBalance, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(entryRef, { delta: -charge, reason: "store: " + item.name, createdAt: FieldValue.serverTimestamp() });
    tx.set(invRef, { acquiredAt: FieldValue.serverTimestamp() });
    tx.set(purchaseRef, {
      userId: uid,
      itemId,
      provider: "coins",
      pricePaidCoins: charge,
      createdAt: FieldValue.serverTimestamp(),
    });
    return newBalance;
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

async function grantCoinPack(uid, coinAmount, reason) {
  const walletRef = db.collection("wallets").doc(uid);
  const userRef = db.collection("users").doc(uid);
  const entryRef = db.collection("walletTransactions").doc(uid).collection("entries").doc();
  await db.runTransaction(async (tx) => {
    const [walletSnap, userSnap] = await Promise.all([tx.get(walletRef), tx.get(userRef)]);
    const current = walletSnap.exists ? walletSnap.data() : { balance: 0, lifetimeEarned: 0 };
    const userData = userSnap.exists ? userSnap.data() : {};
    tx.set(
      walletRef,
      {
        balance: (current.balance || 0) + coinAmount,
        lifetimeEarned: (current.lifetimeEarned || 0) + coinAmount,
        displayName: userData.display_name || "Golden Lion",
        color: userData.color || "#f4b223",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    tx.set(entryRef, { delta: coinAmount, reason, createdAt: FieldValue.serverTimestamp() });
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const uid = session.metadata?.uid;
    const itemId = session.metadata?.itemId;
    if (!uid || !itemId) {
      res.status(400).send("missing metadata");
      return;
    }

    const itemSnap = await db.collection("storeItems").doc(itemId).get();
    if (!itemSnap.exists) {
      res.status(404).send("item not found");
      return;
    }
    const item = itemSnap.data();

    await db.collection("purchases").add({
      userId: uid,
      itemId,
      provider: "stripe",
      pricePaidCents: item.priceCents,
      stripeSessionId: session.id,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (item.kind === "coin_pack") {
      // admin_grant_coins equivalent: uncapped, only ever reached from here.
      const coinAmount = item.meta?.coins ?? Math.round((item.priceCents ?? 0) * 2.5);
      await grantCoinPack(uid, coinAmount, "store: " + item.name);
    } else {
      await db
        .collection("inventory")
        .doc(uid)
        .collection("items")
        .doc(itemId)
        .set({ acquiredAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  }

  res.json({ received: true });
});

// ---- denormalized tally triggers (replace the Postgres VIEWs) ----

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
  await db
    .collection("parties")
    .doc(data.partyId)
    .update({ rsvpCount: FieldValue.increment(existsAfter ? 1 : -1) });
});
