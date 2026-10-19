// DOM shell and pointer controls. The simulation owns camera and movement state.
export function mountExperience({ online, onEnter, onCustomize, onZoom, onRotate, onReset, onMove, onNavigate, onRecover, onQuality, qualityText, onMap, onTopView }) {
  const app = document.getElementById('app');
  const topbar = document.querySelector('.topbar');
  const chips = document.querySelector('.chip-row');
  const menu = document.createElement('details'); menu.className = 'yard-menu';
  menu.innerHTML = '<summary>Explore UAPB</summary>';
  topbar.insertBefore(menu, chips); menu.append(chips);
  document.getElementById('campus-switch')?.remove();
  const navigate = document.createElement('button'); navigate.className = 'chip'; navigate.id = 'navigate-button'; navigate.textContent = 'Find a building'; navigate.onclick = () => { menu.open = false; onNavigate(); };
  const mapChip = document.createElement('button'); mapChip.className = 'chip'; mapChip.textContent = 'Map'; mapChip.onclick = () => { menu.open = false; onMap?.(); };
  const recover = document.createElement('button'); recover.className = 'chip'; recover.textContent = 'Return to Bell Tower'; recover.onclick = () => { menu.open = false; onRecover(); };
  const account = document.createElement('button'); account.className = 'chip'; account.dataset.modal = 'auth'; account.textContent = 'Account';
  const quality = document.createElement('button'); quality.className = 'chip'; quality.id = 'quality-toggle'; quality.textContent = qualityText || 'Quality: Medium';
  quality.onclick = () => { if (onQuality) quality.textContent = onQuality(); };
  const byModal = name => chips.querySelector(`[data-modal="${name}"]`);
  const byId = id => document.getElementById(id);
  const grouped = new Set();
  const groups = [
    ['Explore', [navigate, mapChip, recover, byModal('onboarding'), byId('night-toggle'), byId('weather-badge')]],
    ['Play', ['cards', 'stepshow', 'dominoes', 'pager', 'cookout', 'achievements'].map(byModal)],
    ['Community', ['king', 'plots', 'billboards', 'community', 'chat', 'leaderboard', 'store', 'parties'].map(byModal)],
    ['Settings', [account, quality, byId('install-chip'), byId('sound-toggle')]],
  ];
  for (const [, items] of groups) for (const item of items) if (item) grouped.add(item);
  // Any chip not named above stays reachable, in Explore, instead of being dropped.
  const leftovers = [...chips.querySelectorAll(':scope > .chip')].filter(el => !grouped.has(el));
  groups[0][1].push(...leftovers);
  for (const [title, items] of groups) {
    const section = document.createElement('section'); section.className = 'menu-group';
    const heading = document.createElement('div'); heading.className = 'menu-group-heading'; heading.textContent = title;
    const row = document.createElement('div'); row.className = 'menu-group-items';
    for (const item of items) if (item) row.append(item);
    section.append(heading, row); chips.append(section);
  }
  if (!online) {
    for (const name of ['king', 'plots', 'billboards', 'community', 'chat', 'leaderboard', 'store', 'parties']) {
      const chip = byModal(name);
      if (!chip) continue;
      chip.disabled = true;
      chip.title = 'Sign in after you add Firebase config';
    }
    for (const name of ['cards', 'stepshow', 'dominoes', 'pager', 'cookout', 'achievements']) {
      const chip = byModal(name);
      if (chip) chip.disabled = false;
    }
  }
  menu.addEventListener('click', e => { if (e.target.closest('button[data-modal]')) menu.open = false; });
  document.addEventListener('pointerdown', e => { if (!menu.contains(e.target)) menu.open = false; });
  const customize = document.createElement('button'); customize.className = 'btn btn-primary'; customize.textContent = 'My character'; customize.id = 'character-button'; customize.onclick = onCustomize; topbar.append(customize);
  document.querySelector('.bottom-card').innerHTML = `<div class="label" id="player-count-label">${online ? 'Connecting to the Yard' : 'Solo, UAPB campus'}</div>`;
  document.querySelector('.hint').innerHTML = '<b>WASD / arrows</b> move, <b>E</b> interact<br><b>+ / -</b> zoom, <b>Q / R</b> rotate, <b>0</b> follow, tap map to pan';
  const controls = document.createElement('details'); controls.className = 'camera-controls'; controls.open = true;
  controls.innerHTML = '<summary>Camera</summary><div><button aria-label="Zoom in">+</button><button aria-label="Zoom out">−</button><button aria-label="Rotate camera left">↶</button><button aria-label="Rotate camera right">↷</button><button aria-label="Top-down view">Top</button><button aria-label="Reset camera">Follow</button></div>';
  const actions = [() => onZoom(-.12), () => onZoom(.12), () => onRotate(-Math.PI / 8), () => onRotate(Math.PI / 8), () => onTopView?.(), onReset];
  controls.querySelectorAll('button').forEach((b, i) => b.onclick = actions[i]); app.append(controls);
  const touch = document.getElementById('touch-controls');
  const joystick = document.createElement('div'); joystick.className = 'joystick'; joystick.setAttribute('aria-label', 'Drag to move; keyboard users use WASD'); joystick.innerHTML = '<span></span>';
  touch.prepend(joystick);
  const knob = joystick.firstElementChild;
  let pointer = null;
  function reset() { pointer = null; knob.style.transform = ''; onMove(0, 0); }
  function move(e) {
    if (e.pointerId !== pointer) return;
    const r = joystick.getBoundingClientRect(), dx = e.clientX - r.x - r.width / 2, dz = e.clientY - r.y - r.height / 2;
    const distance = Math.hypot(dx, dz), scale = Math.max(38, distance);
    onMove(distance < 7 ? 0 : dx / scale, distance < 7 ? 0 : dz / scale);
    knob.style.transform = `translate(${dx / scale * 38}px, ${dz / scale * 38}px)`;
  }
  joystick.onpointerdown = e => { pointer = e.pointerId; joystick.setPointerCapture(pointer); move(e); };
  joystick.onpointermove = move; joystick.onpointerup = reset; joystick.onpointercancel = reset; joystick.onlostpointercapture = reset;
  window.addEventListener('blur', reset);
  const toggle = document.createElement('button'); toggle.className = 'movement-toggle'; toggle.textContent = 'Hide movement'; toggle.setAttribute('aria-expanded', 'true');
  toggle.onclick = () => { const hidden = touch.classList.toggle('collapsed'); toggle.textContent = hidden ? 'Show movement' : 'Hide movement'; toggle.setAttribute('aria-expanded', String(!hidden)); reset(); };
  app.append(toggle);
  const landing = document.createElement('section'); landing.className = 'landing'; landing.setAttribute('aria-label', 'Welcome to The Yard');
  landing.innerHTML = `<div class="landing-rail"></div><div class="landing-sheet"><p class="landing-brand">The Yard</p><p class="landing-school">University of Arkansas at Pine Bluff</p><div class="landing-copy"><h1>Walk UAPB.</h1><p>Bell Tower, Union, library. Games on the lawn.</p><div class="landing-actions"><button class="btn btn-primary" id="enter-yard">Enter</button><button class="btn btn-secondary" id="customize-from-landing">Character</button>${online ? '<button class="btn btn-secondary" id="sign-in-from-landing">Sign in</button>' : ''}</div><p class="landing-note">${online ? 'Campus works without an account. Sign in when you want other players.' : 'No account needed.'}</p></div><footer>Unofficial. Not affiliated with UAPB.</footer></div>`;
  app.append(landing); app.classList.add('at-landing');
  const enter = () => { landing.remove(); app.classList.remove('at-landing'); onEnter(); };
  document.getElementById('enter-yard').onclick = () => { enter(); customize.focus(); };
  document.getElementById('customize-from-landing').onclick = () => { enter(); onCustomize(); };
  document.getElementById('sign-in-from-landing')?.addEventListener('click', () => { enter(); document.querySelector('[data-modal="auth"]')?.click(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') menu.open = false; });
}
