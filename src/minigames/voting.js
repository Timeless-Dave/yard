import { supabase, ONLINE } from "../supabase.js";
import { getState } from "../auth.js";

export function mountVoting(root, { onClose } = {}) {
  if (!ONLINE) {
    root.innerHTML = `
      <div class="modal">
        <h3>🏆 Vote: Mr. / Miss UAPB Homecoming</h3>
        <p>Nominate and vote for this year's Homecoming King & Queen — one vote per category, change it any time before the polls close. Connect Supabase (see <code>supabase/README.md</code>) to turn this on.</p>
        <button class="btn btn-primary close" style="width:100%;">Close</button>
      </div>`;
    root.querySelector(".close").addEventListener("click", () => onClose?.());
    return;
  }

  const authState = getState();
  let category = "king";
  let channel = null;

  root.innerHTML = `
    <div class="modal game-modal">
      <h3>🏆 Homecoming Court</h3>
      <div class="auth-tabs">
        <button class="auth-tab active" data-cat="king">King</button>
        <button class="auth-tab" data-cat="queen">Queen</button>
      </div>
      <div class="leaderboard-list" id="vote-list">Loading...</div>
      <div class="corkboard-form" style="margin-top:10px;">
        <input id="vote-nominee" type="text" maxlength="30" placeholder="Nominate someone new" />
        <button class="btn btn-primary" id="vote-nominate" style="width:100%;">Add nominee</button>
      </div>
      <button class="btn btn-secondary close" style="margin-top:12px;width:100%;">Close</button>
    </div>`;

  const listEl = root.querySelector("#vote-list");
  const nomineeInput = root.querySelector("#vote-nominee");

  async function myVote() {
    if (!authState.user) return null;
    const { data } = await supabase
      .from("votes")
      .select("candidate_id")
      .eq("user_id", authState.user.id)
      .eq("category", category)
      .maybeSingle();
    return data?.candidate_id || null;
  }

  async function render() {
    listEl.innerHTML = "Loading...";
    const [{ data: tallies, error }, mine] = await Promise.all([
      supabase.from("candidate_tallies").select("*").eq("category", category).order("vote_count", { ascending: false }),
      myVote(),
    ]);
    if (error) {
      listEl.textContent = "Couldn't load candidates: " + error.message;
      return;
    }
    if (!tallies?.length) {
      listEl.innerHTML = '<div style="opacity:0.5;font-size:13px;text-align:center;padding:10px;">No nominees yet — add the first one below.</div>';
      return;
    }
    listEl.innerHTML = "";
    tallies.forEach((c) => {
      const row = document.createElement("div");
      row.className = "lb-row" + (c.id === mine ? " lb-me" : "");
      row.innerHTML = `
        <span class="lb-rank">${c.vote_count}</span>
        <span class="lb-name">${c.name}</span>
        <button class="btn ${c.id === mine ? "btn-primary" : "btn-secondary"}" style="padding:6px 12px;font-size:12px;">
          ${c.id === mine ? "Your vote" : "Vote"}
        </button>`;
      row.querySelector("button").addEventListener("click", async () => {
        if (!authState.user) {
          alert("Join the Yard first (Sign up / Log in) to vote.");
          return;
        }
        const { error: voteError } = await supabase
          .from("votes")
          .upsert({ user_id: authState.user.id, category, candidate_id: c.id }, { onConflict: "user_id,category" });
        if (voteError) alert("Couldn't vote: " + voteError.message);
        else render();
      });
      listEl.appendChild(row);
    });
  }

  root.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      root.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      category = tab.dataset.cat;
      render();
    });
  });

  root.querySelector("#vote-nominate").addEventListener("click", async () => {
    const name = nomineeInput.value.trim();
    if (!name) return;
    if (!authState.user) {
      alert("Join the Yard first (Sign up / Log in) to nominate someone.");
      return;
    }
    const { error } = await supabase.from("candidates").insert({ category, name, nominated_by: authState.user.id });
    if (error) alert("Couldn't nominate: " + error.message);
    else {
      nomineeInput.value = "";
      render();
    }
  });

  channel = supabase
    .channel("votes-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, () => render())
    .on("postgres_changes", { event: "*", schema: "public", table: "candidates" }, () => render())
    .subscribe();

  root.querySelector(".close").addEventListener("click", () => {
    if (channel) supabase.removeChannel(channel);
    onClose?.();
  });

  render();
}
