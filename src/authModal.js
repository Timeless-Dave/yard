import { ONLINE } from "./onlineConfig.js";
import {
  quickJoin,
  signInWithGoogle,
  signUpWithEmail,
  signInWithEmail,
  sendPasswordReset,
  signOut,
  setDisplayName,
  deleteAccount,
  getState,
} from "./auth.js";
import { esc } from "./text.js";

function friendlyError(e) {
  const code = e?.code || "";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) return "Wrong email or password.";
  if (code.includes("email-already-in-use")) return "That email's already signed up — try logging in instead.";
  if (code.includes("weak-password")) return "Password needs to be at least 6 characters.";
  if (code.includes("invalid-email")) return "That email doesn't look right.";
  if (code.includes("user-not-found")) return "No account with that email yet — try signing up instead.";
  if (code.includes("popup-closed-by-user")) return "Google sign-in was closed before finishing.";
  if (code.includes("too-many-requests")) return "Too many tries — wait a minute and try again.";
  return e?.message || "Something went wrong.";
}

const GUIDELINES_NOTE = `<p class="auth-hint" style="margin-top:10px;">By joining you agree to the <a href="#" class="guidelines-link">Community Guidelines</a>. Unofficial fan project — not affiliated with or endorsed by any university.</p>`;

function wireGuidelinesLink(root, openModal) {
  root.querySelectorAll(".guidelines-link").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      openModal?.("guidelines");
    })
  );
}

function mountSignedIn(root, { onClose, openModal }) {
  const state = getState();
  root.innerHTML = `
    <div class="modal">
      <h3>👋 ${esc(state.profile?.display_name || "Golden Lion")}</h3>
      <p>${state.banned ? "Your account has been suspended from posting for breaking the Community Guidelines." : "You're signed in and visible to other players on the Yard."}</p>
      <div class="auth-pane">
        <input id="am-rename" type="text" maxlength="24" value="${esc(state.profile?.display_name || "")}" placeholder="Your name on the Yard" />
        <button class="btn btn-secondary" id="am-rename-save" style="width:100%;">Change name</button>
      </div>
      ${state.isAdmin ? '<button class="btn btn-secondary" id="am-modqueue" style="width:100%;margin-top:8px;">🛡️ Moderation queue</button>' : ""}
      <div class="auth-status" id="am-status"></div>
      <button class="btn btn-secondary" id="am-signout" style="width:100%;margin:8px 0;">Sign out</button>
      <button class="btn btn-primary close" style="width:100%;">Close</button>
      <p class="auth-hint" style="margin-top:12px;text-align:center;">
        <a href="#" class="guidelines-link">Community Guidelines</a> ·
        <a href="#" id="am-delete" style="color:#e66;">Delete my account</a>
      </p>
    </div>`;
  const statusEl = root.querySelector("#am-status");

  root.querySelector("#am-rename-save").addEventListener("click", async () => {
    const result = await setDisplayName(root.querySelector("#am-rename").value);
    statusEl.textContent = result.ok ? "Name updated." : result.error;
  });
  root.querySelector("#am-modqueue")?.addEventListener("click", () => openModal?.("modqueue"));
  root.querySelector("#am-signout").addEventListener("click", async () => {
    await signOut();
    onClose?.();
  });
  root.querySelector("#am-delete").addEventListener("click", async (e) => {
    e.preventDefault();
    if (!confirm("Delete your account? This removes your profile, coins, cosmetics, achievements, and everything you've posted. It can't be undone.")) return;
    statusEl.textContent = "Deleting...";
    try {
      await deleteAccount();
      onClose?.();
    } catch (err) {
      statusEl.textContent = friendlyError(err);
    }
  });
  root.querySelector(".close").addEventListener("click", () => onClose?.());
  wireGuidelinesLink(root, openModal);
}

