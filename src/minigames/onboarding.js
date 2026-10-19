import { ONLINE } from '../onlineConfig.js';
export function mountOnboarding(root, { onClose } = {}) {
  root.innerHTML = `<div class="modal game-modal onboarding-modal">
    <p class="auth-kicker">How to play</p>
    <h3>UAPB in four moves</h3>
    <ul class="how-list">
      <li><b>Move</b> WASD, arrows, or the gold stick. Camera sets the heading.</li>
      <li><b>Camera</b> + / − zoom. Q / R rotate. 0 resets.</li>
      <li><b>Act</b> Walk to a gold marker. E, tap, or controller A.</li>
      <li><b>Character</b> My character saves on this browser.</li>
    </ul>
    <p class="auth-hint">${ONLINE ? 'Account is optional. Use it when you want other players, chat, or shared progress.' : 'This build is solo. Chat, voting, and the store need a connected backend.'}</p>
    <p class="auth-hint">Layout is compressed. Some game spots are fictional.</p>
    <button class="btn btn-primary close" type="button">Back</button>
  </div>`;
  root.querySelector('.close').onclick = onClose;
}
