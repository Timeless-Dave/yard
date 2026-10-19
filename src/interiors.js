import * as THREE from 'three';
import { createCollisionWorld } from './worldPhysics.js';

// Enterable interiors are keyed only off `building.special` strings that already
// exist in campus data. Rooms without public lobby photographs stay exterior-only.
//   union_cantilever -> 'union'   (photo-referenced reconstruction)
//   library          -> 'library' (illustrative layout, no interior photos)
export function interiorType(building) {
  if (building.special === 'union_cantilever') return 'union';
  if (building.special === 'library') return 'library';
  if (building.kind === 'dorm') return 'dorm';
  return null;
}

const ROOM_NOTES = {
  union: ['ABOUT THIS ROOM',
    'Reconstructed from public photos of the renovation.',
    'Sizes and furniture positions are approximate.'],
  library: ['ABOUT THIS ROOM',
    'Illustrative layout, not based on interior photos.',
    'The real floor plan is not verified.'],
  dorm: ['ABOUT THIS ROOM',
    'Illustrative hall. Not a real UAPB floor plan.',
    'Lease here is Yard Coin only, not a housing contract.'],
};

function wrapLines(ctx, text, maxWidth) {
  const out = []; let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) { out.push(line); line = word; } else line = test;
  }
  if (line) out.push(line);
  return out;
}

