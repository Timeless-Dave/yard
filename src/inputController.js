// Keyboard, analog stick, and gamepad collapse into one movement vector.
// Gamepad D-pad is part of that vector. Arrow key events are only mirrored
// into the window when a modal is open, so minigames keep working without
// driving the avatar from synthetic keys.

const MOVE_KEYS = {
  w: [0, -1], arrowup: [0, -1],
  s: [0, 1], arrowdown: [0, 1],
  a: [-1, 0], arrowleft: [-1, 0],
  d: [1, 0], arrowright: [1, 0],
};

function typingTarget(target) {
  return Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"]'));
}

function keyEvent(type, key) {
  const Ctor = typeof KeyboardEvent === 'function' ? KeyboardEvent : Event;
  const event = new Ctor(type, { key, bubbles: true });
  if (event.key !== key) Object.defineProperty(event, 'key', { value: key });
  return event;
}

export function createInputController({
  isBlocked = () => false, // movement/camera; poll still runs so modal D-pad can emit keys
  onZoom = () => {},
  onRotate = () => {},
  onReset = () => {},
  onInteract = () => {},
  getGamepads = () => (typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []),
  window: win = globalThis,
  document: doc = globalThis.document || globalThis,
} = {}) {
  const keys = Object.create(null);
  let stickX = 0, stickZ = 0, gamepadIndex = null;
  const padButtons = Object.create(null);
  const cleanups = [];

  function on(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  }

  function clear() {
    for (const key of Object.keys(keys)) keys[key] = false;
    stickX = stickZ = 0;
  }

  function blocked() {
    return isBlocked();
  }

  function setKey(key, down) {
    keys[key] = down;
  }

  function setStick(x, z) {
    stickX = x;
    stickZ = z;
  }

  on(win, 'blur', clear);
  on(doc, 'visibilitychange', () => { if (doc.hidden) clear(); });
  on(win, 'keydown', e => {
    if (typingTarget(e.target) || blocked()) return;
    const key = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault();
    setKey(key, true);
    if (key === '+' || key === '=') onZoom(-.08);
    if (key === '-') onZoom(.08);
    if (key === 'q') onRotate(-.12);
    if (key === 'r') onRotate(.12);
    if (key === '0') onReset();
    if (key === 'e') onInteract();
  });
  on(win, 'keyup', e => { setKey(e.key.toLowerCase(), false); });
  on(win, 'gamepadconnected', e => { gamepadIndex = e.gamepad.index; });
  on(win, 'gamepaddisconnected', () => { gamepadIndex = null; });

  function keyboardVector() {
    let dx = 0, dz = 0;
    for (const [key, delta] of Object.entries(MOVE_KEYS)) {
      if (keys[key]) { dx += delta[0]; dz += delta[1]; }
    }
    return { dx, dz };
  }

  function pollGamepad(modalOpen) {
    if (gamepadIndex === null) return { dx: 0, dz: 0, interact: false, connected: false };
    const gp = getGamepads()[gamepadIndex];
    if (!gp) return { dx: 0, dz: 0, interact: false, connected: false };
    const DEAD = 0.2;
    let dx = Math.abs(gp.axes[0]) > DEAD ? gp.axes[0] : 0;
    let dz = Math.abs(gp.axes[1]) > DEAD ? gp.axes[1] : 0;
    const dpad = [
      gp.buttons[12]?.pressed,
      gp.buttons[13]?.pressed,
      gp.buttons[14]?.pressed,
      gp.buttons[15]?.pressed,
    ];
    if (dpad[0]) dz -= 1;
    if (dpad[1]) dz += 1;
    if (dpad[2]) dx -= 1;
    if (dpad[3]) dx += 1;
    const aPressed = !!gp.buttons[0]?.pressed;
    const interact = aPressed && !padButtons.a;
    padButtons.a = aPressed;
    if (modalOpen) {
      const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      dpad.forEach((pressed, i) => {
        const name = arrows[i];
        if (pressed && !padButtons[name]) win.dispatchEvent(keyEvent('keydown', name));
        else if (!pressed && padButtons[name]) win.dispatchEvent(keyEvent('keyup', name));
        padButtons[name] = pressed;
      });
    }
    return { dx, dz, interact, connected: true };
  }

  function poll({ modalOpen = false } = {}) {
    const pad = pollGamepad(modalOpen);
    if (blocked() || modalOpen) {
      return { dx: 0, dz: 0, interact: false, sprint: false, connected: pad.connected || gamepadIndex !== null };
    }
    const keysV = keyboardVector();
    if (pad.interact) onInteract();
    return {
      dx: keysV.dx + pad.dx + stickX,
      dz: keysV.dz + pad.dz + stickZ,
      interact: pad.interact,
      sprint: Boolean(keys.shift),
      connected: pad.connected,
    };
  }

  return {
    keys,
    get gamepadIndex() { return gamepadIndex; },
    set gamepadIndex(value) { gamepadIndex = value; },
    setStick,
    setKey,
    clear,
    poll,
    dispose() { while (cleanups.length) cleanups.pop()(); },
  };
}
