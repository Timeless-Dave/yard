// Detailed building models, researched from real references:
// - W.E. O'Bryant Bell Tower: NRHP description + Wikimedia Commons photo
//   (three-stage brick tower, open base arch, belfry louver, clock stage,
//   white concrete banding with curved shoulders).
// - Caldwell Hall: Wikimedia Commons photo — two-story Collegiate Gothic
//   brick academic hall, cream stone quoins and window surrounds, a
//   stepped-parapet entrance gable, regular window bands.
// - Golden Lion Stadium (Simmons Bank Field): Wikimedia Commons aerial —
//   gold/black end zones with "UAPB" lettering, tiered gray grandstand
//   with a press box, smaller opposite stands, corner light towers.
// - L.A. Davis, Sr. Student Union: real 2024 grand-reopening photo
//   (uapbnews.wordpress.com) — crisp white modernist box with a dramatic
//   cantilevered upper volume overhanging the entrance, ribbon windows.
// - John Brown Watson Memorial Library: real photo (uapb.edu) — red brick
//   base with a flat white overhanging canopy roof and a glass entrance
//   framed by four tall white columns, banner signage between them.
import * as THREE from "three";
import { doorwayPolygon } from "./worldPhysics.js";

function collideWithDoor(mesh, x, z, w, d, door) {
  mesh.userData.collider = { x, z, w, d, polygon: doorwayPolygon({ x, z, w, d, door }) };
}

function canvasTexture(draw, w = 256, h = 256) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function labelPlane(text, w, h, bg = "#121212", fg = "#f4b223") {
  const tex = canvasTexture((ctx, cw, ch) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = fg;
    ctx.font = "bold 30px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const words = text.split(" ");
    let line = "";
    const lines = [];
    for (const word of words) {
      const test = line + word + " ";
      if (ctx.measureText(test).width > cw - 20 && line) {
        lines.push(line);
        line = word + " ";
      } else line = test;
    }
    lines.push(line);
    const lh = 34;
    const startY = ch / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l.trim(), cw / 2, startY + i * lh));
  }, 256, 128);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  return mesh;
}

// ---- Brick / stone textures ----
function brickTexture({ brick = "#7a2e22", mortar = "#c9b8a0", rows = 10, cols = 8 } = {}) {
  return canvasTexture((ctx, w, h) => {
    ctx.fillStyle = mortar;
    ctx.fillRect(0, 0, w, h);
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const offset = r % 2 === 0 ? 0 : (w / cols) / 2;
      for (let c = -1; c < cols; c++) {
        const bw = w / cols - 3;
        const x = c * (w / cols) + offset + 1.5;
        ctx.fillStyle = brick;
        ctx.fillRect(x, r * rh + 1.5, bw, rh - 3);
      }
    }
  }, 256, 256);
}

function windowGridTexture({ brick, rows = 2, cols = 6, glass = "#2a3b55", frame = "#e8e2d0" } = {}) {
  return canvasTexture((ctx, w, h) => {
    const tex2 = brickTexture({ brick });
    ctx.drawImage(tex2.image, 0, 0, w, h);
    const padX = w * 0.08;
    const padY = h * 0.12;
    const cellW = (w - padX * 2) / cols;
    const cellH = (h - padY * 2) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = padX + c * cellW + cellW * 0.15;
        const y = padY + r * cellH + cellH * 0.2;
        const ww = cellW * 0.7;
        const wh = cellH * 0.6;
        ctx.fillStyle = frame;
        ctx.fillRect(x - 3, y - 3, ww + 6, wh + 6);
        ctx.fillStyle = glass;
        ctx.fillRect(x, y, ww, wh);
        ctx.strokeStyle = frame;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + ww / 2, y);
        ctx.lineTo(x + ww / 2, y + wh);
        ctx.stroke();
      }
    }
    // cream quoins at the edges, like Caldwell Hall's stone corners
    ctx.fillStyle = "#e8e2d0";
    const qw = w * 0.05;
    for (let r = 0; r < 8; r++) {
      if (r % 2 === 0) {
        ctx.fillRect(0, (r * h) / 8, qw, h / 8);
        ctx.fillRect(w - qw, (r * h) / 8, qw, h / 8);
      }
    }
  }, 384, 256);
}

function glassBandTexture({ base = "#2d6b4a" } = {}) {
  return canvasTexture((ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const bandY = h * 0.45;
    const bandH = h * 0.4;
    ctx.fillStyle = "#17344a";
    ctx.fillRect(0, bandY, w, bandH);
    ctx.strokeStyle = "#cfd8e0";
    ctx.lineWidth = 3;
    for (let x = 0; x <= w; x += w / 10) {
      ctx.beginPath();
      ctx.moveTo(x, bandY);
      ctx.lineTo(x, bandY + bandH);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, 0, w, bandY);
  }, 256, 256);
}

