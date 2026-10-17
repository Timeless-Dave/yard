import { earnCoins } from "../economy.js";

const GRADE_COINS = { S: 100, A: 70, B: 40, C: 15 };
const FOODS = ["🍔 Burgers", "🌭 Hot Dogs", "🍗 Chicken", "🌽 Corn", "🍖 Ribs"];
const DURATION_MS = 2400;
const ZONES = { perfectLo: 64, perfectHi: 80, goodLo: 50, goodHi: 92 };

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function gradeFor(v) {
  if (v >= ZONES.perfectLo && v <= ZONES.perfectHi) return { grade: "PERFECT FLIP", pts: 100 };
  if (v >= ZONES.goodLo && v <= ZONES.goodHi) return { grade: "GOOD", pts: 55 };
  if (v < ZONES.goodLo) return { grade: "STILL RAW", pts: 15 };
  return { grade: "BURNT 🔥", pts: 0 };
}

export function mountCookout(root, { onClose } = {}) {
  const rounds = shuffled(FOODS);
  const state = { round: 0, score: 0, raf: null, start: 0, done: false };

  root.innerHTML = `
    <div class="modal game-modal">
      <h3>🔥 Cookout Cook-Off</h3>
      <div class="game-score">Round <span id="ck-round">1</span>/${rounds.length} &nbsp;·&nbsp; Score <b id="ck-score">0</b></div>
      <div class="cook-food" id="ck-food"></div>
      <div class="cook-bar">
        <div class="cook-zone cook-zone-good" style="left:${ZONES.goodLo}%;width:${ZONES.goodHi - ZONES.goodLo}%;"></div>
        <div class="cook-zone cook-zone-perfect" style="left:${ZONES.perfectLo}%;width:${ZONES.perfectHi - ZONES.perfectLo}%;"></div>
        <div class="cook-marker" id="ck-marker"></div>
      </div>
      <div class="game-log" id="ck-log">Flip it right as the marker hits the gold zone.</div>
      <button class="btn btn-primary" id="ck-flip" style="width:100%;">🔁 Flip!</button>
      <button class="btn btn-secondary close" style="margin-top:12px;width:100%;">Step away from the grill</button>
    </div>`;

  const foodEl = root.querySelector("#ck-food");
  const markerEl = root.querySelector("#ck-marker");
  const logEl = root.querySelector("#ck-log");
  const scoreEl = root.querySelector("#ck-score");
  const roundEl = root.querySelector("#ck-round");
  const flipBtn = root.querySelector("#ck-flip");

  function startRound() {
    if (state.round >= rounds.length) return finish();
    foodEl.textContent = rounds[state.round];
    roundEl.textContent = state.round + 1;
    logEl.textContent = "Flip it right as the marker hits the gold zone.";
    flipBtn.disabled = false;
    state.start = performance.now();
    tick();
  }

  function currentPct() {
    return Math.min(100, ((performance.now() - state.start) / DURATION_MS) * 100);
  }

  function tick() {
    const pct = currentPct();
    markerEl.style.left = pct + "%";
    if (pct >= 100) {
      resolveFlip(100);
      return;
    }
    state.raf = requestAnimationFrame(tick);
  }

  function resolveFlip(pct) {
    cancelAnimationFrame(state.raf);
    flipBtn.disabled = true;
    const { grade, pts } = gradeFor(pct);
    state.score += pts;
    scoreEl.textContent = state.score;
    logEl.textContent = `${grade}${pts ? " +" + pts : ""}`;
    state.round++;
    setTimeout(startRound, 900);
  }

  flipBtn.addEventListener("click", () => resolveFlip(currentPct()));

  function finish() {
    cancelAnimationFrame(state.raf);
    const avg = state.score / rounds.length;
    const grade = avg >= 90 ? "S" : avg >= 65 ? "A" : avg >= 35 ? "B" : "C";
    foodEl.textContent = "🍽️";
    markerEl.style.left = "0%";
    flipBtn.remove();
    logEl.innerHTML = `Pitmaster grade: <b>${grade}</b> — ${state.score} pts. ${
      grade === "S" ? "You're running the grill next homecoming." : "A little more practice at the grill."
    }`;
    const again = document.createElement("button");
    again.className = "btn btn-primary";
    again.style.cssText = "margin-top:8px;width:100%;";
    again.textContent = "Fire it back up";
    again.addEventListener("click", () => mountCookout(root, { onClose }));
    root.querySelector(".game-modal").insertBefore(again, root.querySelector(".close"));

    const coins = GRADE_COINS[grade];
    earnCoins(coins, "cookout grade " + grade).then((r) => {
      if (r.ok) logEl.innerHTML += ` <br/>+${coins} 🪙 (${r.balance} total)`;
    });
  }

  root.querySelector(".close").addEventListener("click", () => {
    cancelAnimationFrame(state.raf);
    onClose?.();
  });
  startRound();
}
