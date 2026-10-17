import { supabase, ONLINE } from "./supabase.js";

let channel = null;
let myKey = null;
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
  return !!channel;
}

export async function joinPresence(userId, profile) {
  if (!ONLINE) return;
  leavePresence();
  myKey = userId;
  channel = supabase.channel("yard-presence", { config: { presence: { key: userId } } });
  channel._lastName = profile?.display_name || "Golden Lion";
  channel._lastColor = profile?.color || "#f4b223";

  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState();
    peers.clear();
    for (const key of Object.keys(state)) {
      if (key === myKey) continue;
      const entry = state[key][0];
      if (entry) peers.set(key, entry);
    }
    emit();
  });

  await channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel.track({
        name: profile?.display_name || "Golden Lion",
        color: profile?.color || "#f4b223",
        x: 0,
        z: 10,
        rotY: 0,
      });
    }
  });
}

let lastSent = 0;
export function updateMyPosition(x, z, rotY) {
  if (!channel) return;
  const now = performance.now();
  if (now - lastSent < 120) return; // throttle broadcasts
  lastSent = now;
  channel.track({ x, z, rotY, name: channel._lastName, color: channel._lastColor });
}

export function setMyIdentity(name, color) {
  if (!channel) return;
  channel._lastName = name;
  channel._lastColor = color;
}

export function leavePresence() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  peers.clear();
  emit();
}

export function peerCount() {
  return peers.size;
}