function applyBoxFaceTextures(geo, { front, side, top }) {
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z
  return [side, side, top, top, front, side];
}

// ---- W.E. O'Bryant Bell Tower ----
export function createBellTower(scene, x, z) {
  const group = new THREE.Group();
  const brick = "#7a2e22";
  const cream = "#ece4d0";

  function stage(w, h, d, { withArch, withLouver, withClock } = {}) {
    const tex = canvasTexture((ctx, cw, ch) => {
      const bt = brickTexture({ brick, rows: 14 });
      ctx.drawImage(bt.image, 0, 0, cw, ch);
      if (withArch) {
        ctx.fillStyle = "#1a1210";
        const aw = cw * 0.4;
        const ax = (cw - aw) / 2;
        const ah = ch * 0.5;
        const ay = ch - ah;
        ctx.beginPath();
        ctx.moveTo(ax, ay + ah);
        ctx.lineTo(ax, ay + ah * 0.35);
        ctx.quadraticCurveTo(ax, ay, ax + aw / 2, ay);
        ctx.quadraticCurveTo(ax + aw, ay, ax + aw, ay + ah * 0.35);
        ctx.lineTo(ax + aw, ay + ah);
        ctx.closePath();
        ctx.fill();
      }
      if (withLouver) {
        ctx.fillStyle = cream;
        const lw = cw * 0.22;
        const lx = (cw - lw) / 2;
        const lh = ch * 0.55;
        const ly = ch * 0.25;
        ctx.fillRect(lx - 4, ly - 4, lw + 8, lh + 8);
        ctx.fillStyle = "#3a2a22";
        for (let i = 0; i < 6; i++) {
          ctx.fillRect(lx, ly + (i * lh) / 6 + 2, lw, lh / 6 - 4);
        }
      }
      if (withClock) {
        const r = cw * 0.22;
        const cx = cw / 2;
        const cy = ch * 0.5;
        ctx.fillStyle = cream;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f5f2e8";
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#121212";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = "#121212";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy - r * 0.55);
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + r * 0.4, cy + r * 0.1);
        ctx.stroke();
      }
    }, 192, 256);
    const sideTex = canvasTexture((ctx, cw, ch) => {
      const bt = brickTexture({ brick, rows: 14 });
      ctx.drawImage(bt.image, 0, 0, cw, ch);
    }, 192, 256);
    const mat = [sideTex, sideTex, cream, cream, tex, sideTex].map(
      (t) => new THREE.MeshStandardMaterial(typeof t === "string" ? { color: t } : { map: t })
    );
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function band(w, d, h = 0.35) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: cream }));
    b.castShadow = true;
    return b;
  }

  // Base: four brick corner piers plus an upper lintel band, so the open
  // base reads as a real 4-way walk-through (N/S and E/W). The void beneath
  // the lintel is visible from every side. No solid box here.
  let y = 0;
  const baseH = 5.5;
  const pierShapes = bellTowerColliders(x, z);
  const basePierTex = brickTexture({ brick, rows: 14 });
  for (const shape of pierShapes) {
    const pier = new THREE.Mesh(
      new THREE.BoxGeometry(shape.w, baseH, shape.d),
      new THREE.MeshStandardMaterial({ map: basePierTex })
    );
    pier.position.set(shape.x - x, baseH / 2, shape.z - z);
    pier.castShadow = true;
    pier.receiveShadow = true;
    pier.userData.collider = shape;
    group.add(pier);
  }
  // Upper lintel band tying the four piers together. Lives entirely above
  // 1.7m so the auto-AABB collector skips it; walk-through stays clear.
  const outerSpan = 3.0;
  const pierW = pierShapes[0].w;
  const pierD = pierShapes[0].d;
  const lintelH = 0.6;
  const lintelY = baseH - lintelH / 2;
  const lintelMat = new THREE.MeshStandardMaterial({ map: basePierTex });
  for (const sign of [-1, 1]) {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(outerSpan, lintelH, pierD),
      lintelMat
    );
    beam.position.set(0, lintelY, sign * (outerSpan / 2 - pierD / 2));
    beam.castShadow = true;
    beam.userData.noCollision = true;
    group.add(beam);
  }
  for (const sign of [-1, 1]) {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(pierW, lintelH, outerSpan - 2 * pierD),
      lintelMat
    );
    beam.position.set(sign * (outerSpan / 2 - pierW / 2), lintelY, 0);
    beam.castShadow = true;
    beam.userData.noCollision = true;
    group.add(beam);
  }
  y += baseH;

  const b1 = band(3.3, 3.3);
  b1.position.y = y + 0.18;
  y += 0.35;
  group.add(b1);

  const s2 = stage(2.3, 3.2, 2.3, { withLouver: true });
  s2.position.y = y + 1.6;
  y += 3.2;
  group.add(s2);

  const b2 = band(2.6, 2.6);
  b2.position.y = y + 0.18;
  y += 0.35;
  group.add(b2);

  const s3 = stage(1.8, 2.3, 1.8, { withClock: true });
  s3.position.y = y + 1.15;
  y += 2.3;
  group.add(s3);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.3, 2.1), new THREE.MeshStandardMaterial({ color: cream }));
  cap.position.y = y + 0.15;
  y += 0.3;
  group.add(cap);

  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.8, 4), new THREE.MeshStandardMaterial({ color: "#9a8a6a" }));
  spire.position.y = y + 0.4;
  spire.rotation.y = Math.PI / 4;
  group.add(spire);

  const sign = labelPlane("W.E. O'Bryant Bell Tower", 2.6, 0.9, "#121212", "#f4b223");
  sign.position.set(0, 1.8, 1.55);
  group.add(sign);

  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

