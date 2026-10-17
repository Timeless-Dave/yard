import * as THREE from "three";
import "./style.css";
import { mountCardGame } from "./minigames/cards.js";
import { mountStepShow } from "./minigames/stepshow.js";
import { mountDominoes } from "./minigames/dominoes.js";
import { mountPager } from "./minigames/pager.js";
import { mountCookout } from "./minigames/cookout.js";
import { mountCommunity } from "./minigames/community.js";
import { mountPlotClaim } from "./minigames/plotClaim.js";
import { mountLeaderboard } from "./minigames/leaderboard.js";
import { mountVoting } from "./minigames/voting.js";
import { mountStore } from "./minigames/store.js";
import { isHalloween } from "./seasonal.js";
import { mountParties } from "./minigames/parties.js";
import { mountVending } from "./minigames/vending.js";
import { PARTY_SPOTS } from "./partySpots.js";
import { startWeatherLoop, onWeatherChange } from "./weather.js";
import { BUILDINGS, REAL_RECREATION, RETAIL_NEAR_UNION, FICTIONAL_RECREATION } from "./campusData.js";
import { createBellTower, createAcademicHall, createModernHall, createDormHall, createStadiumComplex, createStudentUnion, createLibrary } from "./buildings.js";
import { mountAuthModal } from "./authModal.js";
import { onAuthChange } from "./auth.js";
import { supabase, ONLINE } from "./supabase.js";
import { joinPresence, leavePresence, updateMyPosition, setMyIdentity, onPeersChange } from "./multiplayer.js";
import { watchWallet, stopWatchingWallet, onBalanceChange } from "./economy.js";

const UAPB_GOLD = 0xf4b223;
const UAPB_BLACK = 0x121212;

const app = document.getElementById("app");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
app.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd0f0);
scene.fog = new THREE.Fog(0x8fd0f0, 70, 240);

const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  0.1,
  900
);
const CAM_OFFSET = new THREE.Vector3(18, 22, 18);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const hemi = new THREE.HemisphereLight(0xffffff, 0x4a7c3c, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(30, 40, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -80;
sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80;
sun.shadow.camera.bottom = -80;
scene.add(sun);

const DAY_SKY = 0x8fd0f0;
const NIGHT_SKY = 0x0b1030;
const SKY_DIM = { clear: 1, cloudy: 0.8, fog: 0.75, rain: 0.6, storm: 0.45, snow: 0.85 };
let nightMode = false;
let autoNightFromWeather = true;

function setNightMode(on, { manual = false } = {}) {
  nightMode = on;
  if (manual) autoNightFromWeather = false;
  const dim = SKY_DIM[currentWeatherCategory] ?? 1;
  const skyBase = new THREE.Color(on ? NIGHT_SKY : DAY_SKY);
  skyBase.multiplyScalar(on ? 1 : dim);
  scene.background = skyBase;
  scene.fog.color = skyBase;
  hemi.intensity = (on ? 0.22 : 0.9) * dim;
  sun.intensity = (on ? 0.15 : 1.4) * dim;
  nightToggleEl.textContent = on ? "☀️ Day Mode" : "🌙 Night Mode";
  nightToggleEl.classList.toggle("chip-active", on);
}
const nightToggleEl = document.getElementById("night-toggle");
nightToggleEl.addEventListener("click", () => setNightMode(!nightMode, { manual: true }));

// ---- Weather (real data, see src/weather.js) ----
let currentWeatherCategory = "clear";
const weatherBadgeEl = document.getElementById("weather-badge");

function makeWeatherParticles(count, color, size) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 140;
    positions[i * 3 + 1] = Math.random() * 60;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 140;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.6 });
  const points = new THREE.Points(geo, mat);
  points.visible = false;
  points.frustumCulled = false;
  scene.add(points);
  return points;
}
const rainParticles = makeWeatherParticles(600, 0xaad4ff, 0.25);
const snowParticles = makeWeatherParticles(400, 0xffffff, 0.35);

function updateWeatherParticles(dt) {
  if (rainParticles.visible) {
    const pos = rainParticles.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - dt * 40;
      if (y < 0) y = 60;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    rainParticles.position.set(avatar.position.x, 0, avatar.position.z);
  }
  if (snowParticles.visible) {
    const pos = snowParticles.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - dt * 4;
      if (y < 0) y = 60;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    snowParticles.position.set(avatar.position.x, 0, avatar.position.z);
  }
}

