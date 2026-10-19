import { describe, expect, it, vi } from 'vitest';
import { createCameraController } from '../../src/cameraController.js';

describe('camera controller', () => {
  it('clamps zoom assignments and zoom deltas to the supported range', () => {
    const camera = createCameraController();

    camera.zoom = 99;
    expect(camera.zoom).toBe(1.8);

    camera.zoomBy(-99);
    expect(camera.zoom).toBe(0.55);
  });

  it('wraps yaw assignments and rotations to the signed circle', () => {
    const camera = createCameraController();

    camera.yaw = Math.PI * 3;
    expect(camera.yaw).toBeCloseTo(-Math.PI);

    camera.rotate(Math.PI / 2);
    expect(camera.yaw).toBeCloseTo(-Math.PI / 2);
  });

  it('damps yaw across the shortest side of the angle boundary', () => {
    const camera = createCameraController({ yaw: Math.PI - 0.1 });
    camera.damp(10);
    camera.yaw = -Math.PI + 0.1;

    const before = camera.currentYaw;
    const state = camera.damp(1 / 60);

    expect(state.yaw).toBeGreaterThan(before);
    expect(Math.abs(state.yaw - before)).toBeLessThan(0.1);
  });

  it('pulls an obstructed camera closer along the requested ray', () => {
    const camera = createCameraController();
    const raycast = vi.fn(() => ({ distance: 5 }));

    const result = camera.pullForObstruction(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 10 },
      raycast,
    );

    expect(raycast).toHaveBeenCalledWith(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      10,
    );
    expect(result).toEqual({ x: 0, y: 0, z: 4.75 });
  });

  it('returns the desired point when the camera ray is unobstructed', () => {
    const camera = createCameraController();
    const desired = { x: 4, y: 6, z: 8 };

    expect(camera.pullForObstruction(
      { x: 0, y: 0, z: 0 },
      desired,
      () => null,
    )).toEqual(desired);
  });

  it('reset restores the follow camera defaults', () => {
    const camera = createCameraController();
    camera.rotate(1);
    camera.zoomBy(0.5);

    expect(camera.reset()).toEqual({ yaw: 0, zoom: 1 });
    expect(camera.yaw).toBe(0);
    expect(camera.zoom).toBe(1);
    expect(camera.offsetFor(false)).toEqual({ x: 0, y: 6, z: 8 });
  });
});