// Small deterministic hash so buildings sharing a template (academic halls,
// dorms) get a stable but varied look from their own name, instead of
// looking like exact copies when placed near each other.
function seedFromLabel(label) {
  const s = label || "";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// ---- Collegiate Gothic academic hall (à la Caldwell Hall) ----
export function createAcademicHall(scene, { x, z, w, h, d, label, brick = "#7a2e22" }) {
  const group = new THREE.Group();
  const cream = "#e8e2d0";
  const seed = seedFromLabel(label);
  const hasGable = seed % 3 !== 0; // most get the gable; some get a plain parapet
  const corniceTone = seed % 2 === 0 ? cream : "#d8cfb8";

  const frontTex = windowGridTexture({ brick, rows: 2, cols: Math.max(4, Math.round(w)) });
  const sideTex = windowGridTexture({ brick, rows: 2, cols: Math.max(2, Math.round(d * 0.6)) });

  const mats = applyBoxFaceTextures(null, { front: frontTex, side: sideTex, top: cream }).map((t) =>
    new THREE.MeshStandardMaterial(typeof t === "string" ? { color: t } : { map: t })
  );
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // cornice
  const cornice = new THREE.Mesh(
    new THREE.BoxGeometry(w * 1.02, 0.25, d * 1.02),
    new THREE.MeshStandardMaterial({ color: corniceTone })
  );
  cornice.position.y = h + 0.12;
  group.add(cornice);

  if (hasGable) {
    // stepped entrance gable, centered on the front face
    const gableW = Math.min(w * 0.22, 2.2);
    const gable = new THREE.Mesh(new THREE.BoxGeometry(gableW, 0.9, 0.3), new THREE.MeshStandardMaterial({ color: cream }));
    gable.position.set(0, h + 0.6, d / 2 - 0.1);
    group.add(gable);
    const gableTop = new THREE.Mesh(
      new THREE.ConeGeometry(gableW * 0.55, 0.5, 4),
      new THREE.MeshStandardMaterial({ color: cream })
    );
    gableTop.position.set(0, h + 1.3, d / 2 - 0.1);
    gableTop.rotation.y = Math.PI / 4;
    group.add(gableTop);
  } else {
    // plain stepped parapet instead of a gable
    const parapet = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.3, 0.6, 0.25),
      new THREE.MeshStandardMaterial({ color: cream })
    );
    parapet.position.set(0, h + 0.4, d / 2 - 0.05);
    group.add(parapet);
  }

  // entrance door surround
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.min(w * 0.14, 1.3), 1.6),
    new THREE.MeshStandardMaterial({ color: "#2a1a12" })
  );
  door.position.set(0, 0.8, d / 2 + 0.02);
  group.add(door);

  if (label) {
    const sign = labelPlane(label, Math.min(w * 0.6, 4.2), 1.0);
    sign.position.set(0, h * 0.68, d / 2 + 0.03);
    group.add(sign);
  }

  group.position.set(x, 0, z);
  collideWithDoor(body, x, z, w, d);
  scene.add(group);
  return group;
}

