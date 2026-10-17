const CODES = [
  { code: "143", phrase: "I love you" },
  { code: "07734", phrase: "HELLO (read it upside down)" },
  { code: "911", phrase: "Call me now, it's urgent" },
  { code: "182", phrase: "I hate you" },
  { code: "411", phrase: "Give me the info" },
  { code: "831", phrase: "I love you (8 letters, 3 words, 1 meaning)" },
];
const ROUND_MS = 9000;

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function mountPager(root, { onClose } = {}) {
  const rounds = shuffled(CODES);
  const state = { round: 0, score: 0, input: "", timer: null, deadline: 0 };

  root.innerHTML = `
    <div class="modal game-modal">
      <h3>📟 Page Somebody</h3>
      <div class="game-score">Round <span id="pg-round">1</span>/${rounds.length} &nbsp;·&nbsp; Score <b id="pg-score">0</b></div>
      <div class="pager-phrase" id="pg-phrase"></div>
      <div class="pager-screen"><span id="pg-display">&nbsp;</span></div>
      <div class="pager-timebar"><div class="pager-timefill" id="pg-timefill"></div></div>
      <div class="game-log" id="pg-log">Type the beeper code, then hit Page.</div>
      <div class="pager-keypad" id="pg-keypad"></div>
      <button class="btn btn-secondary close" style="margin-top:12px;width:100%;">Hang up</button>
    </div>`;

  const phraseEl = root.querySelector("#pg-phrase");
  const displayEl = root.querySelector("#pg-display");
  const logEl = root.querySelector("#pg-log");
  const scoreEl = root.querySelector("#pg-score");
  const roundEl = root.querySelector("#pg-round");
  const keypadEl = root.querySelector("#pg-keypad");
  const timefillEl = root.querySelector("#pg-timefill");

  const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⏎"];
  KEYS.forEach((k) => {
    const btn = document.createElement("button");
    btn.className = "step-btn pager-key";
    btn.textContent = k;
    btn.addEventListener("click", () => handleKey(k));
    keypadEl.appendChild(btn);
  });

  function startRound() {
    if (state.round >= rounds.length) return finish();
    state.input = "";
    state.deadline = performance.now() + ROUND_MS;
    phraseEl.textContent = `"${rounds[state.round].phrase}"`;
    roundEl.textContent = state.round + 1;
    logEl.textContent = "Type the beeper code, then hit Page.";
    render();
    tick();
  }

  function tick() {
    clearTimeout(state.timer);
    const remain = state.deadline - performance.now();
    const pct = Math.max(0, remain / ROUND_MS) * 100;
    timefillEl.style.width = pct + "%";
    if (remain <= 0) return submit(true);
    state.timer = setTimeout(tick, 100);
  }

  function render() {
    displayEl.textContent = state.input || " ";
  }

  function handleKey(k) {
    if (k === "C") state.input = "";
    else if (k === "⏎") submit(false);
    else if (state.input.length < 6) state.input += k;
    render();
  }

  function submit(timedOut) {
    clearTimeout(state.timer);
    const correct = !timedOut && state.input === rounds[state.round].code;
    if (correct) {
      const bonus = Math.max(0, Math.round((state.deadline - performance.now()) / ROUND_MS * 40));
      const points = 60 + bonus;
      state.score += points;
      logEl.textContent = `✅ Correct! +${points}`;
    } else {
      logEl.textContent = timedOut
        ? `⌛ Too slow — it was ${rounds[state.round].code}.`
        : `❌ Nah — it was ${rounds[state.round].code}.`;
    }
    scoreEl.textContent = state.score;
    state.round++;
    setTimeout(startRound, 1100);
  }

  function finish() {
    const grade = state.score >= 500 ? "S" : state.score >= 350 ? "A" : state.score >= 180 ? "B" : "C";
    phraseEl.textContent = "";
    displayEl.textContent = "";
    timefillEl.style.width = "0%";
    logEl.innerHTML = `Pager grade: <b>${grade}</b> — ${state.score} pts. ${
      grade === "S" ? "Everybody's hitting you up." : "Keep practicing your codes."
    }`;
    keypadEl.querySelectorAll("button").forEach((b) => (b.disabled = true));
    const again = document.createElement("button");
    again.className = "btn btn-primary";
    again.style.cssText = "margin-top:8px;width:100%;";
    again.textContent = "Page again";
    again.addEventListener("click", () => mountPager(root, { onClose }));
    root.querySelector(".game-modal").insertBefore(again, root.querySelector(".close"));
  }

  root.querySelector(".close").addEventListener("click", () => {
    clearTimeout(state.timer);
    onClose?.();
  });
  startRound();
}
