import { supabase, ONLINE } from "../supabase.js";
import { getState } from "../auth.js";
import { PARTY_SPOTS } from "../partySpots.js";
import { unlockAchievement } from "../achievements.js";

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

function fmtTime(iso) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

export function mountParties(root, { onClose } = {}) {
  if (!ONLINE) {
    root.innerHTML = `
      <div class="modal">
        <h3>🎉 Kickbacks & Parties</h3>
        <p>Host a kickback, block party, or after party at a named spot on campus — other players see it live on the map and can RSVP. Connect Supabase (see <code>supabase/README.md</code>) to turn this on.</p>
        <button class="btn btn-primary close" style="width:100%;">Close</button>
      </div>`;
    root.querySelector(".close").addEventListener("click", () => onClose?.());
    return;
  }

  const authState = getState();
  let channel = null;

  root.innerHTML = `
    <div class="modal game-modal">
      <h3>🎉 Kickbacks & Parties</h3>
      <p class="corkboard-sub">Live and upcoming — RSVP to show up on the map for everyone.</p>
      <div class="leaderboard-list" id="party-list">Loading...</div>

      <h3 style="margin-top:16px;font-size:15px;">Host one</h3>
      <div class="corkboard-form">
        <input id="pt-title" type="text" maxlength="40" placeholder="Party name, e.g. 'Friday Night Kickback'" />
        <select id="pt-vibe"></select>
        <select id="pt-spot"></select>
        <select id="pt-when"></select>
        <button class="btn btn-primary" id="pt-host" style="width:100%;">Host it</button>
      </div>
      <button class="btn btn-secondary close" style="margin-top:12px;width:100%;">Close</button>
    </div>`;

  const listEl = root.querySelector("#party-list");
  const titleInput = root.querySelector("#pt-title");
  const vibeSel = root.querySelector("#pt-vibe");
  const spotSel = root.querySelector("#pt-spot");
  const whenSel = root.querySelector("#pt-when");

  VIBES.forEach((v) => vibeSel.appendChild(new Option(v.label, v.v)));
  Object.entries(PARTY_SPOTS).forEach(([key, s]) => spotSel.appendChild(new Option(s.label, key)));
  START_OFFSETS.forEach((o) => whenSel.appendChild(new Option(o.label, o.mins)));

  async function render() {
    const { data, error } = await supabase
      .from("party_tallies")
      .select("*")
      .gte("ends_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(20);
    if (error) {
      listEl.textContent = "Couldn't load parties: " + error.message;
      return;
    }
    if (!data?.length) {
      listEl.innerHTML = '<div style="opacity:0.5;font-size:13px;text-align:center;padding:10px;">Nothing on the books — host the first one.</div>';
      return;
    }
    listEl.innerHTML = "";
    const now = Date.now();
    data.forEach((p) => {
      const live = new Date(p.starts_at).getTime() <= now && new Date(p.ends_at).getTime() >= now;
      const vibe = VIBES.find((v) => v.v === p.vibe)?.label || p.vibe;
      const spotLabel = PARTY_SPOTS[p.spot]?.label || p.spot;
      const row = document.createElement("div");
      row.className = "lb-row";
      row.innerHTML = `
        <span class="lb-rank">${live ? "🔴" : "🕐"}</span>
        <span class="lb-name">${vibe} — <b>${p.title}</b><br/><small style="opacity:0.7;">${spotLabel} · ${live ? "live now" : fmtTime(p.starts_at)} · ${p.rsvp_count} going</small></span>
        <button class="btn btn-secondary" style="padding:6px 10px;font-size:12px;">RSVP</button>`;
      row.querySelector("button").addEventListener("click", async () => {
        if (!authState.user) {
          alert("Join the Yard first (Sign up / Log in) to RSVP.");
          return;
        }
        const { error: rsvpError } = await supabase
          .from("party_rsvps")
          .upsert(
            { party_id: p.id, user_id: authState.user.id, display_name: authState.profile?.display_name || "Golden Lion" },
            { onConflict: "party_id,user_id" }
          );
        if (rsvpError) alert("Couldn't RSVP: " + rsvpError.message);
        else {
          unlockAchievement("party_people");
          render();
        }
      });
      listEl.appendChild(row);
    });
  }

  root.querySelector("#pt-host").addEventListener("click", async () => {
    const title = titleInput.value.trim();
    if (!title) return;
    if (!authState.user) {
      alert("Join the Yard first (Sign up / Log in) to host a party.");
      return;
    }
    const startsAt = new Date(Date.now() + Number(whenSel.value) * 60000);
    const endsAt = new Date(startsAt.getTime() + DURATION_HOURS * 3600000);
    const { error } = await supabase.from("parties").insert({
      host_id: authState.user.id,
      host_name: authState.profile?.display_name || "Golden Lion",
      title,
      vibe: vibeSel.value,
      spot: spotSel.value,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    });
    if (error) alert("Couldn't host: " + error.message);
    else {
      titleInput.value = "";
      render();
    }
  });

  channel = supabase
    .channel("parties-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "parties" }, () => render())
    .on("postgres_changes", { event: "*", schema: "public", table: "party_rsvps" }, () => render())
    .subscribe();

  root.querySelector(".close").addEventListener("click", () => {
    if (channel) supabase.removeChannel(channel);
    onClose?.();
  });

  render();
}
