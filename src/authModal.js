import { ONLINE } from "./firebase.js";
import { quickJoin, signInWithGoogle, signUpWithEmail, signInWithEmail, sendPasswordReset, signOut, getState } from "./auth.js";

function friendlyError(e) {
  const code = e?.code || "";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) return "Wrong email or password.";
  if (code.includes("email-already-in-use")) return "That email's already signed up — try logging in instead.";
  if (code.includes("weak-password")) return "Password needs to be at least 6 characters.";
  if (code.includes("user-not-found")) return "No account with that email yet — try signing up instead.";
  if (code.includes("popup-closed-by-user")) return "Google sign-in was closed before finishing.";
  return e?.message || "Something went wrong.";
}

export function mountAuthModal(root, { onClose } = {}) {
  const state = getState();

  if (!ONLINE) {
    root.innerHTML = `
      <div class="modal">
        <h3>🔌 Multiplayer not connected</h3>
        <p>This prototype is running single-player. To let real Golden Lions sign up, log in, and see each other on the Yard, connect a free Firebase project — see <code>firebase/README.md</code> in the project.</p>
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
        <button class="auth-tab" data-tab="email">Email</button>
      </div>
      <div id="am-quick" class="auth-pane">
        <p class="auth-hint">Pick a name — no email, no password. Good to go in a second.</p>
        <input id="am-name" type="text" maxlength="24" placeholder="Your name on the Yard" />
        <button class="btn btn-primary" id="am-join" style="width:100%;">Join now</button>
      </div>
      <div id="am-email" class="auth-pane hidden">
        <p class="auth-hint">Log in or create an account with an email and password.</p>
        <input id="am-email-input" type="email" placeholder="you@example.com" />
        <input id="am-password-input" type="password" placeholder="Password" />
        <div class="auth-row">
          <button class="btn btn-primary" id="am-login" style="flex:1;">Log in</button>
          <button class="btn btn-secondary" id="am-signup" style="flex:1;">Sign up</button>
        </div>
        <p class="auth-hint" id="am-forgot" style="text-align:center;cursor:pointer;text-decoration:underline;">Forgot password?</p>
        <div class="auth-row">
          <button class="btn btn-secondary" id="am-google" style="width:100%;">🔵 Continue with Google</button>
        </div>
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
      statusEl.textContent = friendlyError(e);
    }
  });

  const emailInput = root.querySelector("#am-email-input");
  const passwordInput = root.querySelector("#am-password-input");

  root.querySelector("#am-login").addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      statusEl.textContent = "Enter your email and password.";
      return;
    }
    statusEl.textContent = "Logging in...";
    try {
      await signInWithEmail(email, password);
      onClose?.();
    } catch (e) {
      statusEl.textContent = friendlyError(e);
    }
  });

  root.querySelector("#am-signup").addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      statusEl.textContent = "Enter an email and password.";
      return;
    }
    statusEl.textContent = "Creating account...";
    try {
      await signUpWithEmail(email, password);
      onClose?.();
    } catch (e) {
      statusEl.textContent = friendlyError(e);
    }
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

  root.querySelector("#am-google").addEventListener("click", async () => {
    statusEl.textContent = "Opening Google sign-in...";
    try {
      await signInWithGoogle();
      onClose?.();
    } catch (e) {
      statusEl.textContent = friendlyError(e);
    }
  });

  root.querySelector(".close").addEventListener("click", () => onClose?.());
}
