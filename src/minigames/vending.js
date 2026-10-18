import { spendCoins, getBalance } from "../economy.js";
import { ONLINE } from "../firebase.js";

const SNACKS = [
  { name: "Flamin' Hots 🔥", price: 5 },
  { name: "Honey Bun 🍯", price: 5 },
  { name: "Now & Laters 🍬", price: 4 },
  { name: "Arizona (the big can) 🥤", price: 6 },
  { name: "Gatorade 🧊", price: 6 },
  { name: "Chicken Noodle Soup Ramen 🍜", price: 4 },
  { name: "Takis 🌶️", price: 5 },
  { name: "Water (for the broke days) 💧", price: 2 },
];

export function mountVending(root, { onClose } = {}) {
  root.innerHTML = `
    <div class="modal game-modal">
      <h3>🥤 Vending Machine</h3>
      <p class="corkboard-sub">${ONLINE ? `Balance: <b>🪙 ${getBalance()}</b>` : "Sign in online to spend Yard Coin here — this one's just for show right now."}</p>
      <div class="store-grid" id="vend-grid"></div>
      <div class="game-log" id="vend-log"></div>
      <button class="btn btn-secondary close" style="margin-top:12px;width:100%;">Walk away</button>
    </div>`;

  const gridEl = root.querySelector("#vend-grid");
  const logEl = root.querySelector("#vend-log");
  const subEl = root.querySelector(".corkboard-sub");

  SNACKS.forEach((snack) => {
    const card = document.createElement("div");
    card.className = "store-card";
    card.innerHTML = `
      <div class="store-icon">🍫</div>
      <div class="store-name">${snack.name}</div>
      <div class="store-price">🪙 ${snack.price}</div>
      <button class="btn btn-primary">Buy</button>`;
    card.querySelector("button").addEventListener("click", async () => {
      if (!ONLINE) {
        logEl.textContent = "Online play isn't switched on for this copy of The Yard yet.";
        return;
      }
      const r = await spendCoins(snack.price, "vending: " + snack.name);
      if (!r.ok) {
        logEl.textContent = r.error === "offline" ? "Join the Yard first (Sign up / Log in)." : r.error;
        return;
      }
      logEl.textContent = `*clunk* Got your ${snack.name}. (🪙 ${r.balance} left)`;
      subEl.innerHTML = `Balance: <b>🪙 ${r.balance}</b>`;
    });
    gridEl.appendChild(card);
  });

  root.querySelector(".close").addEventListener("click", () => onClose?.());
}
