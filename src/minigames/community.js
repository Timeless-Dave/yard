import { supabase, ONLINE } from "../supabase.js";
import { getState } from "../auth.js";
import { unlockAchievement } from "../achievements.js";

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
function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

export function mountCommunity(root, { onClose } = {}) {
  let posts = [];
  let channel = null;

  root.innerHTML = `
    <div class="modal game-modal">
      <h3>📌 The Corkboard</h3>
      <p class="corkboard-sub">${
        ONLINE
          ? "Post a request or promo — everyone on the Yard sees it live."
          : "Post a request or promo for the Yard. Saved on this device for now — connect Supabase for a shared board."
      }</p>
      <div class="corkboard-form">
        <select id="cb-type"></select>
        <input id="cb-name" type="text" maxlength="24" placeholder="Your name" />
        <textarea id="cb-msg" maxlength="140" placeholder="What's the ask? e.g. 'Play 21 Questions at the step show' or 'Shoutout AKA step practice Thurs 7pm'"></textarea>
        <button class="btn btn-primary" id="cb-post" style="width:100%;">Pin it</button>
      </div>
      <div class="corkboard-list" id="cb-list"></div>
      <button class="btn btn-secondary close" style="margin-top:12px;width:100%;">Close</button>
    </div>`;

  const typeSel = root.querySelector("#cb-type");
  TYPES.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.v;
    opt.textContent = t.label;
    typeSel.appendChild(opt);
  });

  const nameInput = root.querySelector("#cb-name");
  const msgInput = root.querySelector("#cb-msg");
  const listEl = root.querySelector("#cb-list");
  const authState = getState();
  if (authState.profile?.display_name) nameInput.value = authState.profile.display_name;

  function render() {
    listEl.innerHTML = "";
    if (!posts.length) {
      listEl.innerHTML = '<div style="opacity:0.5;font-size:13px;text-align:center;padding:10px;">Nothing pinned yet — be the first.</div>';
      return;
    }
    [...posts].reverse().forEach((p) => {
      const type = TYPES.find((t) => t.v === p.type) || TYPES[0];
      const card = document.createElement("div");
      card.className = "corkboard-card";
      card.innerHTML = `<div class="corkboard-card-type">${type.label}</div><div class="corkboard-card-msg">${p.msg}</div><div class="corkboard-card-name">— ${p.name}</div>`;
      listEl.appendChild(card);
    });
  }

  async function loadRemote() {
    const { data, error } = await supabase
      .from("corkboard_posts")
      .select("type, name, msg, created_at")
      .order("created_at", { ascending: true })
      .limit(100);
    if (!error && data) {
      posts = data.map((d) => ({ type: d.type, name: d.name, msg: d.msg }));
      render();
    }
  }

  if (ONLINE) {
    loadRemote();
    channel = supabase
      .channel("corkboard-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "corkboard_posts" }, (payload) => {
        posts.push({ type: payload.new.type, name: payload.new.name, msg: payload.new.msg });
        render();
      })
      .subscribe();
  } else {
    posts = loadLocal();
    render();
  }

  root.querySelector("#cb-post").addEventListener("click", async () => {
    const msg = msgInput.value.trim();
    const name = nameInput.value.trim() || "Anonymous Lion";
    if (!msg) return;
    const type = typeSel.value;

    if (ONLINE) {
      if (!authState.user) {
        alert("Join the Yard first (Sign up / Log in) to post to the shared corkboard.");
        return;
      }
      const { error } = await supabase
        .from("corkboard_posts")
        .insert({ user_id: authState.user.id, type, name: escapeHtml(name), msg: escapeHtml(msg) });
      if (error) {
        alert("Couldn't post: " + error.message);
        return;
      }
    } else {
      posts.push({ type, name: escapeHtml(name), msg: escapeHtml(msg) });
      saveLocal(posts);
      render();
    }
    unlockAchievement("corkboard_poster");
    msgInput.value = "";
  });

  root.querySelector(".close").addEventListener("click", () => {
    if (channel) supabase.removeChannel(channel);
    onClose?.();
  });
}
