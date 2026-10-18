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
