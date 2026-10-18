import { collection, doc, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { db, ONLINE } from "./firebase.js";
import { getState, onAuthChange } from "./auth.js";
import { earnCoins } from "./economy.js";
import { playSuccess } from "./sound.js";

const STORAGE_KEY = "yard-achievements-v1";

export const ACHIEVEMENTS = [
  { id: "first_steps", icon: "👟", name: "First Steps", desc: "Walk the Yard" },
  { id: "card_shark", icon: "♠️", name: "Card Shark", desc: "Win at Spades" },
  { id: "domino_king", icon: "🁢", name: "Domino King/Queen", desc: "Win at Dominoes" },
  { id: "step_perfect", icon: "🕺", name: "Lead Line", desc: "S grade in Step Show" },
  { id: "page_me", icon: "📟", name: "Page Me", desc: "S grade paging someone" },
  { id: "grill_master", icon: "🔥", name: "Grill Master", desc: "S grade at the cookout" },
  { id: "voter", icon: "🏆", name: "I Voted", desc: "Cast a Homecoming vote" },
  { id: "plot_owner", icon: "🏠", name: "Plot Owner", desc: "Claim a Divine Nine plot" },
  { id: "party_people", icon: "🎉", name: "Party People", desc: "RSVP to a party" },
  { id: "shopper", icon: "🛍️", name: "Certified Shopper", desc: "Buy something from the store" },
  { id: "fresh_fit", icon: "✨", name: "Fresh Fit", desc: "Equip a cosmetic" },
  { id: "corkboard_poster", icon: "📌", name: "Word on the Yard", desc: "Post to the corkboard" },
  { id: "night_owl", icon: "🌙", name: "Night Owl", desc: "Toggle Night Mode" },
  { id: "band_fan", icon: "🎺", name: "M4 Fan", desc: "Cheer the Marching Musical Machine of the Mid-South" },
  { id: "photo_op", icon: "📸", name: "Photo Op", desc: "Snap a photo at the Homecoming arch" },
  { id: "rope_champ", icon: "🪢", name: "Rope Champ", desc: "S grade in Double Dutch" },
  { id: "hopscotch_champ", icon: "🩴", name: "Hopscotch Champ", desc: "S grade in Hopscotch" },
  { id: "dj_yard", icon: "📻", name: "DJ on the Yard", desc: "Turn on the boombox" },
  { id: "yard_talk", icon: "💬", name: "Yard Talk", desc: "Send a message in Yard Chat" },
  { id: "pretty_wednesday", icon: "✨", name: "Pretty Wednesday", desc: "Pull up to the Lions Den on a Wednesday" },
];

function loadLocal() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function saveLocal(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* storage unavailable */
  }
}

let unlocked = loadLocal();
const listeners = new Set();
function emit() {
  listeners.forEach((fn) => fn(unlocked));
}

export function onAchievementsChange(fn) {
  listeners.add(fn);
  fn(unlocked);
  return () => listeners.delete(fn);
}

export function getUnlocked() {
  return unlocked;
}

// Records an unlock server-side and claims its one-time coin bonus (the
// server refuses a second claim, so retrying is harmless).
async function recordOnServer(user, id) {
  try {
    await setDoc(doc(db, "achievementProgress", user.uid, "unlocked", id), { earnedAt: serverTimestamp() });
  } catch {
    /* already recorded — rules only allow the first write */
  }
  await earnCoins("achievement", { achievementId: id });
}

// Two-way sync on sign-in: pull what the server knows, then push anything
// unlocked while offline or signed out.
async function syncWithServer(user) {
  const snap = await getDocs(collection(db, "achievementProgress", user.uid, "unlocked"));
  const onServer = new Set(snap.docs.map((d) => d.id));
  onServer.forEach((id) => unlocked.add(id));
  saveLocal(unlocked);
  emit();
  for (const id of unlocked) {
    if (!onServer.has(id) && ACHIEVEMENTS.some((a) => a.id === id)) await recordOnServer(user, id);
  }
}

let syncedUid = null;
if (ONLINE) {
  onAuthChange(({ user }) => {
    if (user && user.uid !== syncedUid) {
      syncedUid = user.uid;
      syncWithServer(user).catch((e) => console.warn("[The Yard] achievement sync failed:", e.message));
    }
    if (!user) syncedUid = null;
  });
}

let toastEl = null;
function showToast(achievement) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "achievement-toast";
    document.getElementById("app")?.appendChild(toastEl);
  }
  toastEl.innerHTML = `<div class="achievement-toast-icon">${achievement.icon}</div><div><b>Achievement unlocked</b><br/>${achievement.name}</div>`;
  toastEl.classList.remove("show");
  void toastEl.offsetWidth;
  toastEl.classList.add("show");
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => toastEl.classList.remove("show"), 3200);
}

export async function unlockAchievement(id) {
  if (unlocked.has(id)) return;
  const achievement = ACHIEVEMENTS.find((a) => a.id === id);
  if (!achievement) return;
  unlocked.add(id);
  saveLocal(unlocked);
  emit();
  playSuccess();
  showToast(achievement);

  const { user } = getState();
  if (ONLINE && user) await recordOnServer(user, id);
}
