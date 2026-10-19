import { HALLS, hallForBuilding, loadLease, saveLease, visitationLabel, accessFor } from '../housing.js';
import { getBalance, spendCoins } from '../economy.js';

export function mountHousing(root, { building, onClose, onEnter } = {}) {
  const hall = hallForBuilding(building) || HALLS.find(h => h.id === building) || HALLS[0];
  const lease = loadLease();
  const mine = lease?.hallId === hall.id;
  const access = accessFor(building || { name: hall.name }, { lease });
  root.innerHTML = `<div class="modal game-modal">
    <p class="auth-kicker">Housing</p>
    <h3>${hall.name}</h3>
    <p>${hall.band}. ${hall.note}</p>
    <p class="auth-hint">${visitationLabel()} Guests check in at the desk. This is a game lease, not a real housing contract.</p>
    <p><b>${hall.coins} Yard Coin</b> for a stylized double this session. JBJ is the highest in-game hall.</p>
    <p class="auth-status" id="hs-status">You have ${getBalance()} Yard Coin.${mine ? ' You already lease this hall.' : lease ? ` You currently lease ${lease.hallName}.` : ''}</p>
    ${access.mode === 'lobby' ? '<button class="btn btn-secondary" id="hs-visit" type="button">Enter lobby</button>' : ''}
    <button class="btn btn-primary" id="hs-rent" type="button">${mine ? 'Enter your room' : `Lease for ${hall.coins}`}</button>
    ${lease && !mine ? '<button class="btn btn-secondary" id="hs-drop" type="button">Drop current lease</button>' : ''}
    <button class="btn btn-secondary close" type="button">Close</button>
  </div>`;
  root.querySelector('#hs-visit')?.addEventListener('click', () => onEnter?.('lobby'));
  root.querySelector('#hs-rent').onclick = async () => {
    if (mine) { onEnter?.('room'); return; }
    const paid = await spendCoins(hall.coins, `housing: ${hall.id}`);
    const status = root.querySelector('#hs-status');
    if (!paid.ok) { status.textContent = paid.error; return; }
    saveLease({ hallId: hall.id, hallName: hall.name, paid: hall.coins, at: Date.now() });
    onEnter?.('room');
  };
  root.querySelector('#hs-drop')?.addEventListener('click', () => {
    saveLease(null);
    onClose();
  });
  root.querySelector('.close').onclick = onClose;
}
