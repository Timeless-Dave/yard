import { supabase, ONLINE } from "./supabase.js";
import { getState } from "./auth.js";
import { playCoin } from "./sound.js";

let balance = 0;
let channel = null;
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

export async function refreshBalance() {
  const { user } = getState();
  if (!ONLINE || !user) {
    balance = 0;
    emit();
    return;
  }
  const { data } = await supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
  balance = data?.balance ?? 0;
  emit();
}

export function watchWallet(userId) {
  stopWatchingWallet();
  if (!ONLINE || !userId) return;
  channel = supabase
    .channel("wallet-" + userId)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.new && typeof payload.new.balance === "number") {
          balance = payload.new.balance;
          emit();
        }
      }
    )
    .subscribe();
  refreshBalance();
}

export function stopWatchingWallet() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  balance = 0;
  emit();
}

// Returns { ok, balance, error }. Never throws — callers can always render a result.
export async function earnCoins(amount, reason) {
  const { user } = getState();
  if (!ONLINE || !user) return { ok: false, error: "offline" };
  const { data, error } = await supabase.rpc("earn_coins", { amount, reason });
  if (error) return { ok: false, error: error.message };
  balance = data;
  emit();
  playCoin();
  return { ok: true, balance: data };
}

export async function spendCoins(amount, reason) {
  const { user } = getState();
  if (!ONLINE || !user) return { ok: false, error: "offline" };
  const { data, error } = await supabase.rpc("spend_coins", { amount, reason });
  if (error) return { ok: false, error: error.message.includes("insufficient") ? "Not enough Yard Coin." : error.message };
  balance = data;
  emit();
  return { ok: true, balance: data };
}
