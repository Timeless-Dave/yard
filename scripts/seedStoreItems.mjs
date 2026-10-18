// One-off seed for the storeItems catalog (Firestore has no write policy on
// this collection, so it's seeded via the Admin SDK, not client code).
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json node scripts/seedStoreItems.mjs
//
// Safe to re-run: uses deterministic doc IDs, so re-running just overwrites
// the same catalog rather than duplicating it.
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

const items = [
  { id: "gold-trim-fit", name: "Gold Trim Fit", kind: "cosmetic", icon: "✨", priceCoins: 150, meta: { color: "#ffd84d" } },
  { id: "black-gold-fit", name: "Black & Gold Fit", kind: "cosmetic", icon: "🖤", priceCoins: 150, meta: { color: "#1a1a1a" } },
  { id: "crimson-fit", name: "Crimson Fit", kind: "cosmetic", icon: "🔴", priceCoins: 150, meta: { color: "#b4182f" } },
  { id: "coin-pack-500", name: "500 Yard Coin", kind: "coin_pack", icon: "🪙", priceCents: 199, meta: { coins: 500 } },
  { id: "coin-pack-1500", name: "1,500 Yard Coin", kind: "coin_pack", icon: "🪙", priceCents: 499, meta: { coins: 1500 } },
  { id: "coin-pack-4000", name: "4,000 Yard Coin", kind: "coin_pack", icon: "🪙", priceCents: 999, meta: { coins: 4000 } },
  {
    id: "halloween-glow-fit",
    name: "Glow Yard Fit",
    kind: "cosmetic",
    icon: "🎃",
    priceCoins: 200,
    meta: { color: "#ff7518" },
    seasonal: "halloween",
  },
  {
    id: "halloween-midnight-fit",
    name: "Midnight Fit",
    kind: "cosmetic",
    icon: "🦇",
    priceCoins: 200,
    meta: { color: "#4b0082" },
    seasonal: "halloween",
  },
  {
    id: "halloween-coin-pack-2000",
    name: "Spooky Bundle: 2,000 Yard Coin",
    kind: "coin_pack",
    icon: "🪙",
    priceCents: 399,
    meta: { coins: 2000 },
    seasonal: "halloween",
    discountPct: 20,
    saleLabel: "🎃 Harvest Bash Sale",
  },
];

const batch = db.batch();
for (const item of items) {
  const { id, ...data } = item;
  batch.set(db.collection("storeItems").doc(id), { active: true, ...data });
}
await batch.commit();
console.log(`Seeded ${items.length} store items.`);