// ---- Caldwell Hall (NRHP-listed, 1928) ----
// Researched from Wikipedia: a T-shaped, two-story Late Gothic Revival brick
// building with Art Deco stone panels above the central entrance. Modeled as
// the standard academic hall plus a projecting entrance wing and a carved
// stone panel over the door.
export function createCaldwellHall(scene, { x, z, w, h, d, label }) {
  const group = createAcademicHall(scene, { x: 0, z: 0, w, h, d, label: null, brick: "#5a6a8a" });
  const cream = "#e8e2d0";

  // T-shape: a projecting entrance wing
  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.35, h * 0.9, d * 0.45),
    new THREE.MeshStandardMaterial({ color: "#5a6a8a" })
  );
  wing.position.set(0, (h * 0.9) / 2, d / 2 + (d * 0.45) / 2 - 0.1);
  wing.castShadow = true;
  group.add(wing);

  // Art Deco stone panel over the entrance
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.2, 1.1, 0.15),
    new THREE.MeshStandardMaterial({ color: cream })
  );
  panel.position.set(0, h * 0.72, d / 2 + d * 0.45 + 0.02);
  group.add(panel);
  const panelDetail = labelPlane("UAPB 1928", w * 0.18, 0.6, "#e8e2d0", "#2a2a2a");
  panelDetail.position.set(0, h * 0.72, d / 2 + d * 0.45 + 0.1);
  group.add(panelDetail);

  if (label) {
    const sign = labelPlane(label, Math.min(w * 0.6, 4.2), 1.0);
    sign.position.set(0, h * 0.35, d / 2 + d * 0.45 + 0.03);
    group.add(sign);
  }

  group.position.set(x, 0, z);
  const hall = group.children.find((child) => child.isMesh);
  if (hall) hall.userData.collider = { x, z, w, d };
  collideWithDoor(wing, x, z + d / 2 + (d * 0.45) / 2 - 0.1, w * 0.35, d * 0.45);
  return group;
}

// ---- Modern institutional building (Union / Library / Admin / Arts / Athletics) ----
export function createModernHall(scene, { x, z, w, h, d, label, color = "#3a5c8a", columns = false }) {
  const group = new THREE.Group();
  const cream = "#e8e2d0";

  const bandTex = glassBandTexture({ base: color });
  const sideMat = new THREE.MeshStandardMaterial({ map: bandTex });
  const topMat = new THREE.MeshStandardMaterial({ color: cream });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sideMat, sideMat, topMat, topMat, sideMat, sideMat]);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w * 1.04, 0.3, d * 1.04),
    new THREE.MeshStandardMaterial({ color: cream })
  );
  roof.position.y = h + 0.15;
  group.add(roof);

  if (columns) {
    const colCount = 4;
    const colH = h * 0.75;
    for (let i = 0; i < colCount; i++) {
      const cx = -w / 2 + (w / (colCount - 1)) * i;
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, colH, 10),
        new THREE.MeshStandardMaterial({ color: cream })
      );
      col.position.set(cx, colH / 2, d / 2 + 0.5);
      col.castShadow = true;
      group.add(col);
    }
    const pediment = new THREE.Mesh(
      new THREE.ConeGeometry(w * 0.55, 0.9, 3),
      new THREE.MeshStandardMaterial({ color: cream })
    );
    pediment.rotation.z = Math.PI;
    pediment.rotation.y = Math.PI / 2;
    pediment.scale.set(1, 1, 0.4);
    pediment.position.set(0, h * 0.75 + 0.45, d / 2 + 0.5);
    group.add(pediment);
  }

  if (label) {
    const sign = labelPlane(label, Math.min(w * 0.8, 6), 1.3, "#121212", "#f4b223");
    sign.position.set(0, h / 2, d / 2 + 0.03);
    group.add(sign);
  }

  group.position.set(x, 0, z);
  collideWithDoor(body, x, z, w, d);
  scene.add(group);
  return group;
}

// ---- L.A. Davis, Sr. Student Union (cantilevered modern box) ----
export function createStudentUnion(scene, { x, z, w, h, d, label }) {
  const group = new THREE.Group();
  const white = "#eef0ee";

  const baseH = h * 0.6;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.82, baseH, d * 0.82),
    new THREE.MeshStandardMaterial({ color: white })
  );
  base.position.y = baseH / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // glass entrance band at ground level
  const glassTex = canvasTexture((ctx, cw, ch) => {
    ctx.fillStyle = "#17344a";
    ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = "#cfd8e0";
    ctx.lineWidth = 4;
    for (let i = 0; i <= 8; i++) {
      const gx = (cw / 8) * i;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, ch);
      ctx.stroke();
    }
  }, 256, 128);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.6, baseH * 0.6),
    new THREE.MeshStandardMaterial({ map: glassTex })
  );
  glass.position.set(0, baseH * 0.35, (d * 0.82) / 2 + 0.02);
  group.add(glass);

  // cantilevered upper volume, overhanging the entrance
  const capH = h * 0.4;
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(w, capH, d),
    new THREE.MeshStandardMaterial({ color: white })
  );
  cap.position.set(0, baseH + capH / 2, -d * 0.06);
  cap.castShadow = true;
  cap.userData.noCollision = true;
  group.add(cap);

  // dark underside reveal on the cantilever, like the real overhang
  const underside = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.98, d * 0.3),
    new THREE.MeshStandardMaterial({ color: "#1a1a1a" })
  );
  underside.rotation.x = Math.PI / 2;
  underside.position.set(0, baseH + 0.02, d * 0.3);
  group.add(underside);

  // ribbon windows on the cap
  const ribbon = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.9, capH * 0.45),
    new THREE.MeshStandardMaterial({ map: glassTex })
  );
  ribbon.position.set(0, baseH + capH * 0.55, d / 2 + 0.02);
  group.add(ribbon);

  if (label) {
    const sign = labelPlane(label, Math.min(w * 0.8, 6), 1.1, "#121212", "#f4b223");
    sign.position.set(0, baseH * 0.8, d * 0.82 / 2 + 0.05);
    group.add(sign);
  }

  group.position.set(x, 0, z);
  collideWithDoor(base, x, z, w * 0.82, d * 0.82, Math.min(4.2, w * 0.28));
  scene.add(group);
  return group;
}

