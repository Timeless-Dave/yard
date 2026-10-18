import { collection, doc, getDoc, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions, ONLINE } from "../firebase.js";
import { getState } from "../auth.js";
import { esc } from "../text.js";

const TEXT_FIELD = { chatMessages: "msg", corkboardPosts: "msg", candidates: "name", parties: "title" };
const AUTHOR_NAME = { chatMessages: "name", corkboardPosts: "name", candidates: null, parties: "hostName" };
const LABEL = { chatMessages: "Chat", corkboardPosts: "Corkboard", candidates: "Nominee", parties: "Party" };

export function mountModQueue(root, { onClose } = {}) {
  if (!ONLINE || !getState().isAdmin) {
    root.innerHTML = `
      <div class="modal">
        <h3>🛡️ Moderation queue</h3>
        <p>Moderators only.</p>
        <button class="btn btn-primary close" style="width:100%;">Close</button>
      </div>`;
    root.querySelector(".close").addEventListener("click", () => onClose?.());
    return;
  }

  root.innerHTML = `
    <div class="modal game-modal">
      <h3>🛡️ Moderation queue</h3>
      <p class="corkboard-sub">Open reports, oldest first. Items with 3+ reports are already hidden until you act.</p>
      <div class="leaderboard-list" id="mq-list" style="max-height:360px;">Loading...</div>
      <div class="auth-status" id="mq-status"></div>
      <button class="btn btn-secondary close" style="margin-top:12px;width:100%;">Close</button>
    </div>`;

  const listEl = root.querySelector("#mq-list");
  const statusEl = root.querySelector("#mq-status");
  const resolve = httpsCallable(functions, "resolveReport");

  async function render(reports) {
    if (!reports.length) {
      listEl.innerHTML = '<div style="opacity:0.5;font-size:13px;text-align:center;padding:10px;">Queue is clear.</div>';
      return;
    }
    const targets = await Promise.all(
      reports.map((r) => getDoc(doc(db, r.targetCollection, r.targetId)).then((s) => (s.exists() ? s.data() : null)))
    );
    listEl.innerHTML = "";
    reports.forEach((r, i) => {
      const t = targets[i];
      const card = document.createElement("div");
      card.className = "corkboard-card";
      const text = t ? t[TEXT_FIELD[r.targetCollection]] : "(already deleted)";
      const author = t && AUTHOR_NAME[r.targetCollection] ? t[AUTHOR_NAME[r.targetCollection]] : "";
      card.innerHTML = `
        <div class="corkboard-card-type">${LABEL[r.targetCollection] || esc(r.targetCollection)} · reported for ${esc(r.reason)}${
          t ? ` · ${Number(t.reportCount) || 0} report(s)${t.hidden ? " · hidden" : ""}` : ""
        }</div>
        <div class="corkboard-card-msg">${esc(text)}</div>
        <div class="corkboard-card-name">${author ? "— " + esc(author) : ""}</div>
        <div class="auth-row" style="margin-top:6px;flex-wrap:wrap;">
          <button class="btn btn-secondary" data-action="dismiss" style="padding:4px 10px;font-size:12px;">Dismiss</button>
          <button class="btn btn-secondary" data-action="${t?.hidden ? "restore" : "hide"}" style="padding:4px 10px;font-size:12px;">${t?.hidden ? "Restore" : "Hide"}</button>
          <button class="btn btn-primary" data-action="ban" style="padding:4px 10px;font-size:12px;">Hide + ban author</button>
        </div>`;
      card.querySelectorAll("[data-action]").forEach((btn) =>
        btn.addEventListener("click", async () => {
          const action = btn.dataset.action;
          if (action === "ban" && !confirm("Hide this and ban its author from posting?")) return;
          statusEl.textContent = "Working...";
          try {
            await resolve({ reportId: r.id, action });
            statusEl.textContent = `Done: ${action}.`;
          } catch (e) {
            statusEl.textContent = "Failed: " + e.message;
          }
        })
      );
      listEl.appendChild(card);
    });
  }

  const unsubscribe = onSnapshot(
    query(collection(db, "reports"), where("status", "==", "open"), orderBy("createdAt", "asc")),
    (snap) => render(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => (listEl.textContent = "Couldn't load reports: " + e.message)
  );

  root.querySelector(".close").addEventListener("click", () => onClose?.());
  return unsubscribe;
}
