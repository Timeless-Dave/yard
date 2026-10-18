import { collection, doc, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db, ONLINE } from "../firebase.js";
import { getState } from "../auth.js";
import { unlockAchievement } from "../achievements.js";
import { moderateText, MAX_LENGTHS, publishPost, reportControl } from "../safety.js";
import { esc } from "../text.js";

export function mountChat(root, { onClose } = {}) {
  if (!ONLINE) {
    root.innerHTML = `
      <div class="modal">
        <h3>💬 Yard Chat</h3>
        <p>Talk to everyone else walking the Yard right now. Online play isn't switched on for this copy of The Yard yet.</p>
        <button class="btn btn-primary close" style="width:100%;">Close</button>
      </div>`;
    root.querySelector(".close").addEventListener("click", () => onClose?.());
    return;
  }

  const authState = getState();
  const signedIn = Boolean(authState.user);

  root.innerHTML = `
    <div class="modal game-modal">
      <h3>💬 Yard Chat</h3>
      <p class="corkboard-sub">Everyone signed in sees this live. Keep it respectful — 🚩 anything that isn't.</p>
      <div class="corkboard-list" id="chat-list" style="max-height:260px;"></div>
      <div class="corkboard-form">
        <input id="chat-input" type="text" maxlength="${MAX_LENGTHS.chat}" placeholder="${signedIn ? "Say something..." : "Join the Yard to chat"}" ${signedIn ? "" : "disabled"} />
        <button class="btn btn-primary" id="chat-send" style="width:100%;" ${signedIn ? "" : "disabled"}>Send</button>
        <div class="auth-status" id="chat-status"></div>
      </div>
      <button class="btn btn-secondary close" style="margin-top:12px;width:100%;">Close</button>
    </div>`;

  const listEl = root.querySelector("#chat-list");
  const input = root.querySelector("#chat-input");
  const statusEl = root.querySelector("#chat-status");

  function render(messages) {
    const wasAtBottom = listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 20;
    listEl.innerHTML = messages.length
      ? ""
      : '<div style="opacity:0.5;font-size:13px;text-align:center;padding:10px;">Nobody\'s said anything yet — break the ice.</div>';
    messages.forEach((m) => {
      const mine = authState.user && m.userId === authState.user.uid;
      const card = document.createElement("div");
      card.className = "corkboard-card" + (mine ? " lb-me" : "");
      card.innerHTML = `<div class="corkboard-card-msg">${esc(m.msg)}</div><div class="corkboard-card-name">— ${esc(m.name)}</div>`;
      if (!mine) card.querySelector(".corkboard-card-name").appendChild(reportControl("chatMessages", m.id));
      listEl.appendChild(card);
    });
    if (wasAtBottom) listEl.scrollTop = listEl.scrollHeight;
  }

  // Newest 100, displayed oldest-first.
  const q = query(collection(db, "chatMessages"), where("hidden", "==", false), orderBy("createdAt", "desc"), limit(100));
  const unsubscribe = onSnapshot(
    q,
    (snap) => render(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) })).reverse()),
    (e) => (listEl.textContent = "Couldn't load chat: " + e.message)
  );

  async function send() {
    const checked = moderateText(input.value, { maxLength: MAX_LENGTHS.chat });
    if (!checked.ok) {
      statusEl.textContent = checked.reason;
      return;
    }
    const result = await publishPost(doc(collection(db, "chatMessages")), {
      userId: authState.user.uid,
      name: getState().profile?.display_name || "Golden Lion",
      msg: checked.text,
    });
    if (!result.ok) {
      statusEl.textContent = result.error;
      return;
    }
    statusEl.textContent = "";
    input.value = "";
    unlockAchievement("yard_talk");
  }

  root.querySelector("#chat-send").addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });

  root.querySelector(".close").addEventListener("click", () => onClose?.());
  return unsubscribe;
}