// ---- John Brown Watson Memorial Library (brick + glass + columns) ----
export function createLibrary(scene, { x, z, w, h, d, label }) {
  const group = new THREE.Group();
  const brick = "#7a3b2e";
  const cream = "#e8e2d0";

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ map: brickTexture({ brick, rows: 28, cols: 32 }) })
  );
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // flat overhanging canopy roof
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(w * 1.15, 0.3, d * 1.15),
    new THREE.MeshStandardMaterial({ color: cream })
  );
  canopy.position.y = h + 0.15;
  canopy.userData.noCollision = true;
  group.add(canopy);

  // glass entrance
  const glassTex = canvasTexture((ctx, cw, ch) => {
    ctx.fillStyle = "#17344a";
    ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = "#cfd8e0";
    ctx.lineWidth = 3;
    for (let i = 0; i <= 5; i++) {
      const gx = (cw / 5) * i;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, ch);
      ctx.stroke();
    }
  }, 256, 160);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.68, h * 0.88),
    new THREE.MeshStandardMaterial({ map: glassTex })
  );
  glass.position.set(0, h * 0.46, d / 2 + 0.02);
  group.add(glass);

  // four white entrance columns
  for (let i = 0; i < 4; i++) {
    const cx = -w * 0.3 + (w * 0.6 * i) / 3;
    const col = new THREE.Mesh(
      new THREE.BoxGeometry(.45, h * .95, .45),
      new THREE.MeshStandardMaterial({ color: cream })
    );
    col.position.set(cx, (h * 0.85) / 2, d / 2 + 0.6);
    col.castShadow = true;
    group.add(col);
  }

  if (label) {
    const sign = labelPlane(label, Math.min(w * 0.8, 6), 1.1, "#121212", "#f4b223");
    sign.position.set(0, h * 0.78, d / 2 + 0.03);
    group.add(sign);
  }

  group.position.set(x, 0, z);
  collideWithDoor(body, x, z, w, d, Math.min(3.6, w * 0.28));
  scene.add(group);
  return group;
}

// ---- Residential hall (dorms) ----
export function createDormHall(scene, { x, z, w, h, d, label, color = "#6b4423" }) {
  const group = new THREE.Group();
  const cream = "#e8e2d0";
  const floors = Math.max(2, Math.round(h / 2.3));
  const seed = seedFromLabel(label);
  const roofColor = ["#2a2a2a", "#3a2a1a", "#2a2a2a"][seed % 3];
  const hasAwning = seed % 2 === 0;

  const frontTex = canvasTexture((ctx, cw, ch) => {
    const bt = brickTexture({ brick: color, rows: 10 });
    ctx.drawImage(bt.image, 0, 0, cw, ch);
    const cols = Math.max(4, Math.round(w * 0.8));
    const rowH = ch / floors;
    for (let r = 0; r < floors; r++) {
      const y = r * rowH;
      ctx.fillStyle = "rgba(230,225,208,0.9)";
      ctx.fillRect(0, y + rowH - 6, cw, 4); // balcony line
      for (let c = 0; c < cols; c++) {
        const cellW = cw / cols;
        const wx = c * cellW + cellW * 0.2;
        const ww = cellW * 0.6;
        const wy = y + rowH * 0.2;
        const wh = rowH * 0.55;
        ctx.fillStyle = "#e8e2d0";
        ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
        ctx.fillStyle = "#2a3b55";
        ctx.fillRect(wx, wy, ww, wh);
      }
    }
  }, 384, 256);
  const sideTex = brickTexture({ brick: color, rows: 10 });

  const mats = [sideTex, sideTex, cream, cream, frontTex, sideTex].map(
    (t) => new THREE.MeshStandardMaterial(typeof t === "string" ? { color: t } : { map: t })
  );
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w * 1.02, 0.25, d * 1.02),
    new THREE.MeshStandardMaterial({ color: roofColor })
  );
  roof.position.y = h + 0.12;
  group.add(roof);

  if (hasAwning) {
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(w * 0.3, 2.0), 0.15, 0.9),
      new THREE.MeshStandardMaterial({ color: cream })
    );
    awning.position.set(0, 1.9, d / 2 + 0.45);
    awning.castShadow = true;
    group.add(awning);
  }

  if (label) {
    const sign = labelPlane(label, Math.min(w * 0.7, 4.5), 1.0, "#121212", "#f4b223");
    sign.position.set(0, h * 0.5, d / 2 + 0.03);
    group.add(sign);
  }

  group.position.set(x, 0, z);
  collideWithDoor(body, x, z, w, d);
  scene.add(group);
  return group;
}