function applyWeather(w) {
  currentWeatherCategory = w.category;
  if (autoNightFromWeather) setNightMode(!w.isDay);
  else setNightMode(nightMode); // re-apply dimming for the new weather at the same day/night state

  scene.fog.near = w.category === "fog" ? 20 : 70;
  scene.fog.far = w.category === "fog" ? 90 : w.category === "storm" || w.category === "rain" ? 170 : 240;

  rainParticles.visible = w.category === "rain" || w.category === "storm";
  snowParticles.visible = w.category === "snow";

  if (weatherBadgeEl) {
    const tempLabel = w.tempF != null ? `${w.tempF}°F` : "";
    weatherBadgeEl.textContent = `${w.icon} ${tempLabel}`.trim();
    weatherBadgeEl.title = w.label + " · Pine Bluff, AR";
  }
}
onWeatherChange(applyWeather);
startWeatherLoop();

function canvasTexture(draw, w = 256, h = 256) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// ---- Ground (sized to cover the real, OSM-derived campus footprint) ----
const GROUND_W = 520;
const GROUND_D = 720;
const GROUND_CX = -50;
const GROUND_CZ = -150;
const X_MIN = GROUND_CX - GROUND_W / 2 + 10;
const X_MAX = GROUND_CX + GROUND_W / 2 - 10;
const Z_MIN = GROUND_CZ - GROUND_D / 2 + 10;
const Z_MAX = GROUND_CZ + GROUND_D / 2 - 10;

const groundTex = canvasTexture((ctx, w, h) => {
  ctx.fillStyle = "#5fae46";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < 400; i++) {
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
}, 512, 512);
groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
groundTex.repeat.set(Math.round(GROUND_W / 12), Math.round(GROUND_D / 12));

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(GROUND_W, GROUND_D),
  new THREE.MeshStandardMaterial({ map: groundTex })
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(GROUND_CX, 0, GROUND_CZ);
ground.receiveShadow = true;
scene.add(ground);

function pathSegment(x, z, w, d) {
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: 0xcdbfa3 })
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(x, 0.01, z);
  path.receiveShadow = true;
  scene.add(path);
}

// Bell Tower plaza (campus center) + plaza patches at the other real hubs
pathSegment(0, 0, 26, 26);
pathSegment(0, -18, 6, 20);
pathSegment(0, 18, 6, 20);
pathSegment(-18, 0, 20, 6);
pathSegment(18, 0, 20, 6);
pathSegment(-60, -22, 30, 24); // Student Union
pathSegment(-123, -147, 24, 20); // HPER
pathSegment(60, -67, 22, 18); // Administration
pathSegment(-31, -429, 40, 30); // Stadium approach

// ---- Buildings ----
function labelTexture(text, bg = "#121212", fg = "#f4b223") {
  return canvasTexture((ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    wrapText(ctx, text, w / 2, h / 2, w - 20, 36);
  }, 256, 128);
}
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  const lines = [];
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word + " ";
    } else {
      line = test;
    }
  }
  lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l.trim(), x, startY + i * lineHeight));
}

function createBuilding({ x, z, w, h, d, color, label, rotY = 0 }) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color })
  );
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w * 1.03, 0.4, d * 1.03),
    new THREE.MeshStandardMaterial({ color: UAPB_BLACK })
  );
  roof.position.y = h + 0.2;
  group.add(roof);

  if (label) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(w * 0.9, 7), 1.5),
      new THREE.MeshBasicMaterial({ map: labelTexture(label), transparent: true })
    );
    sign.position.set(0, h / 2, d / 2 + 0.05);
    group.add(sign);
  }

  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  scene.add(group);
  return group;
}

