import { describe, it, expect, beforeEach } from 'vitest';
import { createInteractionTarget } from '../../src/interactionTarget.js';

describe('interactionTarget', () => {
  let target;

  beforeEach(() => {
    target = createInteractionTarget();
  });

  describe('pick', () => {
    it('returns null if no zones', () => {
      expect(target.pick([], 0, 0)).toBeNull();
    });

    it('returns the closest zone within radius', () => {
      const z1 = { x: 0, z: 0, radius: 2 };
      const z2 = { x: 5, z: 0, radius: 2 };
      const zones = [z1, z2];
      
      expect(target.pick(zones, 1, 0)).toBe(z1);
      expect(target.pick(zones, 4, 0)).toBe(z2);
    });

    it('returns null if no zone is within radius', () => {
      const z1 = { x: 0, z: 0, radius: 2 };
      const zones = [z1];
      
      expect(target.pick(zones, 3, 0)).toBeNull();
    });

    it('applies hysteresis keeping previous zone if still within 1.15x radius', () => {
      const prev = { x: 0, z: 0, radius: 2 };
      const zones = [prev];
      
      // Distance is 2.2, which is > 2.0 but <= 2.3 (2.0 * 1.15)
      expect(target.pick(zones, 2.2, 0, prev)).toBe(prev);
      
      // Distance is 2.4, which is > 2.3
      expect(target.pick(zones, 2.4, 0, prev)).toBeNull();
    });

    it('switches to a new zone if it is closer by at least 0.6', () => {
      const prev = { x: 0, z: 0, radius: 2 };
      const newZone = { x: 2, z: 0, radius: 2 };
      const zones = [prev, newZone];
      
      // dist to prev = 1.4, dist to newZone = 0.6. diff = 0.8 >= 0.6. Should pick newZone
      expect(target.pick(zones, 1.4, 0, prev)).toBe(newZone);
    });

    it('keeps previous zone if new zone is closer but not by 0.6', () => {
      const prev = { x: 0, z: 0, radius: 2 };
      const newZone = { x: 2, z: 0, radius: 2 };
      const zones = [prev, newZone];
      
      // dist to prev = 1.2, dist to newZone = 0.8. diff = 0.4 < 0.6. Should keep prev
      expect(target.pick(zones, 1.2, 0, prev)).toBe(prev);
    });

    it('ignores previous if it is no longer in zones array', () => {
      const prev = { x: 0, z: 0, radius: 2 };
      const newZone = { x: 2, z: 0, radius: 2 };
      const zones = [newZone];
      
      // Even if near prev, prev is not in zones. Should pick newZone
      expect(target.pick(zones, 1.2, 0, prev)).toBe(newZone);
    });
  });

  describe('prompt', () => {
    const zone = { label: 'Interact' };

    it('is unavailable if no zone', () => {
      expect(target.prompt(null, { entered: true, modalOpen: false, stunned: false })).toEqual({
        available: false,
        text: '',
        label: ''
      });
    });

    it('is available when entered and no blocking states', () => {
      const result = target.prompt(zone, { entered: true, modalOpen: false, stunned: false });
      expect(result.available).toBe(true);
      expect(result.text).toBe('Press E · Interact');
      expect(result.label).toBe('Interact');
    });

    it('is unavailable if not entered', () => {
      expect(target.prompt(zone, { entered: false, modalOpen: false, stunned: false }).available).toBe(false);
    });

    it('is unavailable if modalOpen', () => {
      expect(target.prompt(zone, { entered: true, modalOpen: true, stunned: false }).available).toBe(false);
    });

    it('is unavailable if stunned', () => {
      expect(target.prompt(zone, { entered: true, modalOpen: false, stunned: true }).available).toBe(false);
    });

    it('shows correct text for gamepad', () => {
      const result = target.prompt(zone, { entered: true, modalOpen: false, stunned: false, gamepad: true });
      expect(result.text).toBe('Press A · Interact');
    });

    it('shows correct text for coarse', () => {
      const result = target.prompt(zone, { entered: true, modalOpen: false, stunned: false, coarse: true });
      expect(result.text).toBe('Tap E · Interact');
    });

    it('shows correct text for gamepad and coarse', () => {
      const result = target.prompt(zone, { entered: true, modalOpen: false, stunned: false, gamepad: true, coarse: true });
      expect(result.text).toBe('Tap A · Interact');
    });
  });
});
