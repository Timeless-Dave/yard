import * as THREE from 'three';

export const DEFAULT_LOOK = { gender: 'Unspecified', build: 'Balanced', skin: '#8a5a3c', hair: 'Coils', shirt: '#f4b223', height: 1 };
export function normalizeLook(value = {}) {
  if (!value || typeof value !== 'object') value = {};
  const pick = (key, values) => values.includes(value[key]) ? value[key] : DEFAULT_LOOK[key];
  return { gender: pick('gender', ['Unspecified', 'Woman', 'Man', 'Nonbinary', 'Self-described']), build: pick('build', ['Slender', 'Balanced', 'Broad']), skin: /^#[0-9a-f]{6}$/i.test(value.skin) ? value.skin : DEFAULT_LOOK.skin, shirt: /^#[0-9a-f]{6}$/i.test(value.shirt) ? value.shirt : DEFAULT_LOOK.shirt, hair: pick('hair', ['Coils', 'Close crop', 'Locs', 'Bun', 'Bald']), height: Number.isFinite(Number(value.height)) ? THREE.MathUtils.clamp(Number(value.height), .85, 1.15) : 1 };
}
export function loadLook() {
  try { return normalizeLook(JSON.parse(localStorage.getItem('yard-look-v1')) || {}); } catch { return { ...DEFAULT_LOOK }; }
}
export function disposeCharacter(group) {
  const geometries = new Set(), materials = new Set();
  group.traverse(n => { if (n.isMesh) { geometries.add(n.geometry); materials.add(n.material); } });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
}
export function createCharacter(input = {}) {
  const look = normalizeLook(input);
  const group = new THREE.Group();
  const rig = new THREE.Group(); group.add(rig);
  const mat = color => new THREE.MeshStandardMaterial({ color, roughness: .85 });
  const skin = mat(look.skin), shirt = mat(look.shirt), pants = mat('#263344'), hair = mat('#231a17'), shoe = mat('#eeeeea');
  function ellipsoid(parent, material, x, y, z, sx, sy, sz) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material);
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; parent.add(mesh); return mesh;
  }
  const width = { Slender: .85, Balanced: 1, Broad: 1.2 }[look.build];
  const torso = ellipsoid(rig, shirt, 0, 1.42, 0, .4 * width, .48, .24);
  ellipsoid(rig, pants, 0, .98, 0, .32 * width, .2, .23);
  ellipsoid(rig, skin, 0, 1.91, 0, .12, .17, .13);
  ellipsoid(rig, skin, 0, 2.19, 0, .27, .32, .25);
  for (const side of [-1, 1]) {
    ellipsoid(rig, skin, side * .27, 2.18, 0, .055, .085, .06);
    ellipsoid(rig, shoe, side * .095, 2.23, .225, .055, .038, .03);
    ellipsoid(rig, hair, side * .095, 2.23, .252, .024, .027, .015);
  }
  ellipsoid(rig, skin, 0, 2.15, .26, .055, .07, .065);
  ellipsoid(rig, hair, 0, 2.05, .231, .075, .014, .018);
  if (look.hair !== 'Bald') ellipsoid(rig, hair, 0, 2.41, -.015, .28, look.hair === 'Close crop' ? .11 : .2, .26);
  if (look.hair === 'Coils') for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; ellipsoid(rig, hair, Math.cos(a) * .21, 2.46, Math.sin(a) * .2, .12, .13, .12); }
  if (look.hair === 'Bun') ellipsoid(rig, hair, 0, 2.54, -.2, .19, .18, .18);
  if (look.hair === 'Locs') for (let i = 0; i < 7; i++) { const a = i / 6 * Math.PI; ellipsoid(rig, hair, Math.cos(a) * .26, 2.14, -Math.sin(a) * .23, .065, .36, .065); }
  const arms = [], legs = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * .43 * width, 1.72, 0); rig.add(arm); arms.push(arm);
    ellipsoid(arm, shirt, side * .02, -.16, 0, .14, .24, .15);
    ellipsoid(arm, skin, side * .03, -.48, 0, .1, .23, .1);
    ellipsoid(arm, skin, side * .03, -.69, .02, .105, .12, .1);
    const leg = new THREE.Group(); leg.position.set(side * .18 * width, .97, 0); rig.add(leg); legs.push(leg);
    ellipsoid(leg, pants, 0, -.39, 0, .145, .43, .16);
    ellipsoid(leg, shoe, 0, -.85, .08, .16, .115, .26);
  }
  group.scale.setScalar(look.height);
  let phase = 0;
  group.userData.torso = torso;
  group.userData.animate = (dt, speed = 0) => {
    phase += dt * (speed > .01 ? 9 : 1.8);
    const stride = Math.min(speed, 1) * .65;
    arms.forEach((a, i) => a.rotation.x = Math.sin(phase + i * Math.PI) * stride);
    legs.forEach((a, i) => a.rotation.x = -Math.sin(phase + i * Math.PI) * stride);
    rig.position.y = speed > .01 ? Math.abs(Math.sin(phase)) * .045 : Math.sin(phase) * .012;
  };
  return group;
}
