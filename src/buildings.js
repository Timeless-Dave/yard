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
import * as THREE from "three";

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

  let y = 0;
  const s1 = stage(3.0, 5.5, 3.0, { withArch: true });
  s1.position.y = y + 2.75;
  y += 5.5;
  group.add(s1);

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

// ---- Collegiate Gothic academic hall (à la Caldwell Hall) ----
export function createAcademicHall(scene, { x, z, w, h, d, label, brick = "#7a2e22" }) {
  const group = new THREE.Group();
  const cream = "#e8e2d0";

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

  // cream cornice
  const cornice = new THREE.Mesh(
    new THREE.BoxGeometry(w * 1.02, 0.25, d * 1.02),
    new THREE.MeshStandardMaterial({ color: cream })
  );
  cornice.position.y = h + 0.12;
  group.add(cornice);

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
  scene.add(group);
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
  scene.add(group);
  return group;
}

// ---- Residential hall (dorms) ----
export function createDormHall(scene, { x, z, w, h, d, label, color = "#6b4423" }) {
  const group = new THREE.Group();
  const cream = "#e8e2d0";
  const floors = Math.max(2, Math.round(h / 2.3));

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
    new THREE.MeshStandardMaterial({ color: "#2a2a2a" })
  );
  roof.position.y = h + 0.12;
  group.add(roof);

  if (label) {
    const sign = labelPlane(label, Math.min(w * 0.7, 4.5), 1.0, "#121212", "#f4b223");
    sign.position.set(0, h * 0.5, d / 2 + 0.03);
    group.add(sign);
  }

  group.position.set(x, 0, z);
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
