const TAU = Math.PI * 2;

export const CAMERA_ZOOM_MIN = 0.55;
export const CAMERA_ZOOM_MAX = 1.8;

export const CAMERA_PRESETS = Object.freeze({
  close: Object.freeze({ yaw: 0, zoom: 0.7 }),
  follow: Object.freeze({ yaw: 0, zoom: 1 }),
  overview: Object.freeze({ yaw: 0, zoom: 1.6 }),
});

const OUTDOOR_OFFSET = Object.freeze({ x: 0, y: 6, z: 8 });
const INDOOR_OFFSET = Object.freeze({ x: 4, y: 10, z: 12 });

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function wrapAngle(value) {
  return ((value + Math.PI) % TAU + TAU) % TAU - Math.PI;
}

function copyPoint(point) {
  return { x: point.x, y: point.y, z: point.z };
}

/**
 * Camera state and vector math with no Three.js dependency. Returned points
 * can be passed to Vector3#set/copy, and raycastFn may adapt a Three.Raycaster.
 */
export function createCameraController(options = {}) {
  const yawDamping = options.yawDamping ?? 10;
  const zoomDamping = options.zoomDamping ?? 10;
  const obstructionPadding = options.obstructionPadding ?? 0.25;

  let targetYaw = wrapAngle(options.yaw ?? CAMERA_PRESETS.follow.yaw);
  let targetZoom = clamp(
    options.zoom ?? CAMERA_PRESETS.follow.zoom,
    CAMERA_ZOOM_MIN,
    CAMERA_ZOOM_MAX,
  );
  let currentYaw = targetYaw;
  let currentZoom = targetZoom;

  const controller = {
    presets: CAMERA_PRESETS,

    get yaw() {
      return targetYaw;
    },
    set yaw(value) {
      if (Number.isFinite(value)) targetYaw = wrapAngle(value);
    },

    get zoom() {
      return targetZoom;
    },
    set zoom(value) {
      if (Number.isFinite(value)) {
        targetZoom = clamp(value, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX);
      }
    },

    get currentYaw() {
      return currentYaw;
    },
    get currentZoom() {
      return currentZoom;
    },

    rotate(delta) {
      if (Number.isFinite(delta)) controller.yaw = targetYaw + delta;
      return targetYaw;
    },

    zoomBy(delta) {
      if (Number.isFinite(delta)) controller.zoom = targetZoom + delta;
      return targetZoom;
    },

    setPreset(name) {
      const preset = CAMERA_PRESETS[name];
      if (!preset) throw new RangeError(`Unknown camera preset: ${name}`);
      targetYaw = preset.yaw;
      targetZoom = preset.zoom;
      return { yaw: targetYaw, zoom: targetZoom };
    },

    reset() {
      targetYaw = CAMERA_PRESETS.follow.yaw;
      targetZoom = CAMERA_PRESETS.follow.zoom;
      currentYaw = targetYaw;
      currentZoom = targetZoom;
      return { yaw: targetYaw, zoom: targetZoom };
    },

    damp(dt) {
      const elapsed = Math.max(0, Number.isFinite(dt) ? dt : 0);
      const yawAlpha = 1 - Math.exp(-yawDamping * elapsed);
      const zoomAlpha = 1 - Math.exp(-zoomDamping * elapsed);
      const shortestYawDelta = wrapAngle(targetYaw - currentYaw);

      currentYaw += shortestYawDelta * yawAlpha;
      currentZoom += (targetZoom - currentZoom) * zoomAlpha;
      return { yaw: currentYaw, zoom: currentZoom };
    },

    offsetFor(indoors = false) {
      const base = indoors ? INDOOR_OFFSET : OUTDOOR_OFFSET;
      const sin = Math.sin(currentYaw);
      const cos = Math.cos(currentYaw);
      return {
        x: (base.x * cos + base.z * sin) * currentZoom,
        y: base.y * currentZoom,
        z: (base.z * cos - base.x * sin) * currentZoom,
      };
    },

    pullForObstruction(from, desired, raycastFn) {
      const dx = desired.x - from.x;
      const dy = desired.y - from.y;
      const dz = desired.z - from.z;
      const distance = Math.hypot(dx, dy, dz);
      if (distance === 0 || typeof raycastFn !== 'function') {
        return copyPoint(desired);
      }

      const direction = { x: dx / distance, y: dy / distance, z: dz / distance };
      const hit = raycastFn(copyPoint(from), direction, distance);
      const hitDistance = typeof hit === 'number' ? hit : hit?.distance;
      if (!Number.isFinite(hitDistance) || hitDistance < 0 || hitDistance >= distance) {
        return copyPoint(desired);
      }

      const pulledDistance = Math.max(0, hitDistance - obstructionPadding);
      return {
        x: from.x + direction.x * pulledDistance,
        y: from.y + direction.y * pulledDistance,
        z: from.z + direction.z * pulledDistance,
      };
    },
  };

  return controller;
}
