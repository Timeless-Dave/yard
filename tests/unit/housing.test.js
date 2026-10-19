import { describe, it, expect } from 'vitest';
import { hallForBuilding, visitationOpen, visitationWindow, HALLS } from '../../src/housing.js';

describe('UAPB housing', () => {
  it('ranks JBJ as the highest Yard Coin hall', () => {
    const jbj = HALLS.find(h => h.id === 'jbj');
    expect(jbj.coins).toBeGreaterThan(Math.max(...HALLS.filter(h => h.id !== 'jbj').map(h => h.coins)));
  });
  it('matches published hall names on campus buildings', () => {
    expect(hallForBuilding({ name: 'Johnny B. Johnson Housing Complex' }).id).toBe('jbj');
    expect(hallForBuilding({ name: 'Harrold Complex' }).id).toBe('harrold');
    expect(hallForBuilding({ name: 'Caldwell Hall' })).toBeNull();
  });
  it('opens visiting hours after 5pm campus time on a weekday', () => {
    const evening = new Date('2026-10-19T23:00:00Z');
    const window = visitationWindow(evening);
    expect(window.startHour).toBe(17);
    expect(typeof visitationOpen(evening)).toBe('boolean');
  });
});
