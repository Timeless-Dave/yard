import { collection, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions, ONLINE } from "../firebase.js";
import { getState, setAvatarColor } from "../auth.js";
import { getBalance } from "../economy.js";
import { getActiveSeason } from "../seasonal.js";
import { unlockAchievement } from "../achievements.js";

export function mountStore(root, { onClose } = {}) {
  if (!ONLINE) {
    root.innerHTML = `
      <div class="modal">
        <h3>🛍️ The Yard Store</h3>
        <p>Cosmetics bought with Yard Coin, plus coin packs via Stripe Checkout (server-side — no card details ever touch this app directly). Connect Firebase (see <code>firebase/README.md</code>) to turn this on.</p>
        <button class="btn btn-primary close" style="width:100%;">Close</button>
      </div>`;
    root.querySelector(".close").addEventListener("click", () => onClose?.());
    return;
  }

  const authState = getState();
  root.innerHTML = `
    <div class="modal game-modal">
      <h3>🛍️ The Yard Store</h3>
      <p class="corkboard-sub">Balance: <b id="store-balance">🪙 ${getBalance()}</b></p>
      <div class="store-grid" id="store-grid">Loading...</div>
      <button class="btn btn-secondary close" style="margin-top:12px;width:100%;">Close</button>
    </div>`;

  const gridEl = root.querySelector("#store-grid");
  root.querySelector("#store-balance").textContent = `🪙 ${getBalance()}`;

  async function render() {
    const activeSeason = getActiveSeason();
    let allItems;
    try {
      // No orderBy here: Firestore's orderBy silently excludes documents
      // missing the sorted field, which would hide every cash-priced item
      // (priceCoins is null on those) — sort client-side instead.
      const q = query(collection(db, "storeItems"), where("active", "==", true));
      const snap = await getDocs(q);
      allItems = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      allItems.sort((a, b) => {
        if (a.priceCoins == null && b.priceCoins == null) return 0;
        if (a.priceCoins == null) return 1;
        if (b.priceCoins == null) return -1;
        return a.priceCoins - b.priceCoins;
      });
    } catch (e) {
      gridEl.textContent = "Couldn't load the store: " + e.message;
      return;
    }
    // Seasonal items only show while their season is active.
    const items = allItems.filter((i) => !i.seasonal || i.seasonal === activeSeason?.id);

    let owned = new Set();
    if (authState.user) {
      const invSnap = await getDocs(collection(db, "inventory", authState.user.uid, "items"));
      owned = new Set(invSnap.docs.map((d) => d.id));
    }

    const equippedColor = getState().profile?.color;

    gridEl.innerHTML = "";
    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "store-card";
      const isOwned = item.kind === "cosmetic" && owned.has(item.id);
      const isEquipped = isOwned && item.meta?.color && item.meta.color === equippedColor;
      const basePrice = item.priceCoins != null ? item.priceCoins : item.priceCents / 100;
      const discounted = item.discountPct ? basePrice * (1 - item.discountPct / 100) : basePrice;
      const fmt = (v) => (item.priceCoins != null ? `🪙 ${Math.round(v)}` : `$${v.toFixed(2)}`);
      const priceHtml = item.discountPct
        ? `<s style="opacity:0.5;">${fmt(basePrice)}</s> ${fmt(discounted)}`
        : fmt(basePrice);
      const btnLabel = isEquipped ? "✓ Equipped" : isOwned ? "Equip" : item.priceCoins != null ? "Buy" : "Checkout";
      card.innerHTML = `
        ${item.saleLabel ? `<div class="store-sale-badge">${item.saleLabel}</div>` : ""}
        <div class="store-icon">${item.icon}</div>
        <div class="store-name">${item.name}</div>
        <div class="store-price">${isOwned ? (isEquipped ? "Equipped" : "Owned") : priceHtml}</div>
        <button class="btn ${isEquipped ? "btn-secondary" : "btn-primary"}" ${isEquipped ? "disabled" : ""}>
          ${btnLabel}
        </button>`;
      if (!isEquipped) {
        card.querySelector("button").addEventListener("click", () => (isOwned ? equip(item) : buy(item)));
      }
      gridEl.appendChild(card);
    });
  }

  async function equip(item) {
    if (!item.meta?.color) return;
    await setAvatarColor(item.meta.color);
    unlockAchievement("fresh_fit");
    render();
  }

  async function buy(item) {
    if (!authState.user) {
      alert("Join the Yard first (Sign up / Log in) to buy something.");
      return;
    }
    if (item.priceCoins != null) {
      try {
        const { data } = await httpsCallable(functions, "purchaseWithCoins")({ itemId: item.id });
        root.querySelector("#store-balance").textContent = `🪙 ${data.balance}`;
        if (item.kind === "cosmetic" && item.meta?.color) await setAvatarColor(item.meta.color);
        unlockAchievement("shopper");
        render();
      } catch (e) {
        alert(e.message.includes("insufficient") ? "Not enough Yard Coin." : "Couldn't buy: " + e.message);
      }
      return;
    }

    // Cash item: ask the Cloud Function to create a Stripe Checkout Session.
    // This fails gracefully with a clear message until that function is
    // deployed and Stripe secrets are configured (see firebase/README.md).
    try {
      const { data } = await httpsCallable(functions, "createCheckoutSession")({ itemId: item.id });
      if (!data?.url) throw new Error("no checkout url");
      window.location.href = data.url;
    } catch {
      alert("Payments aren't set up yet on this deployment — see firebase/README.md to turn on Stripe.");
    }
  }

  render();
  root.querySelector(".close").addEventListener("click", () => onClose?.());
}