// Real UAPB buildings, positioned from OpenStreetMap data (see campusData.js).
// The popular/iconic ones get researched, detailed models (src/buildings.js);
// everything else still gets a labeled, colored building.
BUILDINGS.forEach((b) => {
  if (b.name === "W.E. O'Bryant Bell Tower") {
    createBellTower(scene, b.x, b.z);
    return;
  }
  if (b.name === "Golden Lion Stadium") {
    createStadiumComplex(scene, b.x, b.z);
    return;
  }
  if (b.name === "Administration Building") {
    createModernHall(scene, { x: b.x, z: b.z, w: b.w, h: b.h, d: b.d, label: b.name, color: b.color, columns: true });
    return;
  }
  if (b.kind === "student_life") {
    createStudentUnion(scene, { x: b.x, z: b.z, w: b.w, h: b.h, d: b.d, label: b.name });
    return;
  }
  if (b.name === "John Brown Watson Memorial Library") {
    createLibrary(scene, { x: b.x, z: b.z, w: b.w, h: b.h, d: b.d, label: b.name });
    return;
  }
  if (b.kind === "arts" || b.kind === "athletics" || b.kind === "admin") {
    createModernHall(scene, { x: b.x, z: b.z, w: b.w, h: b.h, d: b.d, label: b.name, color: b.color });
    return;
  }
  if (b.kind === "dorm") {
    createDormHall(scene, { x: b.x, z: b.z, w: b.w, h: b.h, d: b.d, label: b.name, color: b.color });
    return;
  }
  // Remaining academic halls — Collegiate Gothic, à la Caldwell Hall.
  createAcademicHall(scene, { x: b.x, z: b.z, w: b.w, h: b.h, d: b.d, label: b.name, brick: b.color });
});

// Retail/dining kiosks near the Student Union (OSM has no interior POI data
// for these, so they're placed just outside the real union building)
RETAIL_NEAR_UNION.forEach((r) => {
  createBuilding({ x: r.x, z: r.z, w: 4, h: 3, d: 4, color: parseInt(r.color.slice(1), 16), label: `${r.icon} ${r.name}` });
});

const interactionZones = [];

RETAIL_NEAR_UNION.forEach((r) => {
  interactionZones.push({ x: r.x, z: r.z, radius: 3, key: "shopnote", label: `Visit ${r.name}`, note: r.name });
});

// ---- Recreation: real OSM-tagged fields + a couple of fun additions ----
function createField(x, z, w, d, color, label) {
  const field = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color })
  );
  field.rotation.x = -Math.PI / 2;
  field.position.set(x, 0.02, z);
  field.receiveShadow = true;
  scene.add(field);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.min(w * 0.6, 6), 1.3),
    new THREE.MeshBasicMaterial({ map: labelTexture(label), transparent: true })
  );
  sign.position.set(x, 2.2, z - d / 2 - 0.1);
  scene.add(sign);
}

REAL_RECREATION.forEach((r) => {
  createField(r.x, r.z, r.w, r.d, 0x3f8f3a, r.name);
  interactionZones.push({ x: r.x, z: r.z, radius: Math.max(r.w, r.d) / 2, key: "rec", label: `Pickup run at ${r.name}`, note: r.name });
});
FICTIONAL_RECREATION.forEach((r) => {
  createField(r.x, r.z, r.w, r.d, 0x3f8f3a, r.name + " (added)");
  interactionZones.push({ x: r.x, z: r.z, radius: Math.max(r.w, r.d) / 2, key: "rec", label: `Play at ${r.name}`, note: r.name });
});

// ---- Divine Nine plot row (Bell Tower Yard) ----
const plots = [
  { letters: "ΑΦΑ", color: 0x111111 },
  { letters: "ΔΣΘ", color: 0xcc0033 },
  { letters: "ΚΑΨ", color: 0x9b1b1b },
  { letters: "ΟΦΒ", color: 0xf4b223 },
  { letters: "ΖΦΒ", color: 0x1a5fb4 },
];
plots.forEach((p, i) => {
  const x = -24 + i * 12;
  const z = -6;
  createBuilding({ x, z, w: 5, h: 3.4, d: 5, color: p.color, label: p.letters });
  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 0.05, 24),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4b223, emissiveIntensity: 0.4, transparent: true, opacity: 0.5 })
  );
  marker.position.set(x, 0.03, z + 4);
  scene.add(marker);
  interactionZones.push({ x, z: z + 4, radius: 3, key: "plots", label: `Claim ${p.letters} plot`, note: p.letters });
});

// ---- Billboards ----
function createBillboard(x, z, rotY) {
  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 3, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
  );
  post.position.set(x, 1.5, z);
  post.castShadow = true;
  scene.add(post);

  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 2),
    new THREE.MeshBasicMaterial({
      map: canvasTexture((ctx, w, h) => {
        ctx.fillStyle = "#f4b223";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#121212";
        ctx.font = "bold 28px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("YOUR AD HERE", w / 2, h / 2 - 10);
        ctx.font = "16px sans-serif";
        ctx.fillText("theyard.app/advertise", w / 2, h / 2 + 24);
      }),
    })
  );
  board.position.set(x, 3.2, z);
  board.rotation.y = rotY;
  scene.add(board);
}

