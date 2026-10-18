// Procedural sound effects via the Web Audio API — no audio files, so
// nothing licensed/copyrighted ever ships with this app. Just short
// synthesized tones for UI feedback (clicks, coin earns, win/lose, etc).
const STORAGE_KEY = "yard-sound-muted";
let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem(STORAGE_KEY) === "1";
} catch {
  /* storage unavailable, default unmuted */
}

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq, { duration = 0.12, type = "sine", delay = 0, gain = 0.18, slideTo = null } = {}) {
  if (muted) return;
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime + delay);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + delay + duration);
    g.gain.setValueAtTime(gain, c.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
    osc.connect(g).connect(c.destination);
    osc.start(c.currentTime + delay);
    osc.stop(c.currentTime + delay + duration + 0.02);
  } catch {
    /* audio unavailable (autoplay-blocked, no AudioContext, etc.) — fail silently */
  }
}

export function playClick() {
  tone(520, { duration: 0.06, type: "square", gain: 0.08 });
}

export function playOpen() {
  tone(440, { duration: 0.08, type: "sine" });
  tone(660, { duration: 0.1, delay: 0.05, type: "sine" });
}

export function playClose() {
  tone(440, { duration: 0.08, type: "sine", slideTo: 220 });
}

export function playCoin() {
  tone(880, { duration: 0.08, type: "square", gain: 0.12 });
  tone(1320, { duration: 0.12, delay: 0.06, type: "square", gain: 0.1 });
}

export function playSuccess() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, { duration: 0.14, delay: i * 0.08, type: "triangle", gain: 0.14 }));
}

export function playFail() {
  tone(300, { duration: 0.3, type: "sawtooth", slideTo: 110, gain: 0.12 });
}

export function playDrumline() {
  // snare-ish hits + a brass stab, roughly drumline-and-horns flavored
  [0, 0.12, 0.24, 0.3, 0.42].forEach((d) => tone(180, { duration: 0.05, delay: d, type: "square", gain: 0.1 }));
  tone(330, { duration: 0.35, delay: 0.42, type: "sawtooth", gain: 0.14 });
  tone(440, { duration: 0.35, delay: 0.42, type: "sawtooth", gain: 0.1 });
}

// ---- Boombox — a looping procedural beat, bring-your-own-block-party ----
const BOOMBOX_GENRES = {
  old_school: { bpm: 96, kick: 90, snare: 220, hat: 2200 },
  go_go: { bpm: 112, kick: 80, snare: 260, hat: 2600 },
  bounce: { bpm: 128, kick: 70, snare: 300, hat: 3000 },
};
let boomboxTimer = null;
let boomboxStep = 0;

export function startBoombox(genre = "old_school") {
  stopBoombox();
  const cfg = BOOMBOX_GENRES[genre] || BOOMBOX_GENRES.old_school;
  const stepMs = 60000 / cfg.bpm / 2; // 8th notes
  boomboxStep = 0;
  function tick() {
    const beatInBar = boomboxStep % 8;
    if (beatInBar === 0 || beatInBar === 4) tone(cfg.kick, { duration: 0.12, type: "sine", gain: 0.2 });
    if (beatInBar === 2 || beatInBar === 6) tone(cfg.snare, { duration: 0.08, type: "triangle", gain: 0.14 });
    if (beatInBar % 2 === 0) tone(cfg.hat, { duration: 0.03, type: "square", gain: 0.05 });
    boomboxStep++;
  }
  tick();
  boomboxTimer = setInterval(tick, stepMs);
}

export function stopBoombox() {
  if (boomboxTimer) {
    clearInterval(boomboxTimer);
    boomboxTimer = null;
  }
}

export function isBoomboxPlaying() {
  return boomboxTimer !== null;
}

export function playNotify() {
  tone(740, { duration: 0.1, type: "sine" });
  tone(740, { duration: 0.1, delay: 0.14, type: "sine" });
}

export function isMuted() {
  return muted;
}

export function setMuted(on) {
  muted = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
}

export function toggleMuted() {
  setMuted(!muted);
  return muted;
}
