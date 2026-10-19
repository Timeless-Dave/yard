import { ONLINE } from "./onlineConfig.js";
import { playCoin } from "./sound.js";

let balance = 0;
let unsubscribe = null;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn(balance));
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
    balance = 0;
    emit();
    return;
  }
  const { db, getState, firestore } = await backend();
  const { user } = getState();
  if (!user) {
    balance = 0;
    emit();
    return;
  }
  const snap = await firestore.getDoc(firestore.doc(db, "wallets", user.uid));
  balance = snap.exists() ? snap.data().balance ?? 0 : 0;
  emit();
}

export function watchWallet(userId) {
  stopWatchingWallet();
  if (!ONLINE || !userId) return;
  backend().then(({ db, firestore }) => {
    if (!ONLINE || !userId) return;
    unsubscribe = firestore.onSnapshot(firestore.doc(db, "wallets", userId), (snap) => {
      balance = snap.exists() ? snap.data().balance ?? 0 : 0;
      emit();
    });
  });
}

export function stopWatchingWallet() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  balance = 0;
  emit();
}

// Reports what happened (a source from functions/gameRules.js, plus a grade
// or achievementId); the server decides the payout and enforces cooldowns
// and the daily cap. Returns { ok, balance, amount, error } and never throws.
export async function earnCoins(source, { grade, achievementId } = {}) {
  if (!ONLINE) return { ok: false, error: "offline" };
  const { functions, getState, functionsSdk } = await backend();
  const { user } = getState();
  if (!user) return { ok: false, error: "offline" };
  try {
    const { data } = await functionsSdk.httpsCallable(functions, "earnCoins")({ source, grade, achievementId });
    balance = data.balance;
    emit();
    playCoin();
    return { ok: true, balance: data.balance, amount: data.amount };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function spendCoins(amount, reason) {
  if (!ONLINE) return { ok: false, error: "offline" };
  const { functions, getState, functionsSdk } = await backend();
  const { user } = getState();
  if (!user) return { ok: false, error: "offline" };
  try {
    const { data } = await functionsSdk.httpsCallable(functions, "spendCoins")({ amount, reason });
    balance = data.balance;
    emit();
    return { ok: true, balance: data.balance };
  } catch (e) {
    return { ok: false, error: e.message.includes("insufficient") ? "Not enough Yard Coin." : e.message };
  }
}
