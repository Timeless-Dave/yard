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
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions, ONLINE } from "./firebase.js";
import { moderateText, MAX_LENGTHS } from "../functions/moderation.js";

const DEFAULT_NAME = "Golden Lion";
const DEFAULT_COLOR = "#f4b223";
const OFFLINE_ERROR = "Online play isn't switched on for this copy of The Yard.";

const listeners = new Set();
let state = { user: null, profile: null, loading: ONLINE, banned: false, isAdmin: false };
let unsubscribers = [];
// The name a player typed before signing in. onAuthStateChanged fires before
// the sign-in call returns, so the profile is created there, using this.
let pendingName = null;

function emit() {
  listeners.forEach((fn) => fn(state));
}

function setState(patch) {
  state = { ...state, ...patch };
  emit();
}

export function onAuthChange(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}

// Returns a safe display name, or null if the input isn't usable.
function safeName(name) {
  const result = moderateText(String(name ?? ""), { maxLength: MAX_LENGTHS.displayName });
  return result.ok ? result.text : null;
}

async function ensureProfile(user) {
  const ref = doc(db, "users", user.uid);
  if ((await getDoc(ref)).exists()) return;
  // Google accounts carry the player's real full name — only the first name
  // goes public by default.
  const fromProvider = user.displayName ? user.displayName.split(/\s+/)[0] : null;
  const name = safeName(pendingName) || safeName(fromProvider) || DEFAULT_NAME;
  await setDoc(ref, { display_name: name, color: DEFAULT_COLOR, created_at: serverTimestamp() });
}

function watchAccount(user) {
  unsubscribers.forEach((off) => off());
  unsubscribers = [
    onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) setState({ profile: { id: user.uid, ...snap.data() }, loading: false });
    }),
    onSnapshot(doc(db, "bannedUsers", user.uid), (snap) => setState({ banned: snap.exists() })),
  ];
  user.getIdTokenResult().then((t) => setState({ isAdmin: t.claims.admin === true }));
}

if (ONLINE) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      unsubscribers.forEach((off) => off());
      unsubscribers = [];
      setState({ user: null, profile: null, loading: false, banned: false, isAdmin: false });
      return;
    }
    try {
      await ensureProfile(user);
    } catch (e) {
      console.warn("[The Yard] couldn't create profile:", e.message);
    }
    pendingName = null;
    setState({ user });
    watchAccount(user);
  });
}

function requireOnline() {
  if (!ONLINE) throw new Error(OFFLINE_ERROR);
}

export async function quickJoin(displayName) {
  requireOnline();
  const name = moderateText(displayName, { maxLength: MAX_LENGTHS.displayName });
  if (!name.ok) throw new Error(name.reason);
  pendingName = name.text;
  await signInAnonymously(auth);
}

export async function signInWithGoogle() {
  requireOnline();
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function signUpWithEmail(email, password, displayName) {
  requireOnline();
  if (displayName) {
    const name = moderateText(displayName, { maxLength: MAX_LENGTHS.displayName });
    if (!name.ok) throw new Error(name.reason);
    pendingName = name.text;
  }
  await createUserWithEmailAndPassword(auth, email, password);
}

export async function signInWithEmail(email, password) {
  requireOnline();
  await signInWithEmailAndPassword(auth, email, password);
}

export async function sendPasswordReset(email) {
  requireOnline();
  await sendPasswordResetEmail(auth, email);
}

// Returns { ok } or { ok: false, error }.
export async function setDisplayName(input) {
  if (!ONLINE || !state.user) return { ok: false, error: OFFLINE_ERROR };
  const name = moderateText(input, { maxLength: MAX_LENGTHS.displayName });
  if (!name.ok) return { ok: false, error: name.reason };
  await updateDoc(doc(db, "users", state.user.uid), { display_name: name.text });
  return { ok: true };
}

// Equip an owned cosmetic. Firestore rules check the player owns it and that
// the color matches the item, so this can't be used to wear paid colors free.
export async function equipItem(item) {
  if (!ONLINE || !state.user || !item.meta?.color) return;
  await updateDoc(doc(db, "users", state.user.uid), { color: item.meta.color, equippedItem: item.id });
}

export async function deleteAccount() {
  requireOnline();
  await httpsCallable(functions, "deleteMyAccount")();
  await fbSignOut(auth);
}

export async function signOut() {
  if (!ONLINE) return;
  await fbSignOut(auth);
}
