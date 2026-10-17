import { ONLINE } from "./supabase.js";
import { quickJoin, sendMagicLink, signOut, getState } from "./auth.js";

export function mountAuthModal(root, { onClose } = {}) {
  const state = getState();

  if (!ONLINE) {
    root.innerHTML = `
      <div class="modal">
        <h3>🔌 Multiplayer not connected</h3>
        <p>This prototype is running single-player. To let real Golden Lions sign up, log in, and see each other on the Yard, connect a free Supabase project — see <code>supabase/README.md</code> in the project.</p>
        <button class="btn btn-primary close" style="width:100%;">Got it</button>
      </div>`;
    root.querySelector(".close").addEventListener("click", () => onClose?.());
    return;
  }

  if (state.user) {
    root.innerHTML = `
      <div class="modal">
        <h3>👋 ${state.profile?.display_name || "Golden Lion"}</h3>
        <p>You're signed in and visible to other players on the Yard.</p>
        <button class="btn btn-secondary" id="am-signout" style="width:100%;margin-bottom:8px;">Sign out</button>
        <button class="btn btn-primary close" style="width:100%;">Close</button>
      </div>`;
    root.querySelector("#am-signout").addEventListener("click", async () => {
      await signOut();
      onClose?.();
    });
    root.querySelector(".close").addEventListener("click", () => onClose?.());
    return;
  }

  root.innerHTML = `
    <div class="modal">
      <h3>🦁 Join the Yard</h3>
      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="quick">Quick join</button>
        <button class="auth-tab" data-tab="email">Email link</button>
      </div>
      <div id="am-quick" class="auth-pane">
        <p class="auth-hint">Pick a name — no email, no password. Good to go in a second.</p>
        <input id="am-name" type="text" maxlength="24" placeholder="Your name on the Yard" />
        <button class="btn btn-primary" id="am-join" style="width:100%;">Join now</button>
      </div>
      <div id="am-email" class="auth-pane hidden">
        <p class="auth-hint">We'll email you a sign-in link — no password ever.</p>
        <input id="am-email-input" type="email" placeholder="you@example.com" />
        <button class="btn btn-primary" id="am-send" style="width:100%;">Send magic link</button>
      </div>
      <div class="auth-status" id="am-status"></div>
      <button class="btn btn-secondary close" style="width:100%;margin-top:8px;">Cancel</button>
    </div>`;

  const statusEl = root.querySelector("#am-status");
  root.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      root.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      root.querySelector("#am-quick").classList.toggle("hidden", tab.dataset.tab !== "quick");
      root.querySelector("#am-email").classList.toggle("hidden", tab.dataset.tab !== "email");
      statusEl.textContent = "";
    });
  });

  root.querySelector("#am-join").addEventListener("click", async () => {
    const name = root.querySelector("#am-name").value.trim();
    if (!name) {
      statusEl.textContent = "Pick a name first.";
      return;
    }
    statusEl.textContent = "Joining...";
    try {
      await quickJoin(name);
      onClose?.();
    } catch (e) {
      statusEl.textContent = e.message;
    }
  });

  root.querySelector("#am-send").addEventListener("click", async () => {
    const email = root.querySelector("#am-email-input").value.trim();
    if (!email) {
      statusEl.textContent = "Enter your email first.";
      return;
    }
    statusEl.textContent = "Sending...";
    try {
      await sendMagicLink(email);
      statusEl.textContent = "Check your email for the sign-in link!";
    } catch (e) {
      statusEl.textContent = e.message;
    }
  });

  root.querySelector(".close").addEventListener("click", () => onClose?.());
}