interactionZones.push({ x: 0, z: 0, radius: 5, key: "king", label: "Homecoming Throne — Vote now" });
interactionZones.push({ x: 30, z: 18, radius: 3, key: "billboards", label: "Buy billboard ad space" });
interactionZones.push({ x: 7, z: -5, radius: 3, key: "community", label: "Check the community corkboard" });

createBillboard(-10, -22, 0);
createBillboard(10, -22, 0);
createBillboard(22, 6, -Math.PI / 2);

// ---- Spades / Dominoes table ----
const cardTable = new THREE.Group();
const tableTop = new THREE.Mesh(
  new THREE.CylinderGeometry(2.2, 2.2, 0.3, 24),
  new THREE.MeshStandardMaterial({
    map: canvasTexture((ctx, w, h) => {
      ctx.fillStyle = "#1a5f3c";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#f4b223";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#f4b223";
      ctx.font = "bold 30px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("♠", w / 2, h / 2 + 10);
    }),
  })
);
tableTop.position.y = 0.9;
tableTop.castShadow = true;
cardTable.add(tableTop);
const tableLeg = new THREE.Mesh(
  new THREE.CylinderGeometry(0.25, 0.3, 0.9, 10),
  new THREE.MeshStandardMaterial({ color: 0x3a2a1a })
);
tableLeg.position.y = 0.45;
cardTable.add(tableLeg);
cardTable.position.set(-18, 0, 16);
scene.add(cardTable);
interactionZones.push({ x: -18, z: 16, radius: 3.2, key: "cards", label: "Pull up to the Spades table" });

// ---- Step show stage ----
const stage = new THREE.Mesh(
  new THREE.CylinderGeometry(4.5, 4.8, 0.5, 32),
  new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
);
stage.position.set(18, 0.25, 16);
stage.castShadow = true;
stage.receiveShadow = true;
scene.add(stage);
const stageRing = new THREE.Mesh(
  new THREE.RingGeometry(4.6, 5, 32),
  new THREE.MeshBasicMaterial({ color: UAPB_GOLD, side: THREE.DoubleSide })
);
stageRing.rotation.x = -Math.PI / 2;
stageRing.position.set(18, 0.52, 16);
scene.add(stageRing);
interactionZones.push({ x: 18, z: 16, radius: 4.8, key: "stepshow", label: "Step on stage to rehearse" });

// ---- Dominoes bench ----
const domTable = new THREE.Mesh(
  new THREE.BoxGeometry(3.6, 0.3, 2.2),
  new THREE.MeshStandardMaterial({
    map: canvasTexture((ctx, w, h) => {
      ctx.fillStyle = "#2b2b2b";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#f4b223";
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(30 + i * 70, h / 2 - 18, 50, 36);
        ctx.fillStyle = "#2b2b2b";
        ctx.beginPath();
        ctx.arc(30 + i * 70 + 25, h / 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f4b223";
      }
      ctx.fillStyle = "#fff";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("DOMINOES", w / 2, h - 14);
    }),
  })
);
domTable.position.set(-18, 0.75, -16);
domTable.castShadow = true;
scene.add(domTable);
const domLeg = new THREE.Mesh(
  new THREE.CylinderGeometry(0.2, 0.25, 0.75, 8),
  new THREE.MeshStandardMaterial({ color: 0x3a2a1a })
);
domLeg.position.set(-18, 0.375, -16);
scene.add(domLeg);
interactionZones.push({ x: -18, z: -16, radius: 3, key: "dominoes", label: "Pull up to the dominoes" });

// ---- Pager / beeper booth ----
createBuilding({ x: 22, z: 22, w: 3, h: 3.6, d: 3, color: 0xd9272e, label: "Page Somebody" });
interactionZones.push({ x: 22, z: 22, radius: 3, key: "pager", label: "Check the pager" });

