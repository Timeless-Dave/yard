import { describe, expect, it, vi } from 'vitest';
import { createInputController } from '../../src/inputController.js';

function host() {
  const node = new EventTarget();
  node.hidden = false;
  return node;
}

describe('input controller', () => {
  it('merges keyboard, stick, and gamepad into one vector without synthetic movement keys', () => {
    const pads = [{
      axes: [0.8, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
    }];
    pads[0].buttons[15] = { pressed: true };
    const win = host();
    const dispatch = vi.spyOn(win, 'dispatchEvent');
    const input = createInputController({ getGamepads: () => pads, window: win, document: win });
    input.gamepadIndex = 0;
    input.setKey('w', true);
    input.setStick(0.2, 0);
    const state = input.poll();
    expect(state.dx).toBeCloseTo(0.8 + 0.2 + 1);
    expect(state.dz).toBeCloseTo(-1);
    expect(dispatch).not.toHaveBeenCalled();
    input.dispose();
  });

  it('ignores movement while blocked and clears on blur', () => {
    let blocked = true;
    const win = host();
    const input = createInputController({ isBlocked: () => blocked, window: win, document: win });
    input.setKey('d', true);
    input.setStick(1, 0);
    expect(input.poll().dx).toBe(0);
    blocked = false;
    expect(input.poll().dx).toBe(2);
    win.dispatchEvent(new Event('blur'));
    expect(input.poll().dx).toBe(0);
    input.dispose();
  });

  it('mirrors D-pad to keyboard only while a modal is open', () => {
    const pads = [{
      axes: [0, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
    }];
    pads[0].buttons[12] = { pressed: true };
    const win = host();
    const dispatch = vi.spyOn(win, 'dispatchEvent');
    const input = createInputController({ getGamepads: () => pads, window: win, document: win });
    input.gamepadIndex = 0;
    input.poll({ modalOpen: false });
    expect(dispatch).not.toHaveBeenCalled();
    input.poll({ modalOpen: true });
    expect(dispatch).toHaveBeenCalled();
    const event = dispatch.mock.calls[0][0];
    expect(event.key).toBe('ArrowUp');
    input.dispose();
  });
});
