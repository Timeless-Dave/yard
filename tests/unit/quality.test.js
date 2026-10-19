import { describe, expect, it } from 'vitest';
import { nextQuality, qualityLabel, applyQuality } from '../../src/quality.js';

describe('quality tiers', () => {
  it('cycles low, medium, and high', () => {
    expect(nextQuality('low')).toBe('medium');
    expect(nextQuality('medium')).toBe('high');
    expect(nextQuality('high')).toBe('low');
    expect(qualityLabel('medium')).toBe('Quality: Medium');
  });

  it('disables shadows on the low tier', () => {
    const renderer = { setPixelRatio() {}, shadowMap: { enabled: true } };
    const sun = { castShadow: true, shadow: { mapSize: { set() {} } } };
    const caps = applyQuality('low', { renderer, sun });
    expect(caps.shadows).toBe(false);
    expect(caps.npc).toBe(false);
    expect(renderer.shadowMap.enabled).toBe(false);
  });
});
