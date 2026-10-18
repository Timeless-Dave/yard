// Double Dutch — the classic sidewalk/street-game staple, the thing this
// whole project started from: what people did on the block before phones.
// Two ropes turn on a beat; jump (Space or tap) when the ropes are at the
// bottom of their swing, same timing-window pattern as the step show.
import { earnCoins } from "../economy.js";
import { playSuccess, playFail } from "../sound.js";
import { unlockAchievement } from "../achievements.js";

const TURN_MS = 800;
const TOTAL_JUMPS = 10;

export function mountDoubleDutch(root, { onClose } = {}) {
  const state = { round: 0, score: 0, judged: false, windowStart: 0, timer: null, results: [] };

  root.innerHTML = `
    <div class="modal game-modal">
      <h3>🪢 Double Dutch</h3>
      <div class="game-score">Turn <span id="dd-round">1</span>/${TOTAL_JUMPS} &nbsp;·&nbsp; Score <b id="dd-score">0</b></div>
      <div class="step-stage">
        <div class="step-ring" id="dd-ring"></div>
        <div class="step-arrow" id="dd-rope">🪢</div>
      </div>
      <div class="pager-timebar"><div class="pager-timefill" id="dd-timefill"></div></div>
      <div class="game-log" id="dd-log">Jump when the ropes hit bottom — hit Space or tap Jump!</div>
      <button class="btn btn-primary" id="dd-jump" style="width:100%;margin-top:8px;">⤴️ Jump!</button>
      <button class="btn btn-secondary close" style="margin-top:12px;width:100%;">Step out</button>
    </div>`;

  const ropeEl = root.querySelector("#dd-rope");
  const ringEl = root.querySelector("#dd-ring");
  const logEl = root.querySelector("#dd-log");
  const scoreEl = root.querySelector("#dd-score");
  const roundEl = root.querySelector("#dd-round");
  const fillEl = root.querySelector("#dd-timefill");

  function nextTurn() {
    if (state.round >= TOTAL_JUMPS) return finish();
    state.judged = false;
    state.windowStart = performance.now();
    ropeEl.textContent = "🪢";
    ropeEl.className = "step-arrow";
    ringEl.style.animation = "none";
    void ringEl.offsetWidth;
    ringEl.style.animation = `stepRing ${TURN_MS}ms linear`;
    fillEl.style.transition = "none";
    fillEl.style.width = "100%";
    void fillEl.offsetWidth;
    fillEl.style.transition = `width ${TURN_MS}ms linear`;
    fillEl.style.width = "0%";
    roundEl.textContent = state.round + 1;

    clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      if (!state.judged) judge(false);
    }, TURN_MS);
  }

  function judge(pressed) {
    if (state.judged) return;
    state.judged = true;
    clearTimeout(state.timer);
    const elapsed = performance.now() - state.windowStart;
    let grade, points;
    if (!pressed) {
      grade = "TANGLED";
      points = 0;
    } else if (elapsed > TURN_MS * 0.55 && elapsed < TURN_MS * 0.95) {
      grade = "PERFECT";
      points = 100;
    } else if (elapsed > TURN_MS * 0.35) {
      grade = "GOOD";
      points = 55;
    } else {
      grade = "EARLY";
      points = 15;
    }
    state.score += points;
    state.results.push(grade);
    scoreEl.textContent = state.score;
    ropeEl.textContent = grade === "TANGLED" ? "😣" : "🙆";
    ropeEl.classList.add(grade === "TANGLED" ? "grade-miss" : "grade-hit");
    logEl.textContent = `${grade}${points ? " +" + points : ""}`;
    state.round++;
    setTimeout(nextTurn, 260);
  }

  function finish() {
    const avg = state.score / TOTAL_JUMPS;
    const grade = avg >= 90 ? "S" : avg >= 70 ? "A" : avg >= 45 ? "B" : "C";
    ringEl.style.animation = "none";
    ropeEl.textContent = "🏆";
    logEl.innerHTML = `Double Dutch grade: <b>${grade}</b> — ${state.score} pts. ${
      grade === "S" ? "You own the sidewalk." : "Keep turning — you'll get the rhythm."
    }`;
    grade === "C" ? playFail() : playSuccess();
    if (grade === "S") unlockAchievement("rope_champ");
    const again = document.createElement("button");
    again.className = "btn btn-primary";
    again.style.cssText = "margin-top:8px;width:100%;";
    again.textContent = "Jump back in";
    again.addEventListener("click", () => mountDoubleDutch(root, { onClose }));
    root.querySelector(".game-modal").insertBefore(again, root.querySelector(".close"));
    root.querySelector("#dd-jump").disabled = true;
    earnCoins("doubledutch", { grade }).then((r) => {
      if (r.ok) logEl.innerHTML += ` <br/>+${r.amount} 🪙 (${r.balance} total)`;
    });
    window.removeEventListener("keydown", onKey);
  }

  function onKey(e) {
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      judge(true);
    }
  }
  window.addEventListener("keydown", onKey);

  root.querySelector("#dd-jump").addEventListener("click", () => judge(true));

  root.querySelector(".close").addEventListener("click", () => {
    clearTimeout(state.timer);
    window.removeEventListener("keydown", onKey);
    onClose?.();
  });

  nextTurn();
}
