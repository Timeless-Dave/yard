import { ONLINE } from '../onlineConfig.js';
export function mountOnboarding(root, { onClose } = {}) {
  root.innerHTML = `<div class="modal game-modal onboarding-modal">
    <h3>Find your way around UAPB</h3>
    <p><b>Move:</b> WASD, arrow keys, a controller, or drag the gold joystick. Movement follows the camera. Hide the joystick with Hide movement.</p>
    <p><b>Look closer:</b> use the Camera panel, the mouse wheel, or + and −. Q and R rotate. Press 0 to reset.</p>
    <p><b>Join an activity:</b> approach a marked spot and press E, tap E, or use A on a controller. Explore UAPB also lists the games.</p>
    <p><b>Change your look:</b> open My character anytime. Your appearance is saved in this browser.</p>
    <p>${ONLINE ? 'Accounts connect you to community features. Open Account in Explore UAPB to join.' : 'This build runs solo. Online chat, voting, purchases, and shared progress need a connected backend.'}</p>
    <p>The campus layout is stylized. Some activity locations are fictional additions.</p>
    <button class="btn btn-primary close">Back to the Yard</button>
  </div>`;
  root.querySelector('.close').onclick = onClose;
}
