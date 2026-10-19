import * as THREE from 'three';

export function doorwayPolygon({ x, z, w, d, door = 2.8, recess = 0.7 }) {
  const hw = w / 2, hd = d / 2, dw = Math.min(door, w * 0.45) / 2;
  return [
    { x: x - hw, z: z - hd },
    { x: x + hw, z: z - hd },
    { x: x + hw, z: z + hd },
    { x: x + dw, z: z + hd },
    { x: x + dw, z: z + hd - recess },
    { x: x - dw, z: z + hd - recess },
    { x: x - dw, z: z + hd },
    { x: x - hw, z: z + hd },
  ];
}

export function overlaps(x, z, shape, radius = .38) {
  if (shape.polygon) {
    const points=shape.polygon; let inside=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++) {
      const a=points[j],b=points[i],dx=b.x-a.x,dz=b.z-a.z;
      if ((a.z>z)!==(b.z>z) && x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x) inside=!inside;
      const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
      if(Math.hypot(x-a.x-t*dx,z-a.z-t*dz)<radius) return true;
    }
    return inside;
  }
  if (shape.radius !== undefined) return Math.hypot(x - shape.x, z - shape.z) < radius + shape.radius;
  const a = shape.angle || 0, dx = x - shape.x, dz = z - shape.z;
  const lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a);
  const ox = Math.max(Math.abs(lx) - shape.w / 2, 0), oz = Math.max(Math.abs(lz) - shape.d / 2, 0);
  return ox * ox + oz * oz < radius * radius;
}
export function createCollisionWorld(shapes = []) {
  const cells = new Map(), size = 8;
  function add(shape) {
    if (![shape.x, shape.z].every(Number.isFinite)) return;
    shapesList.push(shape);
    const reach = shape.radius ?? Math.hypot(shape.w, shape.d) / 2;
    for (let x = Math.floor((shape.x - reach - 1) / size); x <= Math.floor((shape.x + reach + 1) / size); x++)
      for (let z = Math.floor((shape.z - reach - 1) / size); z <= Math.floor((shape.z + reach + 1) / size); z++) {
        const key = `${x},${z}`; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(shape);
      }
  }
  const shapesList = [];
  shapes.forEach(add);
  function clear(x, z, radius = .38, dynamic = []) {
    return !(cells.get(`${Math.floor(x / size)},${Math.floor(z / size)}`) || []).some(s => overlaps(x, z, s, radius)) && !dynamic.some(s => overlaps(x, z, s, radius));
  }
  function move(position, dx, dz, bounds, dynamic = []) {
    let { x, z } = position;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .15));
    for (let i = 0; i < steps; i++) {
      const nx = THREE.MathUtils.clamp(x + dx / steps, bounds.xMin, bounds.xMax);
      if (clear(nx, z, .38, dynamic)) x = nx;
      const nz = THREE.MathUtils.clamp(z + dz / steps, bounds.zMin, bounds.zMax);
      if (clear(x, nz, .38, dynamic)) z = nz;
    }
    return { x, z };
  }
  function nearestClear(point, maxRadius = 30) {
    if (clear(point.x, point.z, .55)) return { x: point.x, z: point.z };
    for (let r = .5; r <= maxRadius; r += .5) for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
      const x = point.x + Math.cos(a) * r, z = point.z + Math.sin(a) * r;
      if (clear(x, z, .55)) return { x, z };
    }
    return null;
  }
  return { clear, move, add, nearestClear, shapes: shapesList };
}
// Derive conservative ground-level obstacles from the visible static geometry.
// Elevated canopies/foliage, text planes and walkable ground do not block movement.
export function collidersFromMeshes(roots) {
  const shapes = [], box = new THREE.Box3();
  roots.forEach(root => {
    root.updateWorldMatrix(true, true);
    root.traverse(mesh => {
      if (!mesh.isMesh || mesh.userData.noCollision || mesh.geometry.type === 'PlaneGeometry') return;
      if (mesh.userData.collider) { shapes.push(mesh.userData.collider); return; }
      box.setFromObject(mesh);
      if (box.min.y > 1.7 || box.max.y < .25) return;
      const w = box.max.x - box.min.x, d = box.max.z - box.min.z;
      if (w < .05 || d < .05 || w > 180 || d > 180) return;
      shapes.push({ x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2, w, d });
    });
  });
  return shapes;
}
// Swept relative-motion collision, so a fast vehicle cannot skip the player.
export function sweptVehicleContact(playerFrom, playerTo, vehicleFrom, vehicleTo, angle, halfWidth = .8, halfLength = 1.4) {
  const local = (p, c) => { const x = p.x - c.x, z = p.z - c.z; return { x: x * Math.cos(angle) - z * Math.sin(angle), z: x * Math.sin(angle) + z * Math.cos(angle) }; };
  const start = local(playerFrom, vehicleFrom), end = local(playerTo, vehicleTo);
  let lo = 0, hi = 1;
  for (const [axis, extent] of [['x', halfWidth + .38], ['z', halfLength + .38]]) {
    const delta = end[axis] - start[axis];
    if (Math.abs(delta) < 1e-8) { if (Math.abs(start[axis]) > extent) return false; continue; }
    let a = (-extent - start[axis]) / delta, b = (extent - start[axis]) / delta;
    if (a > b) [a, b] = [b, a]; lo = Math.max(lo, a); hi = Math.min(hi, b);
    if (lo > hi) return false;
  }
  return true;
}
