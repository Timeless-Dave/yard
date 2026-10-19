import { describe, it, expect } from 'vitest';
import { normalizeLook, createCharacter, disposeCharacter } from '../../src/avatar.js';
import { slideMove } from '../../src/navigation.js';
const buildings = [{ x: 0, z: 0, w: 2, d: 2 }];
const bounds = { xMin: -10, xMax: 10, zMin: -10, zMax: 10 };
describe('UAPB exploration', () => {
  it('blocks crossing a building even with a large movement delta', () => {
    const p = slideMove({ x: -5, z: 0 }, 10, 0, buildings, bounds);
    expect(p.x).toBeLessThanOrEqual(-1.4);
  });
  it('slides along a wall and stays inside campus bounds', () => {
    const p = slideMove({ x: -1.5, z: 0 }, 1, 1, buildings, bounds);
    expect(p.x).toBeLessThanOrEqual(-1.4); expect(p.z).toBeCloseTo(1);
    expect(slideMove({ x: 9, z: 9 }, 5, 5, [], bounds)).toEqual({ x: 10, z: 10 });
  });
  it('normalizes corrupt saved appearance without coupling gender to body or hair', () => {
    expect(normalizeLook({ gender: 'Woman', build: 'Broad', hair: 'Bald', height: 999, shirt: 'bad' })).toMatchObject({ gender: 'Woman', build: 'Broad', hair: 'Bald', height: 1.15, shirt: '#f4b223' });
  });
  it('builds finite, animated humanoids for all body presets', () => {
    for (const build of ['Slender', 'Balanced', 'Broad']) {
      const model = createCharacter({ build }); model.userData.animate(.1, 1);
      let meshes = 0; model.traverse(n => { if (n.isMesh) meshes++; expect(Number.isFinite(n.rotation.x)).toBe(true); });
      expect(meshes).toBeGreaterThan(15); disposeCharacter(model);
    }
  });
});
