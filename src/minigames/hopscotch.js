// Hopscotch — chalk-on-the-sidewalk, right alongside Double Dutch. Hop the
// numbered squares in order (1-8) before time runs out on each one.
import { earnCoins } from "../economy.js";
import { playSuccess, playFail } from "../sound.js";
import { unlockAchievement } from "../achievements.js";

const GRADE_COINS = { S: 100, A: 70, B: 40, C: 15 };
const SQUARES = 8;
const HOP_MS = 950;

export function mountHopscotch(root, { onClose } = {}) {
  const state = { square: 1, score: 0, judged: false, windowStart: 0, timer: null };

  root.innerHTML = `
    <div class="modal game-modal">
      <h3>🩴 Hopscotch</h3>
      <div class="game-score">Square <span id="hs-square">1</span>/${SQUARES} &nbsp;·&nbsp; Score <b id="hs-score">0</b></div>
      <div class="hopscotch-grid" id="hs-grid"></div>
      <div class="pager-timebar"><div class="pager-timefill" id="hs-timefill"></div></div>
      <div class="game-log" id="hs-log">Hop square 1 — press the number key or tap it.</div>
      <button class="btn btn-secondary close" style="margin-top:12px;width:100%;">Hop off</button>
    </div>`;

  const gridEl = root.querySelector("#hs-grid");
  const logEl = root.querySelector("#hs-log");
  const scoreEl = root.querySelector("#hs-score");
  const squareNumEl = root.querySelector("#hs-square");
  const fillEl = root.querySelector("#hs-timefill");

  for (let i = 1; i <= SQUARES; i++) {
    const sq = document.createElement("div");
    sq.className = "hopscotch-sq";
    sq.dataset.n = i;
    sq.textContent = i;
    sq.addEventListener("click", () => judge(i));
    gridEl.appendChild(sq);
  }

  function squareEl(n) {
    return gridEl.querySelector(`[data-n="${n}"]`);
  }

  function nextSquare() {
    if (state.square > SQUARES) return finish();
    state.judged = false;
    state.windowStart = performance.now();
    gridEl.querySelectorAll(".hopscotch-sq").forEach((el) => el.classList.remove("hopscotch-active", "hopscotch-hit", "hopscotch-miss"));
    squareEl(state.square)?.classList.add("hopscotch-active");
    squareNumEl.textContent = state.square;
    logEl.textContent = `Hop square ${state.square}!`;
    fillEl.style.transition = "none";
    fillEl.style.width = "100%";
    void fillEl.offsetWidth;
    fillEl.style.transition = `width ${HOP_MS}ms linear`;
    fillEl.style.width = "0%";

    clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      if (!state.judged) judge(null);
    }, HOP_MS);
  }

  function judge(n) {
    if (state.judged) return;
    const correct = n === state.square;
    if (!correct && n !== null) return; // wrong square tapped, ignore — only a timeout or the right one judges
    state.judged = true;
    clearTimeout(state.timer);
    const elapsed = performance.now() - state.windowStart;
    let grade, points;
    if (!correct) {
      grade = "MISS";
      points = 0;
      squareEl(state.square)?.classList.add("hopscotch-miss");
    } else if (elapsed < HOP_MS * 0.45) {
      grade = "PERFECT";
      points = 100;
      squareEl(state.square)?.classList.add("hopscotch-hit");
    } else if (elapsed < HOP_MS * 0.8) {
      grade = "GOOD";
      points = 60;
      squareEl(state.square)?.classList.add("hopscotch-hit");
    } else {
      grade = "LATE";
      points = 20;
      squareEl(state.square)?.classList.add("hopscotch-hit");
    }
    state.score += points;
    scoreEl.textContent = state.score;
    logEl.textContent = `${grade}${points ? " +" + points : ""}`;
    state.square++;
    setTimeout(nextSquare, 260);
  }

  function finish() {
    const avg = state.score / SQUARES;
    const grade = avg >= 90 ? "S" : avg >= 70 ? "A" : avg >= 45 ? "B" : "C";
    fillEl.style.width = "0%";
    logEl.innerHTML = `Hopscotch grade: <b>${grade}</b> — ${state.score} pts. ${
      grade === "S" ? "Perfect hops, every square." : "Chalk it up and try again."
    }`;
    grade === "C" ? playFail() : playSuccess();
    if (grade === "S") unlockAchievement("hopscotch_champ");
    const again = document.createElement("button");
    again.className = "btn btn-primary";
    again.style.cssText = "margin-top:8px;width:100%;";
    again.textContent = "Chalk a new grid";
    again.addEventListener("click", () => mountHopscotch(root, { onClose }));
    root.querySelector(".game-modal").insertBefore(again, root.querySelector(".close"));
    gridEl.querySelectorAll(".hopscotch-sq").forEach((el) => (el.style.pointerEvents = "none"));

    const coins = GRADE_COINS[grade];
    earnCoins(coins, "hopscotch grade " + grade).then((r) => {
      if (r.ok) logEl.innerHTML += ` <br/>+${coins} 🪙 (${r.balance} total)`;
    });
    window.removeEventListener("keydown", onKey);
  }

  function onKey(e) {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= SQUARES) {
      e.preventDefault();
      judge(n);
    }
  }
  window.addEventListener("keydown", onKey);

  root.querySelector(".close").addEventListener("click", () => {
    clearTimeout(state.timer);
    window.removeEventListener("keydown", onKey);
    onClose?.();
  });

  nextSquare();
}
