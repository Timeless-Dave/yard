import { ref, onValue, onChildAdded, onChildChanged, onChildRemoved, set, update, remove, onDisconnect } from "firebase/database";
import { rtdb, ONLINE } from "./firebase.js";

let myKey = null;
let myIdentity = { name: "Golden Lion", color: "#f4b223" };
let myRoom = "exterior";
const ROOM_MAX = 64;

export function currentRoomId() {
  return myRoom;
}

export function setMyRoom(room) {
  const next = String(room || "exterior").slice(0, ROOM_MAX);
  myRoom = next || "exterior";
  if (!ONLINE || !myKey) return;
  update(ref(rtdb, `presence/${myKey}`), { room: myRoom, updatedAt: Date.now() });
}
let unsubscribers = [];
const peers = new Map(); // key -> { x, z, rotY, name, color }
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn(peers));
}

export function onPeersChange(fn) {
  listeners.add(fn);
  fn(peers);
  return () => listeners.delete(fn);
}

export function getPeers() {
  return peers;
}

export function isConnected() {
  return !!myKey;
}

function teardownListeners() {
  unsubscribers.forEach((off) => off());
  unsubscribers = [];
}

export async function joinPresence(userId, profile) {
  if (!ONLINE) return;
  leavePresence();
  myKey = userId;
  myIdentity = { name: profile?.display_name || "Golden Lion", color: profile?.color || "#f4b223" };

  const myRef = ref(rtdb, `presence/${userId}`);
  const connectedRef = ref(rtdb, ".info/connected");
  const offConnected = onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      onDisconnect(myRef).remove();
      set(myRef, { ...myIdentity, x: 0, z: 10, rotY: 0, room: myRoom, updatedAt: Date.now() });
    }
  });
  unsubscribers.push(offConnected);

  const peersRef = ref(rtdb, "presence");
  const upsertPeer = (snap) => {
    if (snap.key === myKey) return;
    peers.set(snap.key, snap.val());
    emit();
  };
  const offAdded = onChildAdded(peersRef, upsertPeer);
  const offChanged = onChildChanged(peersRef, upsertPeer);
  const offRemoved = onChildRemoved(peersRef, (snap) => {
    peers.delete(snap.key);
    emit();
  });
  unsubscribers.push(offAdded, offChanged, offRemoved);
}

let lastSent = 0;
export function updateMyPosition(x, z, rotY) {
  if (!ONLINE || !myKey) return;
  const now = performance.now();
  if (now - lastSent < 120) return; // throttle broadcasts
  lastSent = now;
  update(ref(rtdb, `presence/${myKey}`), { x, z, rotY, room: myRoom, updatedAt: Date.now() });
}

export function setMyIdentity(name, color) {
  myIdentity = { name, color };
  if (!myKey) return;
  update(ref(rtdb, `presence/${myKey}`), { name, color });
}

export function leavePresence() {
  if (myKey) remove(ref(rtdb, `presence/${myKey}`));
  teardownListeners();
  myKey = null;
  peers.clear();
  emit();
}

export function peerCount() {
  return peers.size;
}
