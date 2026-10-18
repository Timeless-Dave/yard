import { doc, setDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";
import { getState } from "./auth.js";

export { moderateText, MAX_LENGTHS } from "../functions/moderation.js";

const POST_INTERVAL_MS = 3200; // rules allow one public post per 3s
let lastPostAt = 0;

// Publishes moderated public content (chat, corkboard, nominations,
// parties). Firestore rules require the post to land in the same batch as a
// bump to the author's rateLimits doc. Returns { ok } or { ok: false, error }.
export async function publishPost(ref, data) {
  const { user, banned } = getState();
  if (!user) return { ok: false, error: "Join the Yard first (Sign up / Log in)." };
  if (banned) return { ok: false, error: "Your account has been suspended from posting." };
  if (Date.now() - lastPostAt < POST_INTERVAL_MS) return { ok: false, error: "Slow down a sec — one post every few seconds." };

  const batch = writeBatch(db);
  batch.set(ref, { ...data, createdAt: serverTimestamp(), hidden: false, reportCount: 0 });
  batch.set(doc(db, "rateLimits", user.uid), { lastPostAt: serverTimestamp() });
  try {
    await batch.commit();
    lastPostAt = Date.now();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.code === "permission-denied" ? "Couldn't post that — try again in a few seconds." : e.message };
  }
}

const REASONS = [
  ["harassment", "Harassment"],
  ["hate", "Hate"],
  ["sexual", "Sexual"],
  ["spam", "Spam"],
  ["impersonation", "Impersonation"],
  ["other", "Other"],
];

// A 🚩 control that files one report per player per item. Three reports from
// different players auto-hide the item until a moderator reviews it.
export function reportControl(targetCollection, targetId) {
  const wrap = document.createElement("span");
  wrap.className = "report-wrap";
  const flag = document.createElement("button");
  flag.className = "report-btn";
  flag.textContent = "🚩";
  flag.title = "Report";
  flag.setAttribute("aria-label", "Report this");
  wrap.appendChild(flag);

  flag.addEventListener("click", (e) => {
    e.stopPropagation();
    const { user } = getState();
    if (!user) {
      wrap.textContent = "Sign in to report.";
      return;
    }
    const menu = document.createElement("span");
    menu.className = "report-menu";
    REASONS.forEach(([reason, label]) => {
      const option = document.createElement("button");
      option.className = "report-reason";
      option.textContent = label;
      option.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        try {
          await setDoc(doc(db, "reports", `${targetCollection}_${targetId}_${user.uid}`), {
            targetCollection,
            targetId,
            reporterId: user.uid,
            reason,
            createdAt: serverTimestamp(),
          });
          wrap.textContent = "Reported — thanks.";
        } catch {
          wrap.textContent = "Already reported.";
        }
      });
      menu.appendChild(option);
    });
    flag.replaceWith(menu);
  });
  return wrap;
}
