import { supabase, ONLINE } from "../supabase.js";
import { getState } from "../auth.js";
import { getBalance } from "../economy.js";

export function mountStore(root, { onClose } = {}) {
  if (!ONLINE) {
    root.innerHTML = `
      <div class="modal">
        <h3>🛍️ The Yard Store</h3>
        <p>Cosmetics bought with Yard Coin, plus coin packs via Stripe Checkout (server-side — no card details ever touch this app directly). Connect Supabase (see <code>supabase/README.md</code>) to turn this on.</p>
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
    const { data: items, error } = await supabase
      .from("store_items")
      .select("*")
      .eq("active", true)
      .order("price_coins", { ascending: true, nullsFirst: false });
    if (error) {
      gridEl.textContent = "Couldn't load the store: " + error.message;
      return;
    }
    let owned = new Set();
    if (authState.user) {
      const { data: inv } = await supabase.from("inventory").select("item_id").eq("user_id", authState.user.id);
      owned = new Set((inv || []).map((i) => i.item_id));
    }

    gridEl.innerHTML = "";
    (items || []).forEach((item) => {
      const card = document.createElement("div");
      card.className = "store-card";
      const isOwned = item.kind === "cosmetic" && owned.has(item.id);
      const priceLabel = item.price_coins != null ? `🪙 ${item.price_coins}` : `$${(item.price_cents / 100).toFixed(2)}`;
      card.innerHTML = `
        <div class="store-icon">${item.icon}</div>
        <div class="store-name">${item.name}</div>
        <div class="store-price">${isOwned ? "Owned" : priceLabel}</div>
        <button class="btn ${isOwned ? "btn-secondary" : "btn-primary"}" ${isOwned ? "disabled" : ""}>
          ${isOwned ? "✓" : item.price_coins != null ? "Buy" : "Checkout"}
        </button>`;
      if (!isOwned) {
        card.querySelector("button").addEventListener("click", () => buy(item));
      }
      gridEl.appendChild(card);
    });
  }

  async function buy(item) {
    if (!authState.user) {
      alert("Join the Yard first (Sign up / Log in) to buy something.");
      return;
    }
    if (item.price_coins != null) {
      const { data, error } = await supabase.rpc("purchase_with_coins", { p_item_id: item.id });
      if (error) {
        alert(error.message.includes("insufficient") ? "Not enough Yard Coin." : "Couldn't buy: " + error.message);
        return;
      }
      root.querySelector("#store-balance").textContent = `🪙 ${data}`;
      render();
      return;
    }

    // Cash item: ask the Edge Function to create a Stripe Checkout Session.
    // This fails gracefully with a clear message until that function is
    // deployed and Stripe secrets are configured (see supabase/README.md).
    const { data, error } = await supabase.functions.invoke("create-checkout-session", {
      body: { item_id: item.id },
    });
    if (error || !data?.url) {
      alert("Payments aren't set up yet on this deployment — see supabase/README.md to turn on Stripe.");
      return;
    }
    window.location.href = data.url;
  }

  render();
  root.querySelector(".close").addEventListener("click", () => onClose?.());
}
