// Conservative ground-plane collision against authored building footprints.
// Special-model overhangs and stadium stands need separate authored colliders.
export function isWalkable(x, z, buildings, radius = .4) {
  return !buildings.some(b => b.special !== 'stadium' && Math.abs(x - b.x) < b.w / 2 + radius && Math.abs(z - b.z) < b.d / 2 + radius);
}
export function slideMove(position, dx, dz, buildings, bounds) {
  let x = position.x, z = position.z;
  // Substeps prevent tunnelling during low frame rates.
  const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .25));
  for (let i = 0; i < count; i++) {
    const nx = Math.max(bounds.xMin, Math.min(bounds.xMax, x + dx / count));
    if (isWalkable(nx, z, buildings)) x = nx;
    const nz = Math.max(bounds.zMin, Math.min(bounds.zMax, z + dz / count));
    if (isWalkable(x, nz, buildings)) z = nz;
  }
  return { x, z };
}
