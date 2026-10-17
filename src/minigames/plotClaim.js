import { supabase, ONLINE } from "../supabase.js";
import { getState } from "../auth.js";
import { unlockAchievement } from "../achievements.js";

export function mountPlotClaim(root, { letters, onClose } = {}) {
  if (!letters) {
    root.innerHTML = `
      <div class="modal">
        <h3>🏠 Divine Nine Plot Lines</h3>
        <p>Walk up to one of the five plot houses on the Yard (ΑΦΑ, ΔΣΘ, ΚΑΨ, ΟΦΒ, ΖΦΒ) and press E to claim that specific one.</p>
        <button class="btn btn-primary close" style="width:100%;">Close</button>
      </div>`;
    root.querySelector(".close").addEventListener("click", () => onClose?.());
    return;
  }

  if (!ONLINE) {
    root.innerHTML = `
      <div class="modal">
        <h3>🏠 Claim ${letters} Plot</h3>
        <p>Claim a Divine Nine plot house, join the membership roster, and sign up for Probate Night — the public stepping reveal for new members. Connect Supabase (see <code>supabase/README.md</code>) to turn this on.</p>
        <button class="btn btn-primary close" style="width:100%;">Close</button>
      </div>`;
    root.querySelector(".close").addEventListener("click", () => onClose?.());
    return;
  }

  const authState = getState();
  root.innerHTML = `
    <div class="modal game-modal">
      <h3>🏠 ${letters} Plot</h3>
      <div class="auth-status" id="pc-status">Checking...</div>
      <button class="btn btn-primary" id="pc-action" style="width:100%;display:none;"></button>

      <h3 style="margin-top:18px;font-size:15px;">👥 Roster</h3>
      <div class="corkboard-sub" id="pc-roster-sub">Loading...</div>
      <div class="leaderboard-list" id="pc-roster" style="max-height:120px;"></div>
      <button class="btn btn-secondary" id="pc-join" style="width:100%;margin-top:8px;display:none;"></button>

      <h3 style="margin-top:18px;font-size:15px;">🎉 Probate Night</h3>
      <p class="corkboard-sub">The public stepping reveal where new members are introduced to the Yard.</p>
      <div class="leaderboard-list" id="pc-probate" style="max-height:100px;"></div>
      <button class="btn btn-secondary" id="pc-probate-signup" style="width:100%;margin-top:8px;display:none;">Sign up for Probate Night</button>

      <button class="btn btn-secondary close" style="width:100%;margin-top:12px;">Close</button>
    </div>`;

  const statusEl = root.querySelector("#pc-status");
  const actionBtn = root.querySelector("#pc-action");
  const rosterSubEl = root.querySelector("#pc-roster-sub");
  const rosterEl = root.querySelector("#pc-roster");
  const joinBtn = root.querySelector("#pc-join");
  const probateEl = root.querySelector("#pc-probate");
  const probateBtn = root.querySelector("#pc-probate-signup");

  async function refreshPlot() {
    const { data } = await supabase.from("plot_claims").select("*").eq("letters", letters).maybeSingle();
    if (!data) {
      statusEl.textContent = "This plot is unclaimed.";
      if (authState.user) {
        actionBtn.textContent = "Claim this plot";
        actionBtn.style.display = "block";
        actionBtn.onclick = async () => {
          const { error } = await supabase.from("plot_claims").insert({
            letters,
            user_id: authState.user.id,
            display_name: authState.profile?.display_name || "Golden Lion",
          });
          if (error) statusEl.textContent = "Couldn't claim: " + error.message;
          else {
            unlockAchievement("plot_owner");
            refreshPlot();
          }
        };
      } else {
        actionBtn.style.display = "none";
        statusEl.textContent += " Join the Yard (Sign up/Log in) to claim it.";
      }
      return;
    }
    const mine = authState.user && data.user_id === authState.user.id;
    statusEl.textContent = mine ? "You hold this plot." : `Claimed by ${data.display_name}.`;
    if (mine) {
      actionBtn.textContent = "Release this plot";
      actionBtn.style.display = "block";
      actionBtn.onclick = async () => {
        await supabase.from("plot_claims").delete().eq("letters", letters);
        refreshPlot();
      };
    } else {
      actionBtn.style.display = "none";
    }
  }

  async function refreshRoster() {
    const { data } = await supabase.from("org_members").select("*").eq("letters", letters).order("joined_at", { ascending: true });
    const members = data || [];
    rosterSubEl.textContent = `${members.length} member${members.length === 1 ? "" : "s"} on the roster.`;
    rosterEl.innerHTML = members.length
      ? ""
      : '<div style="opacity:0.5;font-size:12px;text-align:center;padding:8px;">No members yet.</div>';
    members.forEach((m) => {
      const row = document.createElement("div");
      row.className = "lb-row";
      row.innerHTML = `<span class="lb-rank">👤</span><span class="lb-name">${m.display_name}</span><span></span>`;
      rosterEl.appendChild(row);
    });

    if (!authState.user) {
      joinBtn.style.display = "none";
      return;
    }
    const mine = members.find((m) => m.user_id === authState.user.id);
    const { data: myMembership } = await supabase
      .from("org_members")
      .select("letters")
      .eq("user_id", authState.user.id)
      .maybeSingle();

    joinBtn.style.display = "block";
    if (mine) {
      joinBtn.textContent = "Leave this org";
      joinBtn.onclick = async () => {
        await supabase.from("org_members").delete().eq("user_id", authState.user.id);
        refreshRoster();
      };
    } else if (myMembership) {
      joinBtn.textContent = `Already a member of ${myMembership.letters}`;
      joinBtn.disabled = true;
    } else {
      joinBtn.disabled = false;
      joinBtn.textContent = `Join ${letters}`;
      joinBtn.onclick = async () => {
        const { error } = await supabase.from("org_members").insert({
          user_id: authState.user.id,
          letters,
          display_name: authState.profile?.display_name || "Golden Lion",
        });
        if (error) alert("Couldn't join: " + error.message);
        else refreshRoster();
      };
    }
  }

  async function refreshProbate() {
    const { data } = await supabase
      .from("probate_signups")
      .select("*")
      .eq("letters", letters)
      .order("created_at", { ascending: true });
    const signups = data || [];
    probateEl.innerHTML = signups.length
      ? ""
      : '<div style="opacity:0.5;font-size:12px;text-align:center;padding:8px;">No one signed up yet.</div>';
    signups.forEach((s) => {
      const row = document.createElement("div");
      row.className = "lb-row";
      row.innerHTML = `<span class="lb-rank">🎙️</span><span class="lb-name">${s.display_name}</span><span></span>`;
      probateEl.appendChild(row);
    });

    if (!authState.user) {
      probateBtn.style.display = "none";
      return;
    }
    const already = signups.some((s) => s.user_id === authState.user.id);
    probateBtn.style.display = "block";
    probateBtn.disabled = already;
    probateBtn.textContent = already ? "You're signed up" : "Sign up for Probate Night";
    probateBtn.onclick = async () => {
      const { error } = await supabase.from("probate_signups").insert({
        user_id: authState.user.id,
        letters,
        display_name: authState.profile?.display_name || "Golden Lion",
      });
      if (error) alert("Couldn't sign up: " + error.message);
      else refreshProbate();
    };
  }

  refreshPlot();
  refreshRoster();
  refreshProbate();
  root.querySelector(".close").addEventListener("click", () => onClose?.());
}
