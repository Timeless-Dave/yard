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
  if (code.includes("email-already-in-use")) return "That email is already signed up. Log in instead.";
  if (code.includes("weak-password")) return "Password needs at least 6 characters.";
  if (code.includes("invalid-email")) return "That email does not look right.";
  if (code.includes("user-not-found")) return "No account with that email yet.";
  if (code.includes("popup-closed-by-user")) return "Google sign-in was closed.";
  if (code.includes("too-many-requests")) return "Too many tries. Wait a minute.";
  return e?.message || "Something went wrong.";
}

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
    <div class="modal auth-modal">
      <p class="auth-kicker">Account</p>
      <h3>${esc(state.profile?.display_name || "Golden Lion")}</h3>
      <p>${state.banned ? "This account cannot post until a moderator reviews it." : "You are signed in. Other players can see you on campus."}</p>
      <div class="auth-pane">
        <label class="auth-label" for="am-rename">Display name</label>
        <input id="am-rename" type="text" maxlength="24" value="${esc(state.profile?.display_name || "")}" />
        <button class="btn btn-secondary" id="am-rename-save" type="button">Save name</button>
      </div>
      ${state.isAdmin ? '<button class="btn btn-secondary" id="am-modqueue" type="button">Moderation queue</button>' : ""}
      <div class="auth-status" id="am-status" role="status"></div>
      <button class="btn btn-secondary" id="am-signout" type="button">Sign out</button>
      <button class="btn btn-primary close" type="button">Done</button>
      <p class="auth-hint"><a href="#" class="guidelines-link">Guidelines</a> · <a href="#" id="am-delete">Delete account</a></p>
    </div>`;
  const statusEl = root.querySelector("#am-status");
  root.querySelector("#am-rename-save").addEventListener("click", async () => {
    const result = await setDisplayName(root.querySelector("#am-rename").value);
    statusEl.textContent = result.ok ? "Name saved." : result.error;
  });
  root.querySelector("#am-modqueue")?.addEventListener("click", () => openModal?.("modqueue"));
  root.querySelector("#am-signout").addEventListener("click", async () => {
    await signOut();
    onClose?.();
  });
  root.querySelector("#am-delete").addEventListener("click", async (e) => {
    e.preventDefault();
    if (!confirm("Delete this account and all posts, coins, and progress? This cannot be undone.")) return;
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
      <div class="modal auth-modal">
        <p class="auth-kicker">Account</p>
        <h3>Playing on this device</h3>
        <p>Walk campus and play the games without an account. Multiplayer is not connected in this build.</p>
        <button class="btn btn-primary close" type="button">Close</button>
      </div>`;
    root.querySelector(".close").addEventListener("click", () => onClose?.());
    return;
  }

  if (getState().user) {
    mountSignedIn(root, { onClose, openModal });
    return;
  }

  root.innerHTML = `
    <div class="modal auth-modal">
      <p class="auth-kicker">Account</p>
      <h3>Join campus</h3>
      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="quick" type="button">Name</button>
        <button class="auth-tab" data-tab="email" type="button">Email</button>
      </div>
      <div id="am-quick" class="auth-pane">
        <label class="auth-label" for="am-name">What should we call you</label>
        <input id="am-name" type="text" maxlength="24" placeholder="Name" autocomplete="nickname" />
        <button class="btn btn-primary" id="am-join" type="button">Enter</button>
      </div>
      <div id="am-email" class="auth-pane hidden">
        <label class="auth-label" for="am-email-input">Email</label>
        <input id="am-email-input" type="email" placeholder="you@school.edu" autocomplete="email" />
        <label class="auth-label" for="am-password-input">Password</label>
        <input id="am-password-input" type="password" placeholder="6+ characters" autocomplete="current-password" />
        <label class="auth-label" for="am-signup-name">Name for new accounts</label>
        <input id="am-signup-name" type="text" maxlength="24" placeholder="Optional" />
        <div class="auth-row">
          <button class="btn btn-primary" id="am-login" type="button">Log in</button>
          <button class="btn btn-secondary" id="am-signup" type="button">Create account</button>
        </div>
        <button class="auth-text" id="am-forgot" type="button">Forgot password</button>
        <button class="btn btn-secondary" id="am-google" type="button">Continue with Google</button>
      </div>
      <div class="auth-status" id="am-status" role="status"></div>
      <p class="auth-hint">By joining you agree to the <a href="#" class="guidelines-link">guidelines</a>. Unofficial. Not affiliated with UAPB.</p>
      <button class="btn btn-secondary close" type="button">Cancel</button>
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
      statusEl.textContent = "Enter a name first.";
      return;
    }
    attempt("Signing in...", () => quickJoin(name));
  });

  const emailInput = root.querySelector("#am-email-input");
  const passwordInput = root.querySelector("#am-password-input");
  const credentials = () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) statusEl.textContent = "Enter email and password.";
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
      statusEl.textContent = "Enter your email, then tap Forgot password again.";
      return;
    }
    try {
      await sendPasswordReset(email);
      statusEl.textContent = "Check your email for a reset link.";
    } catch (e) {
      statusEl.textContent = friendlyError(e);
    }
  });
  root.querySelector("#am-google").addEventListener("click", () => attempt("Opening Google...", signInWithGoogle));
  root.querySelector(".close").addEventListener("click", () => onClose?.());
  wireGuidelinesLink(root, openModal);
}
