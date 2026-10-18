import { playDrumline } from "../sound.js";
import { unlockAchievement } from "../achievements.js";
import { earnCoins } from "../economy.js";

export function mountBand(root, { onClose } = {}) {
  root.innerHTML = `
    <div class="modal">
      <h3>🎺 M4 — Marching Musical Machine of the Mid-South</h3>
      <p>UAPB's own M4 has been the soundtrack of Homecoming since 1946 —
      Marching, Musical, Machine... of the Mid-South. Catch them running
      drill near the stadium and get the Yard hyped.</p>
      <button class="btn btn-primary" id="band-cheer" style="width:100%;">📣 Cheer for the band</button>
      <button class="btn btn-secondary close" style="width:100%;margin-top:8px;">Close</button>
    </div>`;

  root.querySelector("#band-cheer").addEventListener("click", () => {
    playDrumline();
    unlockAchievement("band_fan");
    earnCoins("band_cheer");
  });
  root.querySelector(".close").addEventListener("click", () => onClose?.());
}