// ---- Cookout grill ----
const grillDrum = new THREE.Mesh(
  new THREE.CylinderGeometry(1.4, 1.2, 1.2, 16),
  new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
);
grillDrum.position.set(2, 0.9, 34);
grillDrum.castShadow = true;
scene.add(grillDrum);
const grillLid = new THREE.Mesh(
  new THREE.SphereGeometry(1.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
);
grillLid.position.set(2, 1.5, 34);
scene.add(grillLid);
const grillSign = new THREE.Mesh(
  new THREE.PlaneGeometry(2.4, 1),
  new THREE.MeshBasicMaterial({ map: labelTexture("Cookout Cook-Off", "#8a3b2b", "#fff"), transparent: true })
);
grillSign.position.set(2, 2.6, 34);
scene.add(grillSign);
interactionZones.push({ x: 2, z: 34, radius: 3, key: "cookout", label: "Work the grill" });

// ---- Throne / King & Queen voting spot ----
const throne = new THREE.Mesh(
  new THREE.CylinderGeometry(3, 3.4, 0.6, 32),
  new THREE.MeshStandardMaterial({ color: 0xf4b223, emissive: 0x7a5200, emissiveIntensity: 0.3 })
);
throne.position.set(0, 0.3, 0);
throne.castShadow = true;
scene.add(throne);

// ---- Vending machines ----
function createVendingMachine(x, z) {
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 2.4, 1),
    new THREE.MeshStandardMaterial({ color: 0xd9272e })
  );
  body.position.set(x, 1.2, z);
  body.castShadow = true;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1.4),
    new THREE.MeshBasicMaterial({
      map: canvasTexture((ctx, w, h) => {
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#f4b223";
        ctx.lineWidth = 6;
        for (let i = 0; i < 3; i++) ctx.strokeRect(10, 10 + i * 80, w - 20, 70);
        ctx.fillStyle = "#f4b223";
        ctx.font = "bold 22px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("SNACKS", w / 2, h - 10);
      }),
    })
  );
  screen.position.set(x, 1.5, z + 0.51);
  scene.add(body, screen);
  interactionZones.push({ x, z, radius: 2.5, key: "vending", label: "Get a snack" });
}
createVendingMachine(-66, -20); // Student Union
createVendingMachine(-96, 12); // Dorm block
createVendingMachine(-121, -142); // HPER

// ---- Seasonal: Halloween "Harvest Bash" decorations ----
function createPumpkin(x, z) {
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xe8701a })
  );
  body.scale.y = 0.8;
  body.position.set(x, 0.5, z);
  body.castShadow = true;
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.14, 0.35, 6),
    new THREE.MeshStandardMaterial({ color: 0x2f7a3a })
  );
  stem.position.set(x, 1.05, z);
  scene.add(body, stem);
}
if (isHalloween()) {
  const pumpkinSpots = [
    [4, 2], [-4, 2], [4, -2], [-4, -2],
    [-62, -24], [-58, -24], [-58, -19],
  ];
  pumpkinSpots.forEach(([x, z]) => createPumpkin(x, z));
  const banner = document.getElementById("announce-banner");
  if (banner) banner.innerHTML = '🎃 <b>@GoldenLion_23</b>: Harvest Bash is live — check the store for the Halloween drop';
}

// ---- Trees (scattered, avoiding the Bell Tower plaza and building footprints) ----
function createTree(x, z) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.3, 1.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x5a3c22 })
  );
  trunk.position.set(x, 0.8, z);
  trunk.castShadow = true;
  const leaves = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0x2f7a3a })
  );
  leaves.position.set(x, 2.2, z);
  leaves.castShadow = true;
  scene.add(trunk, leaves);
}
let placed = 0;
let attempts = 0;
while (placed < 70 && attempts < 400) {
  attempts++;
  const x = X_MIN + Math.random() * (X_MAX - X_MIN);
  const z = Z_MIN + Math.random() * (Z_MAX - Z_MIN);
  if (Math.hypot(x, z) < 22) continue;
  const tooClose = BUILDINGS.some((b) => Math.hypot(x - b.x, z - b.z) < 10);
  if (tooClose) continue;
  createTree(x, z);
  placed++;
}

// ---- Avatar ----
const avatar = new THREE.Group();
const torso = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.5, 1.0, 4, 8),
  new THREE.MeshStandardMaterial({ color: UAPB_GOLD })
);
torso.position.y = 1.1;
torso.castShadow = true;
const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.4, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0x8a5a3c })
);
head.position.y = 2.0;
head.castShadow = true;
avatar.add(torso, head);
avatar.position.set(0, 0, 10);
scene.add(avatar);

