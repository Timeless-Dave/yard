import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db, ONLINE } from "../firebase.js";
import { getState } from "../auth.js";
import { esc } from "../text.js";

const MEDALS = ["🥇", "🥈", "🥉"];

export function mountLeaderboard(root, { onClose } = {}) {
  if (!ONLINE) {
    root.innerHTML = `
      <div class="modal">
        <h3>🏅 Yard Leaderboard</h3>
        <p>Rankings are powered by real Yard Coin earnings across every player. Online play isn't switched on for this copy of The Yard yet.</p>
        <button class="btn btn-primary close" style="width:100%;">Close</button>
      </div>`;
    root.querySelector(".close").addEventListener("click", () => onClose?.());
    return;
  }

  root.innerHTML = `
    <div class="modal game-modal">
      <h3>🏅 Yard Leaderboard</h3>
      <p class="corkboard-sub">Ranked by lifetime Yard Coin earned — spending never costs you rank.</p>
      <div class="leaderboard-list" id="lb-list">Loading...</div>
      <button class="btn btn-secondary close" style="margin-top:12px;width:100%;">Close</button>
    </div>`;

  const listEl = root.querySelector("#lb-list");
  const myId = getState().user?.uid;

  getDocs(query(collection(db, "wallets"), orderBy("lifetimeEarned", "desc"), limit(25)))
    .then((snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (!rows.length) {
        listEl.innerHTML = '<div style="opacity:0.5;font-size:13px;text-align:center;padding:10px;">No one has earned Yard Coin yet — be the first.</div>';
        return;
      }
      listEl.innerHTML = "";
      rows.forEach((row, i) => {
        const rowEl = document.createElement("div");
        rowEl.className = "lb-row" + (row.id === myId ? " lb-me" : "");
        rowEl.innerHTML = `
          <span class="lb-rank">${MEDALS[i] || "#" + (i + 1)}</span>
          <span class="lb-name">${esc(row.displayName || "Golden Lion")}</span>
          <span class="lb-coins">🪙 ${Number(row.lifetimeEarned) || 0}</span>`;
        listEl.appendChild(rowEl);
      });
    })
    .catch((e) => {
      listEl.textContent = "Couldn't load the leaderboard: " + e.message;
    });

  root.querySelector(".close").addEventListener("click", () => onClose?.());
}
