import { ONLINE } from "./onlineConfig.js";
import { playCoin } from "./sound.js";
import { evaluateEarn, campusDay } from "../functions/gameRules.js";

const LOCAL_KEY = "yard-wallet-v1";
let balance = 0;
let unsubscribe = null;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn(balance));
}

function toast(amount) {
  if (!amount) return;
  const el = document.createElement("div");
  el.className = "coin-toast";
  el.textContent = `+${amount} Yard Coin`;
  document.getElementById("app")?.append(el);
  setTimeout(() => el.remove(), 1600);
}

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "null") || { balance: 0, day: "", earnedToday: 0, lastAt: {}, lastDay: {}, claimedAchievements: {} }; }
  catch { return { balance: 0, day: "", earnedToday: 0, lastAt: {}, lastDay: {}, claimedAchievements: {} }; }
}

function writeLocal(log) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(log)); } catch { /* private mode */ }
}

function applyLocalEarn(source, extra) {
  const log = readLocal();
  const now = new Date();
  const verdict = evaluateEarn({ source, ...extra }, log, now);
  if (verdict.error) return { ok: false, error: verdict.error };
  const today = campusDay(now);
  const earnedToday = log.day === today ? log.earnedToday || 0 : 0;
  log.balance = (log.balance || 0) + verdict.amount;
  log.day = today;
  log.earnedToday = earnedToday + verdict.amount;
  if (source === "achievement") {
    log.claimedAchievements = { ...(log.claimedAchievements || {}), [extra.achievementId]: true };
  } else {
    log.lastAt = { ...(log.lastAt || {}), [source]: now.getTime() };
    log.lastDay = { ...(log.lastDay || {}), [source]: today };
  }
  writeLocal(log);
  balance = log.balance;
  emit();
  playCoin();
  toast(verdict.amount);
  return { ok: true, balance, amount: verdict.amount, local: true };
}

function applyLocalSpend(amount) {
  const log = readLocal();
  if ((log.balance || 0) < amount) return { ok: false, error: "Not enough Yard Coin." };
  log.balance -= amount;
  writeLocal(log);
  balance = log.balance;
  emit();
  return { ok: true, balance };
}

export function onBalanceChange(fn) {
  listeners.add(fn);
  fn(balance);
  return () => listeners.delete(fn);
}

export function getBalance() {
  return balance;
}

async function backend() {
  const [{ db, functions }, { getState }, firestore, functionsSdk] = await Promise.all([
    import("./firebase.js"),
    import("./auth.js"),
    import("firebase/firestore"),
    import("firebase/functions"),
  ]);
  return { db, functions, getState, firestore, functionsSdk };
}

export async function refreshBalance() {
  if (!ONLINE) {
    balance = readLocal().balance || 0;
    emit();
    return;
  }
  const { db, getState, firestore } = await backend();
  const { user } = getState();
  if (!user) {
    balance = readLocal().balance || 0;
    emit();
    return;
  }
  try {
    const snap = await firestore.getDoc(firestore.doc(db, "wallets", user.uid));
    balance = snap.exists() ? snap.data().balance ?? 0 : readLocal().balance || 0;
  } catch {
    balance = readLocal().balance || 0;
  }
  emit();
}

export function watchWallet(userId) {
  stopWatchingWallet();
  if (!ONLINE || !userId) {
    balance = readLocal().balance || 0;
    emit();
    return;
  }
  backend().then(({ db, firestore }) => {
    if (!ONLINE || !userId) return;
    unsubscribe = firestore.onSnapshot(firestore.doc(db, "wallets", userId), (snap) => {
      balance = snap.exists() ? snap.data().balance ?? 0 : 0;
      emit();
    }, () => {
      balance = readLocal().balance || 0;
      emit();
    });
  });
}

export function stopWatchingWallet() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

export async function earnCoins(source, { grade, achievementId } = {}) {
  if (ONLINE) {
    try {
      const { functions, getState, functionsSdk } = await backend();
      const { user } = getState();
      if (user) {
        const { data } = await functionsSdk.httpsCallable(functions, "earnCoins")({ source, grade, achievementId });
        balance = data.balance;
        emit();
        playCoin();
        toast(data.amount);
        return { ok: true, balance: data.balance, amount: data.amount };
      }
    } catch {
      /* Functions are not live yet. Fall through to the local wallet. */
    }
  }
  return applyLocalEarn(source, { grade, achievementId });
}

export async function spendCoins(amount, reason) {
  if (ONLINE) {
    try {
      const { functions, getState, functionsSdk } = await backend();
      const { user } = getState();
      if (user) {
        const { data } = await functionsSdk.httpsCallable(functions, "spendCoins")({ amount, reason });
        balance = data.balance;
        emit();
        return { ok: true, balance: data.balance };
      }
    } catch (e) {
      if (String(e.message || "").includes("insufficient")) return { ok: false, error: "Not enough Yard Coin." };
    }
  }
  return applyLocalSpend(amount);
}

refreshBalance();