// ---- Kenneth L. Johnson HPER Complex (gym, pool, courts) ----
// Researched from UAPB facility descriptions: a rec/athletics complex with
// an arena, pool, and racquetball courts — modeled as a glass-banded box
// with a barrel-vaulted gym roof over the arena portion.
export function createGymComplex(scene, { x, z, w, h, d, label, color = "#2d6b4a" }) {
  const group = new THREE.Group();
  const cream = "#e8e2d0";

  const bandTex = glassBandTexture({ base: color });
  const sideMat = new THREE.MeshStandardMaterial({ map: bandTex });
  const topMat = new THREE.MeshStandardMaterial({ color: cream });
  const bodyH = h * 0.62;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, d), [sideMat, sideMat, topMat, topMat, sideMat, sideMat]);
  body.position.y = bodyH / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // barrel-vaulted arena roof
  const vault = new THREE.Mesh(
    new THREE.CylinderGeometry(w * 0.4, w * 0.4, d * 0.85, 20, 1, true, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x9aa0a6, side: THREE.DoubleSide })
  );
  vault.rotation.x = Math.PI / 2;
  vault.rotation.z = Math.PI;
  vault.position.set(0, bodyH, 0);
  vault.castShadow = true;
  group.add(vault);

  const glassTex = canvasTexture((ctx, cw, ch) => {
    ctx.fillStyle = "#17344a";
    ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = "#cfd8e0";
    ctx.lineWidth = 3;
    for (let i = 0; i <= 6; i++) {
      const gx = (cw / 6) * i;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, ch);
      ctx.stroke();
    }
  }, 256, 160);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.5, bodyH * 0.65),
    new THREE.MeshStandardMaterial({ map: glassTex })
  );
  glass.position.set(0, bodyH * 0.4, d / 2 + 0.02);
  group.add(glass);

  if (label) {
    const sign = labelPlane(label, Math.min(w * 0.8, 6), 1.1, "#121212", "#f4b223");
    sign.position.set(0, bodyH * 0.82, d / 2 + 0.03);
    group.add(sign);
  }

  group.position.set(x, 0, z);
  collideWithDoor(body, x, z, w, d);
  scene.add(group);
  return group;
}

// ---- Hathaway-Howard Fine Arts Center (with the Windgate Art Tower) ----
// Researched: a $5M Windgate Foundation gift funds a new Art Tower addition —
// described as the tallest building on campus once complete. Modeled as a
// purple-accented main hall with a slender tower volume at one corner.
export function createFineArtsCenter(scene, { x, z, w, h, d, label, color = "#7a2d8a" }) {
  const group = new THREE.Group();
  const cream = "#e8e2d0";

  const bandTex = glassBandTexture({ base: color });
  const sideMat = new THREE.MeshStandardMaterial({ map: bandTex });
  const topMat = new THREE.MeshStandardMaterial({ color: cream });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sideMat, sideMat, topMat, topMat, sideMat, sideMat]);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const towerH = h * 2.1;
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.26, towerH, d * 0.26),
    new THREE.MeshStandardMaterial({ color: "#5a1f66" })
  );
  tower.position.set(w * 0.32, towerH / 2, -d * 0.32);
  tower.castShadow = true;
  group.add(tower);

  const towerCap = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.3, 0.25, d * 0.3),
    new THREE.MeshStandardMaterial({ color: cream })
  );
  towerCap.position.set(w * 0.32, towerH + 0.12, -d * 0.32);
  group.add(towerCap);

  const towerSign = labelPlane("Windgate Art Tower", w * 0.5, 0.8, "#121212", "#f4b223");
  towerSign.position.set(w * 0.32, towerH * 0.55, -d * 0.32 + d * 0.13 + 0.02);
  group.add(towerSign);

  if (label) {
    const sign = labelPlane(label, Math.min(w * 0.8, 6), 1.1, "#121212", "#f4b223");
    sign.position.set(0, h * 0.5, d / 2 + 0.03);
    group.add(sign);
  }

  group.position.set(x, 0, z);
  collideWithDoor(body, x, z, w, d);
  scene.add(group);
  return group;
}