camera.position.copy(avatar.position).add(CAM_OFFSET);
camera.lookAt(avatar.position);

// ---- Input (keyboard + gamepad + touch) ----
const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

document.querySelectorAll(".touch-btn[data-key]").forEach((btn) => {
  const k = btn.dataset.key;
  const press = (e) => {
    e.preventDefault();
    keys[k] = true;
  };
  const release = (e) => {
    e.preventDefault();
    keys[k] = false;
  };
  btn.addEventListener("pointerdown", press);
  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointerleave", release);
  btn.addEventListener("pointercancel", release);
});
document.getElementById("touch-interact")?.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  tryInteract();
});

let gamepadIndex = null;
window.addEventListener("gamepadconnected", (e) => {
  gamepadIndex = e.gamepad.index;
  gamepadHintEl.style.display = "block";
  gamepadHintEl.textContent = `🎮 ${e.gamepad.id.slice(0, 28)} connected`;
  setTimeout(() => (gamepadHintEl.style.display = "none"), 2500);
});
window.addEventListener("gamepaddisconnected", () => {
  gamepadIndex = null;
});
const padButtonState = {};
function pollGamepad() {
  if (gamepadIndex === null) return { dx: 0, dz: 0, interact: false };
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads[gamepadIndex];
  if (!gp) return { dx: 0, dz: 0, interact: false };

  const DEAD = 0.2;
  let dx = Math.abs(gp.axes[0]) > DEAD ? gp.axes[0] : 0;
  let dz = Math.abs(gp.axes[1]) > DEAD ? gp.axes[1] : 0;
  const dpad = [
    gp.buttons[12]?.pressed, // up
    gp.buttons[13]?.pressed, // down
    gp.buttons[14]?.pressed, // left
    gp.buttons[15]?.pressed, // right
  ];
  if (dpad[0]) dz -= 1;
  if (dpad[1]) dz += 1;
  if (dpad[2]) dx -= 1;
  if (dpad[3]) dx += 1;

  const aPressed = !!gp.buttons[0]?.pressed;
  const interact = aPressed && !padButtonState.a;
  padButtonState.a = aPressed;

  // Mirror D-pad presses as arrow-key events so minigames (e.g. step show)
  // that already listen for keyboard arrows get gamepad input for free.
  const arrowKeys = ["arrowup", "arrowdown", "arrowleft", "arrowright"];
  dpad.forEach((pressed, i) => {
    const k = arrowKeys[i];
    if (pressed && !padButtonState[k]) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: k }));
    } else if (!pressed && padButtonState[k]) {
      window.dispatchEvent(new KeyboardEvent("keyup", { key: k }));
    }
    padButtonState[k] = pressed;
  });

  return { dx, dz, interact };
}

const promptEl = document.createElement("div");
promptEl.className = "interact-prompt";
app.appendChild(promptEl);

const gamepadHintEl = document.createElement("div");
gamepadHintEl.className = "gamepad-hint";
app.appendChild(gamepadHintEl);

let activeZone = null;
function modalIsOpen() {
  return modalRoot.children.length > 0;
}
function tryInteract() {
  if (activeZone && !modalIsOpen()) openModal(activeZone.key, activeZone.note);
}
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "e") tryInteract();
});

// ---- Modals ----
const modalContent = {
  billboards: {
    title: "📢 Billboard Ad Space",
    body: "Real Pine Bluff businesses, Greek chapters, and alumni associations can buy a billboard on the Yard. Your brand, seen by every Golden Lion walking campus.",
  },
  shopnote: {
    title: "🏪 Campus Spot",
    body: "This is a stand-in for the real spot on campus — OpenStreetMap doesn't have interior storefront data, so it's placed just outside the Student Union where the food court actually lives.",
  },
  rec: {
    title: "🏃 Rec & Sports",
    body: "Pull up for a pickup game. Real fields (tennis, football practice) are positioned from OpenStreetMap; soccer pitch and golf range are fun additions, not official UAPB facilities.",
  },
};

const modalRoot = document.getElementById("modal-root");
const MINIGAMES = {
  cards: mountCardGame,
  stepshow: mountStepShow,
  dominoes: mountDominoes,
  pager: mountPager,
  cookout: mountCookout,
  community: mountCommunity,
  leaderboard: mountLeaderboard,
  king: mountVoting,
  store: mountStore,
  parties: mountParties,
  vending: mountVending,
};

