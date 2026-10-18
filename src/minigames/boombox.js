import { startBoombox, stopBoombox, isBoomboxPlaying, playClick } from "../sound.js";
import { unlockAchievement } from "../achievements.js";

const GENRES = [
  { id: "old_school", label: "🎶 Old School Soul" },
  { id: "go_go", label: "🥁 Go-Go" },
  { id: "bounce", label: "🔊 Bounce" },
];

export function mountBoombox(root, { onClose } = {}) {
  root.innerHTML = `
    <div class="modal">
      <h3>📻 Boombox</h3>
      <p>Bring the block party. Pick a vibe — it keeps playing on the Yard until you turn it off or walk away.</p>
      <div class="leaderboard-list" id="bb-genres"></div>
      <button class="btn btn-secondary" id="bb-stop" style="width:100%;margin-top:8px;">⏹️ Turn it off</button>
      <button class="btn btn-secondary close" style="width:100%;margin-top:8px;">Close</button>
    </div>`;

  const listEl = root.querySelector("#bb-genres");
  GENRES.forEach((g) => {
    const row = document.createElement("div");
    row.className = "lb-row";
    row.innerHTML = `<span class="lb-rank">${g.label.split(" ")[0]}</span><span class="lb-name">${g.label.slice(2)}</span>
      <button class="btn btn-primary" style="padding:6px 12px;font-size:12px;">Play</button>`;
    row.querySelector("button").addEventListener("click", () => {
      playClick();
      startBoombox(g.id);
      unlockAchievement("dj_yard");
    });
    listEl.appendChild(row);
  });

  root.querySelector("#bb-stop").addEventListener("click", () => {
    playClick();
    stopBoombox();
  });

  root.querySelector(".close").addEventListener("click", () => onClose?.());
}

export { isBoomboxPlaying };
