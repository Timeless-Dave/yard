import { supabase, ONLINE } from "./supabase.js";

const listeners = new Set();
let state = { user: null, profile: null, loading: ONLINE };

function emit() {
  listeners.forEach((fn) => fn(state));
}

export function onAuthChange(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}

async function loadProfile(userId) {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return data;
}

async function ensureProfile(userId, displayName) {
  const existing = await loadProfile(userId);
  if (existing) return existing;
  const { data, error } = await supabase
    .from("profiles")
    .insert({ id: userId, display_name: displayName || "Golden Lion" })
    .select()
    .single();
  if (error) {
    console.warn("[The Yard] couldn't create profile:", error.message);
    return { id: userId, display_name: displayName || "Golden Lion", color: "#f4b223" };
  }
  return data;
}

if (ONLINE) {
  supabase.auth.getSession().then(async ({ data }) => {
    if (data.session?.user) {
      state = { user: data.session.user, profile: await loadProfile(data.session.user.id), loading: false };
    } else {
      state = { user: null, profile: null, loading: false };
    }
    emit();
  });

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      state = { user: session.user, profile: await loadProfile(session.user.id), loading: false };
    } else {
      state = { user: null, profile: null, loading: false };
    }
    emit();
  });
}

export async function quickJoin(displayName) {
  if (!ONLINE) throw new Error("Multiplayer isn't configured yet — see supabase/README.md.");
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  const profile = await ensureProfile(data.user.id, displayName);
  state = { user: data.user, profile, loading: false };
  emit();
  return profile;
}

export async function sendMagicLink(email) {
  if (!ONLINE) throw new Error("Multiplayer isn't configured yet — see supabase/README.md.");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function setDisplayName(name) {
  if (!ONLINE || !state.user) return;
  const { data } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", state.user.id)
    .select()
    .single();
  if (data) {
    state = { ...state, profile: data };
    emit();
  }
}

export async function setAvatarColor(color) {
  if (!ONLINE || !state.user) return;
  const { data } = await supabase
    .from("profiles")
    .update({ color })
    .eq("id", state.user.id)
    .select()
    .single();
  if (data) {
    state = { ...state, profile: data };
    emit();
  }
}

export async function signOut() {
  if (!ONLINE) return;
  await supabase.auth.signOut();
}