export function createInterior(building, level = 0, mode = 'lobby') {
  const type = interiorType(building), scene = new THREE.Scene();
  scene.background = new THREE.Color('#d2d7d6');
  scene.add(new THREE.HemisphereLight('#ffffff', '#a09179', 2.3));
  const daylight = new THREE.DirectionalLight('#fff4dc', 2); daylight.position.set(-8, 12, 5); scene.add(daylight);
  const shapes = [], zones = [], materials = new Map();
  const material = color => { if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .72 })); return materials.get(color); };

  // Only pieces flagged solid add a collider, so each furniture item gets one tight
  // footprint instead of a pile of overlapping leg and back-rest boxes.
  function box(x, y, z, w, h, d, color, solid = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color)); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
    if (solid && y - h / 2 < 1.8 && y + h / 2 > .2) shapes.push({ x, z, w, d }); return mesh;
  }

  // Square signs only (fillRect). `text` is a string or [title, ...body lines].
  // tone 'dark' is a wall/header sign; 'paper' is a flat floor placard.
  function sign(text, x, y, z, width = 3, aspect = 4, tone = 'dark') {
    const lines = Array.isArray(text) ? text : [text];
    const W = 1024, H = Math.round(W / aspect), pad = Math.round(H * .12);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d');
    const paper = tone === 'paper';
    ctx.fillStyle = paper ? '#8a6a12' : '#f4b223'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = paper ? '#f4f1e6' : '#212728'; ctx.fillRect(8, 8, W - 16, H - 16);
    ctx.fillStyle = paper ? '#212728' : '#ffffff'; ctx.textBaseline = 'alphabetic';
    let ts = lines.length > 1 ? H * .2 : H * .4;
    ctx.font = `700 ${ts}px sans-serif`;
    while (ts > 14 && ctx.measureText(lines[0]).width > W - pad * 2) { ts -= 2; ctx.font = `700 ${ts}px sans-serif`; }
    if (lines.length === 1) { ctx.textAlign = 'center'; ctx.fillText(lines[0], W / 2, H / 2 + ts * .35); }
    else {
      let bs = H * .12, body;
      for (;; bs -= 2) {
        ctx.font = `500 ${bs}px sans-serif`;
        body = lines.slice(1).flatMap(l => wrapLines(ctx, l, W - pad * 2));
        if (bs <= 14 || ts * 1.3 + body.length * bs * 1.3 <= H - pad * 2) break;
      }
      ctx.textAlign = 'left'; ctx.font = `700 ${ts}px sans-serif`;
      let ty = pad + ts; ctx.fillText(lines[0], pad, ty, W - pad * 2);
      ctx.font = `500 ${bs}px sans-serif`; ty += ts * .35;
      for (const l of body) { ty += bs * 1.3; ctx.fillText(l, pad, ty, W - pad * 2); }
    }
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / aspect), new THREE.MeshBasicMaterial({ map: texture })); mesh.position.set(x, y, z); scene.add(mesh); return mesh;
  }
  function floorSign(text, x, z, width, aspect, tone) { const s = sign(text, x, .025, z, width, aspect, tone); s.rotation.x = -Math.PI / 2; return s; }

  // `back` names the side the back-rest sits on, so the sitter faces the opposite way.
  // Collider is the seat only; the back-rest and legs sit inside that footprint.
  function chair(x, z, back = 'n', color = '#d6a822') {
    box(x, .5, z, .66, .2, .66, color);
    const bx = back === 'w' ? -.3 : back === 'e' ? .3 : 0, bz = back === 'n' ? -.3 : back === 's' ? .3 : 0;
    if (back === 'n' || back === 's') box(x, .9, z + bz, .66, .8, .1, color, false); else box(x + bx, .9, z, .1, .8, .66, color, false);
    for (const dx of [-.26, .26]) for (const dz of [-.26, .26]) box(x + dx, .23, z + dz, .06, .46, .06, '#33383a', false);
  }
  function table(x, z, w = 2.8, d = 1.2) {
    box(x, 1, z, w, .12, d, '#b58b5b');
    for (const dx of [-w / 2 + .15, w / 2 - .15]) box(x + dx, .48, z, .12, .95, d * .8, '#343a3c', false);
  }
  // Seat, back and arms share one 2.8 x 1.2 collider (arms are the widest part).
  function sofa(x, z) {
    box(x, .5, z, 2.4, .65, 1.1, '#737a7b', false); box(x, 1, z - .5, 2.4, 1.1, .18, '#737a7b', false);
    box(x - 1.3, .8, z, .2, .65, 1.1, '#737a7b', false); box(x + 1.3, .8, z, .2, .65, 1.1, '#737a7b', false);
    shapes.push({ x, z: z - .04, w: 2.8, d: 1.2 });
  }

  const w = 28, d = 20;
  box(0, -.12, 0, w, .24, d, type === 'union' && level === 1 ? '#c7ac86' : '#d6d2c7', false);
  // Thin floor joints establish scale without shipping photographs as textures.
  for (let x = -13; x < 14; x += 2) box(x, .012, 0, .015, .01, d, '#a9a498', false);
  box(0, 2, -10, w, 4, .3, '#eeeee6'); box(-14, 2, 0, .3, 4, d, '#eeeee6'); box(14, 2, 0, .3, 4, d, '#eeeee6');
  // Front wall is cut away for the camera, but its two solid sides remain physical.
  box(-8, .45, 10, 12, .9, .3, '#dfded7'); box(8, .45, 10, 12, .9, .3, '#dfded7');
  for (let z = -8; z <= 8; z += 4) {
    const glass = box(-13.82, 2.1, z, .04, 2.5, 3.4, '#adc5cd', false); glass.material = new THREE.MeshStandardMaterial({ color: '#adc5cd', roughness: .2 });
    box(-13.65, 3.45, z, .2, .1, 3.6, '#ffffff', false);
  }
  for (let z = -8; z <= 6; z += 4) box(0, 4.2, z, w, .18, .12, '#f3f0e6', false);
  floorSign('EXIT', 0, 8.7, 1.8, 4);
  zones.push({ x: 0, z: 8.7, radius: 1.8, key: 'exit-building', label: 'Exit to campus' });
  const spawn = { x: 0, z: 4.8 };
  const name = String(building.name || '').toUpperCase();

  function woodSlats(x0, x1) { for (let x = x0; x <= x1; x += .26) box(x, 1.45, -9.8, .09, 2.5, .06, '#b88e5b', false); }

  if (type === 'union') {
    box(10.5, 2, -7.8, 5, 4, 3.8, '#292e30');
    box(10.5, 1.5, -5.85, 2, 3, .08, '#747b7e', false);
    sign(level ? 'ELEVATOR TO LOBBY' : 'ELEVATOR TO LOUNGE', 10.5, 3.45, -5.7, 3.8);
    zones.push({ x: 10.5, z: -4.5, radius: 1.7, key: 'floor-change', label: level ? 'Elevator to ground-floor lobby' : 'Elevator to upstairs lounge' });
    if (!level) {
      box(-6.2, 1, -6, 8, 2, 1.4, '#b88e5b');
      for (let x = -10; x < -2.2; x += .2) box(x, 1, -5.25, .05, 2, .05, '#282d2d', false);
      sign('PRINT SHOP AND MAILROOM', -6.5, 3.2, -9.7, 6);
      sign(name, 0, 3.2, -9.7, 6);
      // Lobby seating: gray sofa with a coffee table, and a yellow-chair cluster by the glazing.
      table(-7, 1, 4); chair(-8, 2.3, 's'); chair(-6, 2.3, 's'); chair(-8, -.3, 'n'); chair(-6, -.3, 'n');
      sofa(6, 1); table(6, 2.7, 1.8, .8);
      table(-11, 5.5, .9, .9); chair(-11, 4.4, 'n'); chair(-11, 6.6, 's');
      floorSign(ROOM_NOTES.union, -6, 7, 8, 2.8, 'paper');
      zones.push({ x: -6, z: -3.5, radius: 1.8, key: 'room-info', label: 'Read about the renovated Student Union' });
    } else {
      woodSlats(-12.2, -.3);
      for (let z = -6; z <= 3; z += 4.5) { sofa(-6, z); table(-6, z + 1.5, 2, .8); chair(-10.5, z, 'w'); }
      // Glass meeting-room partition with a wide doorway.
      box(4, 1.5, -5, .12, 3, 7, '#a6bac1');
      box(4, 1.5, 5.5, .12, 3, 5, '#a6bac1');
      table(8.5, 2, 5, 2); for (const x of [7, 9, 11]) { chair(x, 3.5, 's'); chair(x, .2, 'n'); }
      sign('STUDENT LOUNGE', -6, 3.3, -9.7, 5);
      floorSign(ROOM_NOTES.union, -6, 7, 8, 2.8, 'paper');
      zones.push({ x: -6, z: 5.5, radius: 2, key: 'cards', label: 'Play Spades in the lounge' });
    }
  } else if (type === 'library') {
    box(7, .85, 4, 6, 1.7, 1.2, '#a3815b'); box(7, 1.5, 3.1, 6, 3, .1, '#d6d2c7');
    sign('LIBRARY SERVICES', 7, 2.6, 3.17, 4.6);
    for (const x of [-10, -6, -2]) {
      box(x, 1.35, -5, .85, 2.7, 6, '#795a3f');
      for (let z = -7.5; z <= -2.5; z += .3) for (let y = .5; y < 2.5; y += .65) box(x + .46, y, z, .08, .45, .2, ['#ab654d', '#657c84', '#d3bd83'][Math.abs(Math.round(z * 10)) % 3], false);
      sign('STACKS', x, 2.2, -1.97, 1.2, 4);
    }
    // Study tables seat both sides; chairs face the table.
    for (const z of [-5, 0]) { table(8, z, 5, 1.7); chair(6.5, z + 1.4, 's'); chair(9, z + 1.4, 's'); chair(6.5, z - 1.4, 'n'); chair(9, z - 1.4, 'n'); }
    // Computer stations along the window wall (the library lists technology resources).
    for (const z of [1.5, 4.5, 7.5]) {
      box(-12.4, .95, z, 1.1, .1, 2, '#b58b5b');
      box(-12.4, .4, z, .08, .8, 1.8, '#343a3c', false);
      box(-12.75, 1.4, z, .1, .55, .85, '#1f2426', false);
      chair(-11.3, z, 'e', '#657c84');
    }
    sign(name, 1, 3.3, -9.7, 7);
    floorSign(ROOM_NOTES.library, -6, 7, 8, 2.8, 'paper');
    zones.push({ x: 6, z: 6, radius: 1.7, key: 'room-info', label: 'Library resources and study spaces' });
  } else if (type === 'dorm') {
    const room = mode === 'room';
    const honor = /johnson|j\.?b\.?j/i.test(String(building.name || ''));
    box(9.5, 1.1, -7.2, 6, 2.2, 3.2, '#3d4442');
    sign('FRONT DESK', 9.5, 2.5, -5.5, 4);
    sofa(-7, 2); table(-7, 3.6, 2, .8);
    chair(4, 4, 'w'); chair(4, 6, 'w');
    sign(name, 0, 3.3, -9.7, 8);
    sign(room ? 'LEASED ROOM · ILLUSTRATIVE' : 'VISITOR LOBBY · CHECK IN', -6, 3.2, -9.7, 6);
    floorSign(ROOM_NOTES.dorm, -6, 7, 8, 2.8, 'paper');
    zones.push({ x: 9.5, z: -4.2, radius: 1.8, key: 'housing-desk', label: room ? 'Housing desk' : 'Lease a room or check hours' });
    zones.push({ x: -6, z: 5.5, radius: 1.8, key: 'room-info', label: 'Residential Life hours' });
    if (room) {
      box(-8, .45, -5, 4.2, .4, 2.2, '#6b4a2b');
      box(-8, .7, -5.7, 4.2, .9, .2, '#6b4a2b', false);
      box(2, .45, -5, 4.2, .4, 2.2, '#6b4a2b');
      box(2, .7, -5.7, 4.2, .9, .2, '#6b4a2b', false);
      table(-3, 1.2, 1.4, .7); chair(-3, 2.2, 's');
      if (honor) {
        box(10, .9, 4, 3.2, .12, 1.6, '#b58b5b');
        sign('SUITE KITCHEN', 10, 2.2, 4.9, 3.4);
      }
    }
  }
  const world = createCollisionWorld(shapes);
  const title = building.name || (type === 'union' ? 'Student Union' : type === 'dorm' ? 'Residence hall' : 'Library');
  const labels = {
    union: `${title}: ${level ? 'Upstairs lounge' : 'Ground-floor lobby'}`,
    library: `${title}: Study floor`,
    dorm: `${title}: ${mode === 'room' ? 'Leased room' : 'Lobby'}`,
  };
  const confidence = {
    union: 'Photo-referenced reconstruction; room dimensions are approximate.',
    library: 'Illustrative study interior; actual floor plan not verified.',
    dorm: 'Illustrative hall. Visiting hours follow the Residential Life handbook in campus time. This is not a real lease.',
  };
  return { scene, world, zones, spawn, level, type, mode, bounds: { xMin: -13.5, xMax: 13.5, zMin: -9.5, zMax: 9.5 },
    label: labels[type] || `${title}: Interior`,
    confidence: confidence[type] || 'Illustrative interior.',
    dispose() { const gs = new Set(), ms = new Set(), ts = new Set(); scene.traverse(n => { if (n.isMesh) { gs.add(n.geometry); ms.add(n.material); if (n.material.map) ts.add(n.material.map); } }); gs.forEach(g => g.dispose()); ms.forEach(m => m.dispose()); ts.forEach(t => t.dispose()); }
  };
}
