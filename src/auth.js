import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  GoogleAuthProvider,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, ONLINE } from "./firebase.js";

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

async function loadProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: uid, ...snap.data() } : null;
}

async function ensureProfile(uid, displayName) {
  const existing = await loadProfile(uid);
  if (existing) return existing;
  const profile = { display_name: displayName || "Golden Lion", color: "#f4b223", created_at: serverTimestamp() };
  try {
    await setDoc(doc(db, "users", uid), profile);
  } catch (e) {
    console.warn("[The Yard] couldn't create profile:", e.message);
  }
  return { id: uid, display_name: profile.display_name, color: profile.color };
}

if (ONLINE) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      state = { user, profile: await ensureProfile(user.uid, user.displayName), loading: false };
    } else {
      state = { user: null, profile: null, loading: false };
    }
    emit();
  });
}

export async function quickJoin(displayName) {
  if (!ONLINE) throw new Error("Multiplayer isn't configured yet — see firebase/README.md.");
  const { user } = await signInAnonymously(auth);
  const profile = await ensureProfile(user.uid, displayName);
  state = { user, profile, loading: false };
  emit();
  return profile;
}

export async function signInWithGoogle() {
  if (!ONLINE) throw new Error("Multiplayer isn't configured yet — see firebase/README.md.");
  const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
  const profile = await ensureProfile(user.uid, user.displayName);
  state = { user, profile, loading: false };
  emit();
  return profile;
}

export async function signUpWithEmail(email, password, displayName) {
  if (!ONLINE) throw new Error("Multiplayer isn't configured yet — see firebase/README.md.");
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  const profile = await ensureProfile(user.uid, displayName);
  state = { user, profile, loading: false };
  emit();
  return profile;
}

export async function signInWithEmail(email, password) {
  if (!ONLINE) throw new Error("Multiplayer isn't configured yet — see firebase/README.md.");
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  const profile = await ensureProfile(user.uid, user.displayName);
  state = { user, profile, loading: false };
  emit();
  return profile;
}

export async function sendPasswordReset(email) {
  if (!ONLINE) throw new Error("Multiplayer isn't configured yet — see firebase/README.md.");
  await sendPasswordResetEmail(auth, email);
}

export async function setDisplayName(name) {
  if (!ONLINE || !state.user) return;
  await updateDoc(doc(db, "users", state.user.uid), { display_name: name });
  state = { ...state, profile: { ...state.profile, display_name: name } };
  emit();
}

export async function setAvatarColor(color) {
  if (!ONLINE || !state.user) return;
  await updateDoc(doc(db, "users", state.user.uid), { color });
  state = { ...state, profile: { ...state.profile, color } };
  emit();
}

export async function signOut() {
  if (!ONLINE) return;
  await fbSignOut(auth);
}