export function mountAuthModal(root, { onClose, openModal } = {}) {
  if (!ONLINE) {
    root.innerHTML = `
      <div class="modal">
        <h3>🔌 Playing solo</h3>
        <p>This copy of The Yard is running single-player — walk the campus, play every minigame, and unlock achievements on this device. Accounts and seeing other players aren't switched on here yet.</p>
        <button class="btn btn-primary close" style="width:100%;">Got it</button>
      </div>`;
    root.querySelector(".close").addEventListener("click", () => onClose?.());
    return;
  }

  if (getState().user) {
    mountSignedIn(root, { onClose, openModal });
    return;
  }

  root.innerHTML = `
    <div class="modal">
      <h3>🦁 Join the Yard</h3>
      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="quick">Quick join</button>
        <button class="auth-tab" data-tab="email">Email</button>
      </div>
      <div id="am-quick" class="auth-pane">
        <p class="auth-hint">Pick a name — no email, no password. Good to go in a second.</p>
        <input id="am-name" type="text" maxlength="24" placeholder="Your name on the Yard" />
        <button class="btn btn-primary" id="am-join" style="width:100%;">Join now</button>
      </div>
      <div id="am-email" class="auth-pane hidden">
        <p class="auth-hint">Log in, or create an account to keep your coins and fits across devices.</p>
        <input id="am-email-input" type="email" placeholder="you@example.com" autocomplete="email" />
        <input id="am-password-input" type="password" placeholder="Password (6+ characters)" autocomplete="current-password" />
        <input id="am-signup-name" type="text" maxlength="24" placeholder="Name on the Yard (for new accounts)" />
        <div class="auth-row">
          <button class="btn btn-primary" id="am-login" style="flex:1;">Log in</button>
          <button class="btn btn-secondary" id="am-signup" style="flex:1;">Sign up</button>
        </div>
        <p class="auth-hint" id="am-forgot" style="text-align:center;cursor:pointer;text-decoration:underline;">Forgot password?</p>
        <div class="auth-row">
          <button class="btn btn-secondary" id="am-google" style="width:100%;">Continue with Google</button>
        </div>
      </div>
      <div class="auth-status" id="am-status"></div>
      ${GUIDELINES_NOTE}
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

  async function attempt(label, fn) {
    statusEl.textContent = label;
    try {
      await fn();
      onClose?.();
    } catch (e) {
      statusEl.textContent = friendlyError(e);
    }
  }

  root.querySelector("#am-join").addEventListener("click", () => {
    const name = root.querySelector("#am-name").value.trim();
    if (!name) {
      statusEl.textContent = "Pick a name first.";
      return;
    }
    attempt("Joining...", () => quickJoin(name));
  });

  const emailInput = root.querySelector("#am-email-input");
  const passwordInput = root.querySelector("#am-password-input");
  const credentials = () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) statusEl.textContent = "Enter your email and password.";
    return email && password ? { email, password } : null;
  };

  root.querySelector("#am-login").addEventListener("click", () => {
    const c = credentials();
    if (c) attempt("Logging in...", () => signInWithEmail(c.email, c.password));
  });
  root.querySelector("#am-signup").addEventListener("click", () => {
    const c = credentials();
    const name = root.querySelector("#am-signup-name").value.trim();
    if (c) attempt("Creating account...", () => signUpWithEmail(c.email, c.password, name));
  });
  root.querySelector("#am-forgot").addEventListener("click", async () => {
    const email = emailInput.value.trim();
    if (!email) {
      statusEl.textContent = "Enter your email first, then tap this again.";
      return;
    }
    try {
      await sendPasswordReset(email);
      statusEl.textContent = "Check your email for a password reset link.";
    } catch (e) {
      statusEl.textContent = friendlyError(e);
    }
  });
  root.querySelector("#am-google").addEventListener("click", () => attempt("Opening Google sign-in...", signInWithGoogle));

  root.querySelector(".close").addEventListener("click", () => onClose?.());
  wireGuidelinesLink(root, openModal);
}
