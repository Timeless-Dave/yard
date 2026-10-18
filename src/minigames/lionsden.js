import { unlockAchievement } from "../achievements.js";
import { earnCoins } from "../economy.js";
import { isPrettyWednesday } from "../seasonal.js";

export function mountLionsDen(root, { onClose } = {}) {
  const pretty = isPrettyWednesday();

  root.innerHTML = pretty
    ? `
    <div class="modal">
      <h3>✨ Pretty Wednesday at the Lions Den</h3>
      <p>Every Wednesday the Den dresses the Yard up right — come through
      looking like money and catch up with everybody before class.</p>
      <button class="btn btn-primary" id="den-pull-up" style="width:100%;">🦁 Pull up</button>
      <button class="btn btn-secondary close" style="width:100%;margin-top:8px;">Close</button>
    </div>`
    : `
    <div class="modal">
      <h3>🦁 The Lions Den</h3>
      <p>The go-to hangout spot on the Yard — grab a seat, catch up with
      people. Come back on a Wednesday for Pretty Wednesday.</p>
      <button class="btn btn-secondary close" style="width:100%;">Close</button>
    </div>`;

  root.querySelector("#den-pull-up")?.addEventListener("click", () => {
    unlockAchievement("pretty_wednesday");
    earnCoins("lions_den");
  });
  root.querySelector(".close").addEventListener("click", () => onClose?.());
}
