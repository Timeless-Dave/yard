import { describe, expect, it } from 'vitest';
import { createMapCamera } from '../../src/minimap.js';

describe('campus map camera', () => {
  it('keeps a world point under the cursor while zooming', () => {
    const cam = createMapCamera({ xMin: -100, xMax: 100, zMin: -100, zMax: 100 });
    cam.fitAll(400, 400);
    const before = cam.toWorld(300, 120, 400, 400);
    cam.zoomAt(0.5, 300, 120, 400, 400);
    const after = cam.toWorld(300, 120, 400, 400);
    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.z).toBeCloseTo(before.z, 5);
  });

  it('pans in world units from pixel drag', () => {
    const cam = createMapCamera({ xMin: -50, xMax: 50, zMin: -50, zMax: 50 });
    cam.fitAll(200, 200);
    const start = cam.state;
    cam.pan(20, 0);
    expect(cam.state.cx).toBeLessThan(start.cx);
  });
});
