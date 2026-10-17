import { earnCoins } from "../economy.js";
import { playSuccess, playFail } from "../sound.js";
import { unlockAchievement } from "../achievements.js";

const GRADE_COINS = { S: 100, A: 70, B: 40, C: 15 };
const ARROWS = [
  { key: "arrowup", sym: "↑" },
  { key: "arrowdown", sym: "↓" },
  { key: "arrowleft", sym: "←" },
  { key: "arrowright", sym: "→" },
];
const BEAT_MS = 850;
const TOTAL_BEATS = 8;

function randomArrow(exclude) {
  let a;
  do {
    a = ARROWS[Math.floor(Math.random() * ARROWS.length)];
  } while (exclude && a.key === exclude.key && ARROWS.length > 1);
  return a;
}

export function mountStepShow(root, { onClose } = {}) {
  const state = {
    beat: 0,
    score: 0,
    current: null,
    windowStart: 0,
    judged: false,
    timer: null,
    results: [],
  };

  root.innerHTML = `
    <div class="modal game-modal">
      <h3>🕺 Step Show Rehearsal</h3>
      <div class="game-score">Beat <span id="beat-num">1</span>/${TOTAL_BEATS} &nbsp;·&nbsp; Score <b id="step-score">0</b></div>
      <div class="step-stage">
        <div class="step-ring" id="step-ring"></div>
        <div class="step-arrow" id="step-arrow">↑</div>
      </div>
      <div class="game-log" id="step-log">Hit the arrow on the beat. Arrow keys or tap.</div>
      <div class="step-buttons">
        <button class="step-btn" data-key="arrowleft">←</button>
        <button class="step-btn" data-key="arrowup">↑</button>
        <button class="step-btn" data-key="arrowdown">↓</button>
        <button class="step-btn" data-key="arrowright">→</button>
      </div>
      <button class="btn btn-secondary close" style="margin-top:12px;width:100%;">Leave rehearsal</button>
    </div>`;

  const arrowEl = root.querySelector("#step-arrow");
  const ringEl = root.querySelector("#step-ring");
  const logEl = root.querySelector("#step-log");
  const scoreEl = root.querySelector("#step-score");
  const beatNumEl = root.querySelector("#beat-num");

  function nextBeat() {
    if (state.beat >= TOTAL_BEATS) return finish();
    state.current = randomArrow(state.current);
    state.judged = false;
    state.windowStart = performance.now();
    arrowEl.textContent = state.current.sym;
    arrowEl.className = "step-arrow";
    ringEl.style.animation = "none";
    void ringEl.offsetWidth;
    ringEl.style.animation = `stepRing ${BEAT_MS}ms linear`;
    beatNumEl.textContent = state.beat + 1;

    clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      if (!state.judged) judge(null);
    }, BEAT_MS);
  }

  function judge(pressedKey) {
    if (state.judged) return;
    state.judged = true;
    clearTimeout(state.timer);
    const elapsed = performance.now() - state.windowStart;
    const correct = pressedKey === state.current.key;
    let grade, points;
    if (!correct) {
      grade = "MISS";
      points = 0;
    } else if (elapsed < BEAT_MS * 0.45) {
      grade = "PERFECT";
      points = 100;
    } else if (elapsed < BEAT_MS * 0.8) {
      grade = "GOOD";
      points = 60;
    } else {
      grade = "LATE";
      points = 20;
    }
    state.score += points;
    state.results.push(grade);
    scoreEl.textContent = state.score;
    arrowEl.classList.add(grade === "MISS" ? "grade-miss" : "grade-hit");
    logEl.textContent = `${grade}${points ? " +" + points : ""}`;
    state.beat++;
    setTimeout(nextBeat, 280);
  }

  function finish() {
    const avg = state.score / TOTAL_BEATS;
    const grade = avg >= 90 ? "S" : avg >= 70 ? "A" : avg >= 45 ? "B" : "C";
    ringEl.style.animation = "none";
    arrowEl.textContent = "🏆";
    logEl.innerHTML = `Rehearsal grade: <b>${grade}</b> — ${state.score} pts. ${
      grade === "S" ? "You're lead line for Homecoming." : "Keep drilling for the step show."
    }`;
    grade === "C" ? playFail() : playSuccess();
    if (grade === "S") unlockAchievement("step_perfect");
    const again = document.createElement("button");
    again.className = "btn btn-primary";
    again.style.cssText = "margin-top:8px;width:100%;";
    again.textContent = "Run it back";
    again.addEventListener("click", () => mountStepShow(root, { onClose }));
    root.querySelector(".game-modal").insertBefore(again, root.querySelector(".close"));
    root.querySelectorAll(".step-btn").forEach((b) => (b.disabled = true));

    const coins = GRADE_COINS[grade];
    earnCoins(coins, "stepshow grade " + grade).then((r) => {
      if (r.ok) logEl.innerHTML += ` <br/>+${coins} 🪙 (${r.balance} total)`;
    });
    window.removeEventListener("keydown", onKey);
  }

  function onKey(e) {
    const k = e.key.toLowerCase();
    if (ARROWS.some((a) => a.key === k)) {
      e.preventDefault();
      judge(k);
    }
  }
  window.addEventListener("keydown", onKey);

  root.querySelectorAll(".step-btn").forEach((btn) => {
    btn.addEventListener("click", () => judge(btn.dataset.key));
  });

  root.querySelector(".close").addEventListener("click", () => {
    clearTimeout(state.timer);
    window.removeEventListener("keydown", onKey);
    onClose?.();
  });

  nextBeat();
}