function closeModal() {
  modalRoot.innerHTML = "";
}

function openModal(key, zoneNote) {
  if (key === "plots") {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    modalRoot.innerHTML = "";
    modalRoot.appendChild(backdrop);
    mountPlotClaim(backdrop, { letters: zoneNote, onClose: closeModal });
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });
    return;
  }

  if (key === "auth") {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    modalRoot.innerHTML = "";
    modalRoot.appendChild(backdrop);
    mountAuthModal(backdrop, { onClose: closeModal });
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });
    return;
  }

  if (MINIGAMES[key]) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    modalRoot.innerHTML = "";
    modalRoot.appendChild(backdrop);
    MINIGAMES[key](backdrop, { onClose: closeModal });
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });
    return;
  }

  const c = modalContent[key];
  if (!c) return;
  const body = zoneNote ? `<b>${zoneNote}</b><br/>${c.body}` : c.body;
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <h3>${c.title}</h3>
        <p>${body}</p>
        <button class="btn btn-primary close">Close</button>
      </div>
    </div>`;
  modalRoot.querySelector(".close").addEventListener("click", closeModal);
  modalRoot.querySelector(".modal-backdrop").addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-backdrop")) closeModal();
  });
}
document.querySelectorAll("[data-modal]").forEach((el) => {
  el.addEventListener("click", () => openModal(el.dataset.modal));
});

// ---- Auth + multiplayer wiring ----
const playerCountEl = document.getElementById("player-count-label");
const peerMeshes = new Map(); // key -> { group, label }
let peers = new Map();
let authUser = null;

function updatePlayerCountLabel() {
  if (!ONLINE) return;
  const count = peers.size + (authUser ? 1 : 0);
  playerCountEl.innerHTML = `<b>${count}</b> Golden Lion${count === 1 ? "" : "s"} on the Yard · free`;
}

onAuthChange(async (state) => {
  authUser = state.user;
  if (!ONLINE) return;
  if (state.user) {
    await joinPresence(state.user.id, state.profile);
    setMyIdentity(state.profile?.display_name || "Golden Lion", state.profile?.color || "#f4b223");
    watchWallet(state.user.id);
  } else {
    leavePresence();
    stopWatchingWallet();
  }
  updatePlayerCountLabel();
});

const walletBadgeEl = document.getElementById("wallet-badge");
onBalanceChange((balance) => {
  if (!ONLINE || !authUser) {
    walletBadgeEl.classList.add("hidden");
    return;
  }
  walletBadgeEl.classList.remove("hidden");
  walletBadgeEl.textContent = `🪙 ${balance}`;
});

onPeersChange((updated) => {
  peers = updated;
  updatePlayerCountLabel();
  const seen = new Set();
  peers.forEach((p, key) => {
    seen.add(key);
    let entry = peerMeshes.get(key);
    if (!entry) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.5, 1.0, 4, 8),
        new THREE.MeshStandardMaterial({ color: p.color ? parseInt(p.color.replace("#", ""), 16) : UAPB_GOLD })
      );
      body.position.y = 1.1;
      body.castShadow = true;
      const h = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0x8a5a3c })
      );
      h.position.y = 2.0;
      group.add(body, h);
      scene.add(group);
      const label = document.createElement("div");
      label.className = "peer-tag";
      label.textContent = p.name || "Golden Lion";
      app.appendChild(label);
      entry = { group, label };
      peerMeshes.set(key, entry);
    }
    if (typeof p.x === "number") entry.group.position.set(p.x, 0, p.z);
    if (typeof p.rotY === "number") entry.group.rotation.y = p.rotY;
    entry.label.textContent = p.name || "Golden Lion";
  });
  for (const [key, entry] of peerMeshes) {
    if (!seen.has(key)) {
      scene.remove(entry.group);
      entry.label.remove();
      peerMeshes.delete(key);
    }
  }
});

function updatePeerLabels() {
  peerMeshes.forEach((entry) => {
    const pos = entry.group.position.clone();
    pos.y += 2.6;
    pos.project(camera);
    const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;
    entry.label.style.transform = `translate(-50%, -100%)`;
    entry.label.style.left = x + "px";
    entry.label.style.top = y + "px";
    entry.label.style.display = pos.z < 1 ? "block" : "none";
  });
}

// ---- Live party markers ----
const partyMarkers = new Map(); // party id -> THREE.Group

function createPartyMarker(spotKey) {
  const spot = PARTY_SPOTS[spotKey] || PARTY_SPOTS.bell_tower_yard;
  const group = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4, 0.1, 24),
    new THREE.MeshStandardMaterial({ color: 0x8a2be2, emissive: 0x4a0e8a, emissiveIntensity: 0.6, transparent: true, opacity: 0.6 })
  );
  floor.position.y = 0.05;
  const booth = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.4, 1),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
  );
  booth.position.set(0, 0.7, -3.5);
  const light = new THREE.PointLight(0xff3bd4, 3, 14);
  light.position.set(0, 3, 0);
  group.add(floor, booth, light);
  group.position.set(spot.x, 0, spot.z);
  scene.add(group);
  return group;
}

async function syncLiveParties() {
  if (!ONLINE) return;
  const nowIso = new Date().toISOString();
  const { data } = await supabase.from("party_tallies").select("*").lte("starts_at", nowIso).gte("ends_at", nowIso);
  const live = data || [];
  const liveIds = new Set(live.map((p) => p.id));

  for (const [id, group] of partyMarkers) {
    if (!liveIds.has(id)) {
      scene.remove(group);
      partyMarkers.delete(id);
      for (let i = interactionZones.length - 1; i >= 0; i--) {
        if (interactionZones[i].partyId === id) interactionZones.splice(i, 1);
      }
    }
  }

  live.forEach((p) => {
    if (partyMarkers.has(p.id)) return;
    const group = createPartyMarker(p.spot);
    partyMarkers.set(p.id, group);
    const spot = PARTY_SPOTS[p.spot] || PARTY_SPOTS.bell_tower_yard;
    interactionZones.push({ x: spot.x, z: spot.z, radius: 5, key: "parties", label: `${p.title} — RSVP / join in`, partyId: p.id });
  });
}

if (ONLINE) {
  syncLiveParties();
  setInterval(syncLiveParties, 20000);
  supabase
    .channel("party-markers")
    .on("postgres_changes", { event: "*", schema: "public", table: "parties" }, syncLiveParties)
    .subscribe();
}

// ---- Loop ----
const clock = new THREE.Clock();
const SPEED = 16;

function updateAvatar(dt) {
  if (modalIsOpen()) return;
  let dx = 0,
    dz = 0;
  if (keys["w"] || keys["arrowup"]) dz -= 1;
  if (keys["s"] || keys["arrowdown"]) dz += 1;
  if (keys["a"] || keys["arrowleft"]) dx -= 1;
  if (keys["d"] || keys["arrowright"]) dx += 1;

  const pad = pollGamepad();
  if (pad.interact) tryInteract();
  dx += pad.dx;
  dz += pad.dz;

  if (dx !== 0 || dz !== 0) {
    const len = Math.max(1, Math.hypot(dx, dz));
    dx /= len;
    dz /= len;
    avatar.position.x = THREE.MathUtils.clamp(avatar.position.x + dx * SPEED * dt, X_MIN, X_MAX);
    avatar.position.z = THREE.MathUtils.clamp(avatar.position.z + dz * SPEED * dt, Z_MIN, Z_MAX);
    const targetAngle = Math.atan2(dx, dz);
    avatar.rotation.y = THREE.MathUtils.lerp(avatar.rotation.y, targetAngle, 0.2);
  }

  const desiredCamPos = avatar.position.clone().add(CAM_OFFSET);
  camera.position.lerp(desiredCamPos, 0.08);
  camera.lookAt(avatar.position.x, avatar.position.y + 1, avatar.position.z);

  updateMyPosition(avatar.position.x, avatar.position.z, avatar.rotation.y);
}

function updateInteractionPrompt() {
  activeZone = null;
  for (const zone of interactionZones) {
    const dist = Math.hypot(avatar.position.x - zone.x, avatar.position.z - zone.z);
    if (dist < zone.radius) {
      activeZone = zone;
      break;
    }
  }
  if (activeZone) {
    promptEl.style.display = "block";
    const btn = gamepadIndex !== null ? "A" : "E";
    promptEl.textContent = `Press ${btn} — ${activeZone.label}`;
  } else {
    promptEl.style.display = "none";
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  updateAvatar(dt);
  updateInteractionPrompt();
  updatePeerLabels();
  updateWeatherParticles(dt);
  renderer.render(scene, camera);
}
animate();
