import { supabase, ONLINE } from "../supabase.js";
import { getState } from "../auth.js";

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
        <p>Claim a Divine Nine plot house. Decorate it, host step practice, and defend your spot — plots can be sponsored by real chapters for Homecoming. Connect Supabase (see <code>supabase/README.md</code>) to make claims real and shared.</p>
        <button class="btn btn-primary close" style="width:100%;">Close</button>
      </div>`;
    root.querySelector(".close").addEventListener("click", () => onClose?.());
    return;
  }

  const authState = getState();
  root.innerHTML = `
    <div class="modal">
      <h3>🏠 ${letters} Plot</h3>
      <div class="auth-status" id="pc-status">Checking...</div>
      <button class="btn btn-primary" id="pc-action" style="width:100%;display:none;"></button>
      <button class="btn btn-secondary close" style="width:100%;margin-top:8px;">Close</button>
    </div>`;

  const statusEl = root.querySelector("#pc-status");
  const actionBtn = root.querySelector("#pc-action");

  async function refresh() {
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
          else refresh();
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
        refresh();
      };
    } else {
      actionBtn.style.display = "none";
    }
  }

  refresh();
  root.querySelector(".close").addEventListener("click", () => onClose?.());
}