// ---- STEM Building & Conference Center (with its reflective pool) ----
// Researched: a $10M, 29,000 sq ft facility with labs, a conference center,
// and a reflective pool out front — modeled with a glass-banded box and a
// shallow water plane facing the entrance.
export function createSTEMBuilding(scene, { x, z, w, h, d, label, color = "#2d6b8a" }) {
  const group = new THREE.Group();
  const cream = "#e8e2d0";

  const bandTex = glassBandTexture({ base: color });
  const sideMat = new THREE.MeshStandardMaterial({ map: bandTex });
  const topMat = new THREE.MeshStandardMaterial({ color: cream });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sideMat, sideMat, topMat, topMat, sideMat, sideMat]);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.7, d * 0.45),
    new THREE.MeshStandardMaterial({ color: "#2a5a7a", metalness: 0.35, roughness: 0.15 })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.03, d / 2 + d * 0.3);
  pool.receiveShadow = true;
  group.add(pool);

  const poolEdge = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.72, 0.1, d * 0.47),
    new THREE.MeshStandardMaterial({ color: cream })
  );
  poolEdge.position.set(0, -0.01, d / 2 + d * 0.3);
  poolEdge.userData.noCollision = true;
  group.add(poolEdge);

  if (label) {
    const sign = labelPlane(label, Math.min(w * 0.8, 6), 1.1, "#121212", "#f4b223");
    sign.position.set(0, h * 0.5, d / 2 + 0.03);
    group.add(sign);
  }

  group.position.set(x, 0, z);
  collideWithDoor(body, x, z, w, d);
  scene.add(group);
  return group;
}

// ---- Golden Lion Stadium (Simmons Bank Field) ----
export function createStadiumComplex(scene, x, z) {
  const group = new THREE.Group();

  const fieldTex = canvasTexture((ctx, w, h) => {
    ctx.fillStyle = "#2f8f3f";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    for (let i = 1; i < 10; i++) {
      const x1 = (w / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x1, h * 0.08);
      ctx.lineTo(x1, h * 0.92);
      ctx.stroke();
    }
    ctx.fillStyle = "#f4b223";
    ctx.fillRect(0, 0, w * 0.09, h);
    ctx.fillRect(w * 0.91, 0, w * 0.09, h);
    ctx.fillStyle = "#121212";
    ctx.font = "bold 46px sans-serif";
    ctx.textAlign = "center";
    ctx.save();
    ctx.translate(w * 0.045, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("UAPB", 0, 14);
    ctx.restore();
    ctx.save();
    ctx.translate(w * 0.955, h / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText("UAPB", 0, 14);
    ctx.restore();
  }, 512, 256);
  const field = new THREE.Mesh(new THREE.PlaneGeometry(36, 18), new THREE.MeshStandardMaterial({ map: fieldTex }));
  field.rotation.x = -Math.PI / 2;
  field.position.set(0, 0.02, 0);
  field.receiveShadow = true;
  field.userData.noCollision = true; // play surface stays walkable
  group.add(field);

  function grandstand(tiers, tierDepth, tierHeight, width, gx, gz, rotY) {
    const stand = new THREE.Group();
    for (let i = 0; i < tiers; i++) {
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(width, tierHeight, tierDepth),
        new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0x9aa0a6 : 0x8a9096 })
      );
      seg.position.set(0, tierHeight / 2 + i * tierHeight, -i * tierDepth * 0.9);
      seg.castShadow = true;
      seg.receiveShadow = true;
      stand.add(seg);
    }
    stand.position.set(gx, 0, gz);
    stand.rotation.y = rotY;
    group.add(stand);
    return stand;
  }

  // Home grandstand (larger, tiered) with a press box
  const home = grandstand(4, 1.6, 1.1, 30, 0, -10.5, 0);
  const pressBox = new THREE.Mesh(
    new THREE.BoxGeometry(10, 2.2, 2.2),
    new THREE.MeshStandardMaterial({ color: 0xe8e2d0 })
  );
  pressBox.position.set(0, 4.4 + 1.1, -10.5 - 3.2);
  pressBox.castShadow = true;
  group.add(pressBox);

  // Away stands (smaller)
  grandstand(3, 1.3, 1, 26, 0, 10.5, Math.PI);

  // Explicit stand/press-box colliders. Upper tiers and the elevated press
  // box would otherwise slip past the auto-AABB height threshold, letting the
  // player clip into the structure from behind the first row.
  for (const shape of stadiumColliders(x, z)) {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(shape.w, 1, shape.d),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    marker.position.set(shape.x - x, 0.5, shape.z - z);
    marker.userData.collider = shape;
    group.add(marker);
  }

  // Scoreboard at one end
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(5, 3, 0.4),
    new THREE.MeshStandardMaterial({
      map: canvasTexture((ctx, w, h) => {
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#f4b223";
        ctx.font = "bold 34px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("GOLDEN LIONS", w / 2, h / 2 - 8);
        ctx.fillText("0  -  0", w / 2, h / 2 + 34);
      }),
    })
  );
  board.position.set(0, 3.2, -20.5);
  group.add(board);

  // Corner light towers
  [[-17, -9], [17, -9], [-15, 9], [15, 9]].forEach(([lx, lz]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 9, 8), new THREE.MeshStandardMaterial({ color: 0x555555 }));
    pole.position.set(lx, 4.5, lz);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.3), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffffff, emissiveIntensity: 0.15 }));
    lamp.position.set(lx, 9, lz);
    group.add(pole, lamp);
  });

  const sign = labelPlane("Golden Lion Stadium", 5, 1.2, "#0a5c2b", "#fff");
  sign.position.set(0, 4.6, -20.3);
  group.add(sign);

  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

