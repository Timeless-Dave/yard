export function mountGuidelines(root, { onClose } = {}) {
  root.innerHTML = `
    <div class="modal game-modal" style="max-height:80vh;overflow-y:auto;">
      <h3>📜 Community Guidelines</h3>
      <p class="corkboard-sub">The Yard is a shared space. Treat it like the real one.</p>
      <ul class="guidelines-list">
        <li><b>No hate, slurs, or harassment.</b> Not at anyone, not as a joke.</li>
        <li><b>No sexual content.</b></li>
        <li><b>Keep personal info off the Yard</b> — yours or anyone else's. No phone numbers, emails, addresses, or links.</li>
        <li><b>Don't impersonate</b> real students, staff, organizations, or other players.</li>
        <li><b>Greek life stays public-side.</b> Rosters, plot claims, and Probate Night are celebrations — no pledge-process or ritual content, ever.</li>
        <li><b>Don't spam</b> chat, the corkboard, nominations, or parties.</li>
      </ul>
      <h3 style="font-size:15px;margin-top:14px;">How moderation works</h3>
      <ul class="guidelines-list">
        <li>Everything you post is checked automatically, both in your browser and again on the server.</li>
        <li>Tap 🚩 on anything that breaks these rules. Anything reported by 3 different players is hidden right away until a moderator reviews it.</li>
        <li>Moderators can hide content and ban accounts from posting.</li>
        <li>Public posts are limited to one every few seconds.</li>
      </ul>
      <h3 style="font-size:15px;margin-top:14px;">Your data</h3>
      <ul class="guidelines-list">
        <li>We store your display name, avatar color, coins, cosmetics, achievements, and what you post publicly. Sign in with Google and only your first name is used by default.</li>
        <li>Your position on the map is shared live while you're playing and is never saved.</li>
        <li>Your Homecoming votes are private — only totals are public.</li>
        <li>You can delete your account and everything you've posted any time from the account menu.</li>
        <li>You must be 13 or older to make an account.</li>
      </ul>
      <p class="corkboard-sub" style="margin-top:14px;">The Yard is an unofficial fan project. It is not affiliated with, sponsored by, or endorsed by the University of Arkansas at Pine Bluff, Grambling State University, or any NPHC organization. Names and marks belong to their owners.</p>
      <button class="btn btn-primary close" style="width:100%;margin-top:8px;">Got it</button>
    </div>`;
  root.querySelector(".close").addEventListener("click", () => onClose?.());
}
