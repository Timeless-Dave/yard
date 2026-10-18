const STORAGE_KEY = "yard-onboarded-v1";

export function hasSeenOnboarding() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* storage unavailable, no-op */
  }
}

export function mountOnboarding(root, { onClose } = {}) {
  root.innerHTML = `
    <div class="modal game-modal onboarding-modal">
      <h3>🦁 Welcome to The Yard</h3>
      <p class="corkboard-sub">A walkable, living version of UAPB's campus — built for homecoming.</p>

      <div class="onboard-section">
        <div class="onboard-icon">🕹️</div>
        <div>
          <b>Get around</b><br/>
          <span class="corkboard-sub">WASD / arrow keys, a controller, or the on-screen D-pad on phones. Check the minimap top-right if you get lost — the campus is real-scale.</span>
        </div>
      </div>

      <div class="onboard-section">
        <div class="onboard-icon">✨</div>
        <div>
          <b>Interact</b><br/>
          <span class="corkboard-sub">Walk up to a glowing spot and press <b>E</b> (or <b>A</b> on a controller, or the on-screen button). That's how you play minigames, vote, claim a plot, and more.</span>
        </div>
      </div>

      <div class="onboard-section">
        <div class="onboard-icon">🪙</div>
        <div>
          <b>Yard Coin</b><br/>
          <span class="corkboard-sub">Win minigames (Spades, Dominoes, Pager, Cookout, Step Show) to earn coin. Spend it on fits in the Store, or a snack at a vending machine.</span>
        </div>
      </div>

      <div class="onboard-section">
        <div class="onboard-icon">🏅</div>
        <div>
          <b>The Checklist</b><br/>
          <span class="corkboard-sub">A running list of things to do around the Yard — vote, claim a Divine Nine plot, pull up to a party, post to the corkboard, and more.</span>
        </div>
      </div>

      <div class="onboard-section">
        <div class="onboard-icon">👥</div>
        <div>
          <b>Sign up to be seen</b><br/>
          <span class="corkboard-sub">You can walk around solo, but signing up (no password needed) lets other Golden Lions see you, lets your progress save, and unlocks voting, the store, and parties.</span>
        </div>
      </div>

      <button class="btn btn-primary" id="onboard-done" style="width:100%;margin-top:8px;">Let's go!</button>
    </div>`;

  root.querySelector("#onboard-done").addEventListener("click", () => {
    markSeen();
    onClose?.();
  });
}
