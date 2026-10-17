import { supabase, ONLINE } from "./supabase.js";
import { getState } from "./auth.js";
import { earnCoins } from "./economy.js";
import { playSuccess } from "./sound.js";

const STORAGE_KEY = "yard-achievements-v1";
const BONUS_COINS = 25;

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

async function syncFromServer() {
  const { user } = getState();
  if (!ONLINE || !user) return;
  const { data } = await supabase.from("achievement_progress").select("achievement_id").eq("user_id", user.id);
  (data || []).forEach((row) => unlocked.add(row.achievement_id));
  saveLocal(unlocked);
  emit();
}
syncFromServer();

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
  if (ONLINE && user) {
    await supabase.from("achievement_progress").insert({ user_id: user.id, achievement_id: id }).select();
    earnCoins(BONUS_COINS, "achievement: " + achievement.name);
  }
}
