import { supabase, ONLINE } from "../supabase.js";
import { getState } from "../auth.js";

const MEDALS = ["🥇", "🥈", "🥉"];

export function mountLeaderboard(root, { onClose } = {}) {
  if (!ONLINE) {
    root.innerHTML = `
      <div class="modal">
        <h3>🏅 Yard Leaderboard</h3>
        <p>Rankings are powered by real Yard Coin earnings across every player. Connect Supabase (see <code>supabase/README.md</code>) to turn this on.</p>
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
  const myId = getState().user?.id;

  supabase
    .from("leaderboard_view")
    .select("*")
    .limit(25)
    .then(({ data, error }) => {
      if (error) {
        listEl.textContent = "Couldn't load the leaderboard: " + error.message;
        return;
      }
      if (!data?.length) {
        listEl.innerHTML = '<div style="opacity:0.5;font-size:13px;text-align:center;padding:10px;">No one has earned Yard Coin yet — be the first.</div>';
        return;
      }
      listEl.innerHTML = "";
      data.forEach((row, i) => {
        const row_el = document.createElement("div");
        row_el.className = "lb-row" + (row.user_id === myId ? " lb-me" : "");
        row_el.innerHTML = `
          <span class="lb-rank">${MEDALS[i] || "#" + (i + 1)}</span>
          <span class="lb-name">${row.display_name}</span>
          <span class="lb-coins">🪙 ${row.lifetime_earned}</span>`;
        listEl.appendChild(row_el);
      });
    });

  root.querySelector(".close").addEventListener("click", () => onClose?.());
}