// Unverified architectural details stay simple, but the massing follows the
// pinned OSM polygon instead of shrinking each building into an arbitrary box.
export function createFootprintBuilding(scene, building) {
  const { x, z, h, footprint, name } = building;
  const shape = new THREE.Shape();
  footprint.forEach((p,i) => { if (i) shape.lineTo(p.x-x,-(p.z-z)); else shape.moveTo(p.x-x,-(p.z-z)); });
  const geometry = new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false}); geometry.rotateX(-Math.PI/2);
  const brick=brickTexture({brick:'#865448',rows:18,cols:20});
  const group=new THREE.Group(),body=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:brick,roughness:.95}));body.castShadow=true;body.receiveShadow=true;body.userData.collider={x,z,w:building.w,d:building.d,polygon:footprint};group.add(body);
  const glass=new THREE.MeshStandardMaterial({color:'#4e6972',roughness:.28});
  const cream=new THREE.MeshStandardMaterial({color:'#ded8c9'});
  for(let i=1;i<footprint.length;i++){
    const a=footprint[i-1],b=footprint[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);
    if(length<2)continue;
    const band=new THREE.Mesh(new THREE.BoxGeometry(.15,.2,length),cream);band.rotation.y=angle;band.position.set((a.x+b.x)/2-x,h-.2,(a.z+b.z)/2-z);group.add(band);
    for(let t=1;t<length-1;t+=2.5)for(let y=1.8;y<h-.7;y+=2.6){
      const window=new THREE.Mesh(new THREE.BoxGeometry(.12,1.3,1.2),glass);window.rotation.y=angle;window.position.set(a.x+dx*t/length-x,y,a.z+dz*t/length-z);group.add(window);
    }
  }
  const sign=labelPlane(name,Math.min(building.w*.7,7),.9);sign.position.set(0,2.7,building.d/2+.08);group.add(sign);
  group.position.set(x,0,z);scene.add(group);return group;
}

// ---- Collider helpers (exported for unit tests and reuse) ----
// Bell tower base is a true 4-way open base: four brick corner piers framing
// walk-through openings on both the N/S and E/W axes. These shapes are
// world-space AABBs matching the pier footprints. With a player radius of
// 0.38 the center stays clear and both transits remain passable; the piers
// themselves block, and the outer footprint still spans a 3.0m square.
export function bellTowerColliders(cx, cz) {
  const pierW = 0.85, pierD = 0.85, offset = 1.075; // outer edge at ±1.5
  return [
    { x: cx - offset, z: cz - offset, w: pierW, d: pierD },
    { x: cx + offset, z: cz - offset, w: pierW, d: pierD },
    { x: cx - offset, z: cz + offset, w: pierW, d: pierD },
    { x: cx + offset, z: cz + offset, w: pierW, d: pierD },
  ];
}

// Stadium colliders: home grandstand (4 tiers deep), away grandstand (3
// tiers), and the elevated press box behind the home top tier. The field
// surface itself is intentionally omitted so players can walk onto it.
export function stadiumColliders(cx, cz) {
  // Home: 4 tiers of depth 1.1 stepped back by 0.9 * depth each row.
  const homeDepth = 1.1 + 3 * 1.1 * 0.9; // 4.07
  const homeCenterOffset = (1.1 * 0.9) * 3 / 2; // 1.485 from the front edge
  // Away: 3 tiers of depth 1.0, rotated 180 so the step is toward +z.
  const awayDepth = 1.0 + 2 * 1.0 * 0.9; // 2.8
  const awayCenterOffset = (1.0 * 0.9) * 2 / 2; // 0.9
  return [
    { x: cx, z: cz - 10.5 - homeCenterOffset, w: 30, d: homeDepth },
    { x: cx, z: cz + 10.5 + awayCenterOffset, w: 26, d: awayDepth },
    { x: cx, z: cz - 13.7, w: 10, d: 2.2 }, // press box
  ];
}
