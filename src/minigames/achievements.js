import { ACHIEVEMENTS, getUnlocked, onAchievementsChange } from "../achievements.js";
import { ONLINE } from "../firebase.js";

export function mountAchievements(root, { onClose } = {}) {
  root.innerHTML = `
    <div class="modal game-modal">
      <h3>🏅 Homecoming Checklist</h3>
      <p class="corkboard-sub" id="ach-progress"></p>
      <div class="achievement-grid" id="ach-grid"></div>
      ${ONLINE ? "" : '<p class="corkboard-sub">Saved on this device for now — sign in online to carry it across devices and earn Yard Coin for each one.</p>'}
      <button class="btn btn-secondary close" style="margin-top:12px;width:100%;">Close</button>
    </div>`;

  const gridEl = root.querySelector("#ach-grid");
  const progressEl = root.querySelector("#ach-progress");

  const unsubscribe = onAchievementsChange((unlocked) => {
    progressEl.innerHTML = `<b>${unlocked.size} / ${ACHIEVEMENTS.length}</b> unlocked`;
    gridEl.innerHTML = "";
    ACHIEVEMENTS.forEach((a) => {
      const done = unlocked.has(a.id);
      const card = document.createElement("div");
      card.className = "store-card" + (done ? "" : " achievement-locked");
      card.innerHTML = `
        <div class="store-icon">${done ? a.icon : "🔒"}</div>
        <div class="store-name">${a.name}</div>
        <div class="store-price">${a.desc}</div>`;
      gridEl.appendChild(card);
    });
  });

  root.querySelector(".close").addEventListener("click", () => onClose?.());
  return unsubscribe;
}
