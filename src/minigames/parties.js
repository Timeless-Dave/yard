import { collection, doc, setDoc, query, where, orderBy, limit, onSnapshot, Timestamp, serverTimestamp } from "firebase/firestore";
import { db, ONLINE } from "../firebase.js";
import { getState } from "../auth.js";
import { getActiveCampus } from "../campuses.js";
import { unlockAchievement } from "../achievements.js";
import { moderateText, MAX_LENGTHS, publishPost, reportControl } from "../safety.js";
import { esc } from "../text.js";

const { PARTY_SPOTS } = getActiveCampus().data;

const VIBES = [
  { v: "kickback", label: "🎵 Kickback" },
  { v: "block_party", label: "🎉 Block Party" },
  { v: "after_party", label: "🌙 After Party" },
];
const START_OFFSETS = [
  { label: "Starting now", mins: 0 },
  { label: "In 30 min", mins: 30 },
  { label: "Tonight (in 2 hrs)", mins: 120 },
  { label: "Tomorrow night", mins: 60 * 24 },
];
const DURATION_HOURS = 3;

function fmtTime(ts) {
  return ts.toDate().toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

export function mountParties(root, { onClose } = {}) {
  if (!ONLINE) {
    root.innerHTML = `
      <div class="modal">
        <h3>🎉 Kickbacks & Parties</h3>
        <p>Host a kickback, block party, or after party at a named spot on campus — other players see it live on the map and can RSVP. Online play isn't switched on for this copy of The Yard yet.</p>
        <button class="btn btn-primary close" style="width:100%;">Close</button>
      </div>`;
    root.querySelector(".close").addEventListener("click", () => onClose?.());
    return;
  }

  const authState = getState();

  root.innerHTML = `
    <div class="modal game-modal">
      <h3>🎉 Kickbacks & Parties</h3>
      <p class="corkboard-sub">Live and upcoming — RSVP to show up on the map for everyone.</p>
      <div class="leaderboard-list" id="party-list">Loading...</div>

      <h3 style="margin-top:16px;font-size:15px;">Host one</h3>
      <div class="corkboard-form">
        <input id="pt-title" type="text" maxlength="${MAX_LENGTHS.partyTitle}" placeholder="Party name, e.g. 'Friday Night Kickback'" />
        <select id="pt-vibe"></select>
        <select id="pt-spot"></select>
        <select id="pt-when"></select>
        <button class="btn btn-primary" id="pt-host" style="width:100%;">Host it</button>
        <div class="auth-status" id="pt-status"></div>
      </div>
      <button class="btn btn-secondary close" style="margin-top:12px;width:100%;">Close</button>
    </div>`;

  const listEl = root.querySelector("#party-list");
  const titleInput = root.querySelector("#pt-title");
  const vibeSel = root.querySelector("#pt-vibe");
  const spotSel = root.querySelector("#pt-spot");
  const whenSel = root.querySelector("#pt-when");
  const statusEl = root.querySelector("#pt-status");

  VIBES.forEach((v) => vibeSel.appendChild(new Option(v.label, v.v)));
  Object.entries(PARTY_SPOTS).forEach(([key, s]) => spotSel.appendChild(new Option(s.label, key)));
  START_OFFSETS.forEach((o) => whenSel.appendChild(new Option(o.label, o.mins)));

  function render(parties) {
    if (!parties.length) {
      listEl.innerHTML = '<div style="opacity:0.5;font-size:13px;text-align:center;padding:10px;">Nothing on the books — host the first one.</div>';
      return;
    }
    listEl.innerHTML = "";
    const now = Date.now();
    parties.forEach((p) => {
      const live = p.startsAt.toMillis() <= now && p.endsAt.toMillis() >= now;
      const vibe = VIBES.find((v) => v.v === p.vibe)?.label || "🎉 Party";
      const spotLabel = PARTY_SPOTS[p.spot]?.label || "Somewhere on the Yard";
      const row = document.createElement("div");
      row.className = "lb-row";
      row.innerHTML = `
        <span class="lb-rank">${live ? "🔴" : "🕐"}</span>
        <span class="lb-name">${vibe} — <b>${esc(p.title)}</b><br/><small style="opacity:0.7;">${esc(spotLabel)} · ${live ? "live now" : fmtTime(p.startsAt)} · ${Number(p.rsvpCount) || 0} going · hosted by ${esc(p.hostName)}</small></span>
        <button class="btn btn-secondary" style="padding:6px 10px;font-size:12px;">RSVP</button>`;
      if (!authState.user || p.hostId !== authState.user.uid) {
        row.querySelector(".lb-name").appendChild(reportControl("parties", p.id));
      }
      row.querySelector("button.btn").addEventListener("click", async () => {
        if (!authState.user) {
          statusEl.textContent = "Join the Yard first (Sign up / Log in) to RSVP.";
          return;
        }
        try {
          await setDoc(doc(db, "partyRsvps", `${p.id}_${authState.user.uid}`), {
            partyId: p.id,
            userId: authState.user.uid,
            displayName: getState().profile?.display_name || "Golden Lion",
            createdAt: serverTimestamp(),
          });
          unlockAchievement("party_people");
          statusEl.textContent = `You're going to ${p.title}.`;
        } catch (e) {
          statusEl.textContent = "Couldn't RSVP: " + e.message;
        }
      });
      listEl.appendChild(row);
    });
  }

  const q = query(
    collection(db, "parties"),
    where("hidden", "==", false),
    where("endsAt", ">=", Timestamp.now()),
    orderBy("endsAt"),
    orderBy("startsAt"),
    limit(20)
  );
  const unsubscribe = onSnapshot(
    q,
    (snap) => render(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => (listEl.textContent = "Couldn't load parties: " + e.message)
  );

  root.querySelector("#pt-host").addEventListener("click", async () => {
    const checked = moderateText(titleInput.value, { maxLength: MAX_LENGTHS.partyTitle });
    if (!checked.ok) {
      statusEl.textContent = checked.reason;
      return;
    }
    const startsAt = new Date(Date.now() + Number(whenSel.value) * 60000);
    const endsAt = new Date(startsAt.getTime() + DURATION_HOURS * 3600000);
    const result = await publishPost(doc(collection(db, "parties")), {
      hostId: authState.user?.uid,
      hostName: getState().profile?.display_name || "Golden Lion",
      title: checked.text,
      vibe: vibeSel.value,
      spot: spotSel.value,
      startsAt: Timestamp.fromDate(startsAt),
      endsAt: Timestamp.fromDate(endsAt),
      rsvpCount: 0,
    });
    if (!result.ok) {
      statusEl.textContent = result.error;
      return;
    }
    statusEl.textContent = "";
    titleInput.value = "";
  });

  root.querySelector(".close").addEventListener("click", () => onClose?.());
  return unsubscribe;
}
