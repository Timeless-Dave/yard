import { collection, doc, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db, ONLINE } from "../firebase.js";
import { getState } from "../auth.js";
import { unlockAchievement } from "../achievements.js";
import { moderateText, MAX_LENGTHS, publishPost, reportControl } from "../safety.js";
import { esc } from "../text.js";

const STORAGE_KEY = "yard-corkboard-v1";
const TYPES = [
  { v: "song", label: "🎵 Request a song" },
  { v: "game", label: "🎮 Request a game" },
  { v: "promo", label: "📣 Promote something" },
];

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveLocal(posts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  } catch {
    /* storage unavailable, ignore */
  }
}

export function mountCommunity(root, { onClose } = {}) {
  const authState = getState();
  let posts = [];
  let unsubscribe = null;

  root.innerHTML = `
    <div class="modal game-modal">
      <h3>📌 The Corkboard</h3>
      <p class="corkboard-sub">${
        ONLINE
          ? "Post a request or promo — everyone on the Yard sees it live. 🚩 anything out of line."
          : "Post a request or promo for the Yard. Saved on this device for now."
      }</p>
      <div class="corkboard-form">
        <select id="cb-type"></select>
        ${ONLINE ? "" : '<input id="cb-name" type="text" maxlength="24" placeholder="Your name" />'}
        <textarea id="cb-msg" maxlength="${MAX_LENGTHS.corkboard}" placeholder="What's the ask? e.g. 'Play 21 Questions at the step show' or 'Shoutout step practice Thurs 7pm'"></textarea>
        <button class="btn btn-primary" id="cb-post" style="width:100%;">Pin it</button>
        <div class="auth-status" id="cb-status"></div>
      </div>
      <div class="corkboard-list" id="cb-list"></div>
      <button class="btn btn-secondary close" style="margin-top:12px;width:100%;">Close</button>
    </div>`;

  const typeSel = root.querySelector("#cb-type");
  TYPES.forEach((t) => typeSel.appendChild(new Option(t.label, t.v)));

  const nameInput = root.querySelector("#cb-name");
  const msgInput = root.querySelector("#cb-msg");
  const listEl = root.querySelector("#cb-list");
  const statusEl = root.querySelector("#cb-status");

  function render() {
    listEl.innerHTML = "";
    if (!posts.length) {
      listEl.innerHTML = '<div style="opacity:0.5;font-size:13px;text-align:center;padding:10px;">Nothing pinned yet — be the first.</div>';
      return;
    }
    posts.forEach((p) => {
      const type = TYPES.find((t) => t.v === p.type) || TYPES[0];
      const card = document.createElement("div");
      card.className = "corkboard-card";
      card.innerHTML = `<div class="corkboard-card-type">${type.label}</div><div class="corkboard-card-msg">${esc(p.msg)}</div><div class="corkboard-card-name">— ${esc(p.name)}</div>`;
      const mine = authState.user && p.userId === authState.user.uid;
      if (ONLINE && p.id && !mine) card.querySelector(".corkboard-card-name").appendChild(reportControl("corkboardPosts", p.id));
      listEl.appendChild(card);
    });
  }

  if (ONLINE) {
    const q = query(collection(db, "corkboardPosts"), where("hidden", "==", false), orderBy("createdAt", "desc"), limit(100));
    unsubscribe = onSnapshot(
      q,
      (snap) => {
        posts = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));
        render();
      },
      (e) => (listEl.textContent = "Couldn't load the corkboard: " + e.message)
    );
  } else {
    posts = loadLocal().reverse();
    render();
  }

  root.querySelector("#cb-post").addEventListener("click", async () => {
    const checked = moderateText(msgInput.value, { maxLength: MAX_LENGTHS.corkboard });
    if (!checked.ok) {
      statusEl.textContent = checked.reason;
      return;
    }
    const type = typeSel.value;

    if (ONLINE) {
      const result = await publishPost(doc(collection(db, "corkboardPosts")), {
        userId: authState.user?.uid,
        name: getState().profile?.display_name || "Golden Lion",
        type,
        msg: checked.text,
      });
      if (!result.ok) {
        statusEl.textContent = result.error;
        return;
      }
    } else {
      const name = moderateText(nameInput.value || "Anonymous Lion", { maxLength: MAX_LENGTHS.displayName });
      if (!name.ok) {
        statusEl.textContent = name.reason;
        return;
      }
      const saved = loadLocal();
      saved.push({ type, name: name.text, msg: checked.text });
      saveLocal(saved);
      posts = saved.slice().reverse();
      render();
    }
    statusEl.textContent = "";
    unlockAchievement("corkboard_poster");
    msgInput.value = "";
  });

  root.querySelector(".close").addEventListener("click", () => onClose?.());
  return () => unsubscribe?.();
}
