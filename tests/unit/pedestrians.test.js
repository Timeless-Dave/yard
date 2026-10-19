import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/avatar.js', () => ({
  createCharacter: () => ({
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    rotation: { y: 0 },
    userData: { animate: vi.fn() },
  }),
}));

const { buildPath, nextWaypoint, createPedestrians } = await import('../../src/pedestrians.js');

describe('pedestrian paths', () => {
  it('builds 3-5 point paths that stay within the radius', () => {
    for (let i = 0; i < 200; i++) {
      const radius = 5 + Math.random() * 5;
      const { points } = buildPath(10, -4, radius);
      expect(points.length).toBeGreaterThanOrEqual(3);
      expect(points.length).toBeLessThanOrEqual(5);
      points.forEach(p => expect(Math.hypot(p.x - 10, p.z + 4)).toBeLessThanOrEqual(radius + 1e-6));
    }
  });

  it('wraps closed loops and ping-pongs L paths', () => {
    expect(nextWaypoint(3, 1, 4, false)).toEqual({ index: 0, dir: 1 });
    expect(nextWaypoint(2, 1, 3, true)).toEqual({ index: 1, dir: -1 });
    expect(nextWaypoint(0, -1, 3, true)).toEqual({ index: 1, dir: 1 });
  });
});

describe('createPedestrians', () => {
  it('keeps the public API and splits idle and walking students', () => {
    const scene = { add: vi.fn() };
    const api = createPedestrians(scene, { a: { x: 0, z: 0 } }, 4);
    expect(Object.keys(api).sort()).toEqual(['npcs', 'setWorld', 'update']);
    expect(api.npcs.filter(n => n.mode === 'idle')).toHaveLength(2);
    expect(api.npcs.filter(n => n.mode === 'walk')).toHaveLength(2);
  });

  it('moves walkers through collisionWorld.move and snaps to nearestClear', () => {
    const scene = { add: vi.fn() };
    const api = createPedestrians(scene, { a: { x: 0, z: 0 } }, 2);
    const world = {
      nearestClear: vi.fn(p => ({ x: p.x, z: p.z })),
      move: vi.fn((pos, dx, dz) => ({ x: pos.x + dx, z: pos.z + dz })),
    };
    api.setWorld(world, { xMin: -50, xMax: 50, zMin: -50, zMax: 50 });
    expect(world.nearestClear).toHaveBeenCalled();
    for (let i = 0; i < 20; i++) api.update(0.1);
    expect(world.move).toHaveBeenCalled();
  });
});
