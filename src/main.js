import * as THREE from "three";
import "./style.css";
import { createCharacter, loadLook, disposeCharacter } from './avatar.js';
import { mountCharacterEditor } from './characterEditor.js';
import { createCollisionWorld, collidersFromMeshes, sweptVehicleContact } from './worldPhysics.js';
import { createInterior, interiorType } from './interiors.js';
import { createCampusNavigation } from './mapNavigation.js';
import { mountExperience } from './experience.js';
import { createCameraController } from './cameraController.js';
import { createInputController } from './inputController.js';
import { createInteractionTarget } from './interactionTarget.js';
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
import { isHalloween, isPrettyWednesday } from "./seasonal.js";
import { mountParties } from "./minigames/parties.js";
import { mountVending } from "./minigames/vending.js";
import { mountChat } from "./minigames/chat.js";
import { mountLionsDen } from "./minigames/lionsden.js";
import { mountModQueue } from "./minigames/modqueue.js";
import { mountGuidelines } from "./minigames/guidelines.js";
import { startWeatherLoop, onWeatherChange, setWeatherLocation } from "./weather.js";
import { getActiveCampus } from "./campuses.js";
import { createFootprintBuilding, createBellTower, createAcademicHall, createModernHall, createDormHall, createStadiumComplex, createStudentUnion, createLibrary, createGymComplex, createFineArtsCenter, createSTEMBuilding, createCaldwellHall } from "./buildings.js";
import { createMappedRoadNetwork, createMappedTraffic } from "./traffic.js";
import { createPedestrians } from "./pedestrians.js";
import { createMarchingBand } from "./band.js";
import { mountBand } from "./minigames/band.js";
import { createPhotoBoothArch } from "./photobooth.js";
import { mountPhotoBooth } from "./minigames/photobooth.js";
import { mountDoubleDutch } from "./minigames/doubledutch.js";
import { mountHopscotch } from "./minigames/hopscotch.js";
import { mountBoombox } from "./minigames/boombox.js";
import { isBoomboxPlaying, stopBoombox } from "./sound.js";
import { initMinimap } from "./minimap.js";
import { playOpen, playClose, playClick, isMuted, toggleMuted } from "./sound.js";
import { mountAchievements } from "./minigames/achievements.js";
import { mountOnboarding } from "./minigames/onboarding.js";
import { unlockAchievement } from "./achievements.js";
import { mountAuthModal } from "./authModal.js";
import { onAuthChange } from "./auth.js";
import { db, ONLINE } from "./firebase.js";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { joinPresence, leavePresence, updateMyPosition, setMyIdentity, onPeersChange } from "./multiplayer.js";
import { watchWallet, stopWatchingWallet, onBalanceChange } from "./economy.js";

// ---- Active campus (switchable via the 🏫 Campus chip; see src/campuses.js) ----
const ACTIVE_CAMPUS = getActiveCampus();
const CAMPUS_META = ACTIVE_CAMPUS.meta;
const { BUILDINGS, REAL_RECREATION, RETAIL_NEAR_UNION, FICTIONAL_RECREATION, VENDING_SPOTS, PARTY_SPOTS, MAP_ROADS = [], ACTIVITY_SPOTS = {} } = ACTIVE_CAMPUS.data;
function activity(key, x, z) {
  const spot = ACTIVITY_SPOTS[key];
  return spot ? { x: spot.x, z: spot.z } : { x, z };
}

document.title = `The Yard: ${CAMPUS_META.label} Homecoming`;
const brandTextEl = document.getElementById("brand-text");
if (brandTextEl) brandTextEl.textContent = `The Yard — ${CAMPUS_META.shortName}`;
const voteChipEl = document.getElementById("vote-chip");
if (voteChipEl) voteChipEl.textContent = `Vote Mr./Miss ${CAMPUS_META.shortName}`;
const weatherBadgeElEarly = document.getElementById("weather-badge");
if (weatherBadgeElEarly) weatherBadgeElEarly.title = `Live weather · ${CAMPUS_META.location}`;

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
const view = createCameraController();
let enteredYard = false;
let currentRoom = null, roomBuilding = null, exteriorPosition = null, exteriorCamera = null;
let hitTime = 0, impactCooldown = 0, impactX = 0, impactZ = 0;
function activeScene() { return currentRoom?.scene || scene; }
const desiredCamPos = new THREE.Vector3();
const camFrom = new THREE.Vector3();
const camRay = new THREE.Raycaster();
const camDir = new THREE.Vector3();
function changeZoom(delta) { view.zoomBy(delta); }
function resetCamera() { view.reset(); }
function cameraOffset() { const o = view.offsetFor(Boolean(currentRoom)); return { x: o.x, y: o.y, z: o.z }; }
function raycastCamera(from, direction, distance) {
  camFrom.set(from.x, from.y, from.z);
  camDir.set(direction.x, direction.y, direction.z);
  camRay.set(camFrom, camDir);
  camRay.far = distance;
  const hits = camRay.intersectObjects(activeScene().children, true);
  for (const hit of hits) {
    if (hit.object.isMesh && !avatar.getObjectById(hit.object.id) && !hit.object.userData.noCollision) return hit.distance;
  }
  return null;
}

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
  hemi.intensity = (on ? 0.65 : 1.4) * dim;
  sun.intensity = (on ? 0.35 : 1.8) * dim;
  nightToggleEl.textContent = on ? "Day" : "Night";
  nightToggleEl.classList.toggle("chip-active", on);
}
const nightToggleEl = document.getElementById("night-toggle");
nightToggleEl.addEventListener("click", () => {
  setNightMode(!nightMode, { manual: true });
  unlockAchievement("night_owl");
});

const soundToggleEl = document.getElementById("sound-toggle");
function refreshSoundChip() {
  const muted = isMuted();
  soundToggleEl.textContent = muted ? "Sound off" : "Sound on";
  soundToggleEl.classList.toggle("chip-active", !muted);
}
soundToggleEl.addEventListener("click", () => {
  toggleMuted();
  refreshSoundChip();
  playClick();
});
refreshSoundChip();

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
setWeatherLocation(CAMPUS_META.lat, CAMPUS_META.lon);
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

// ---- Ground (sized to cover the real, OSM-derived campus footprint —
// computed per campus from its actual building/field spread, so a new
// campus with a different real-world layout just works) ----
const MARGIN = 80;
const allPoints = [
  ...BUILDINGS,
  ...REAL_RECREATION,
  ...FICTIONAL_RECREATION,
  ...RETAIL_NEAR_UNION,
  { x: 0, z: 0 }, // the Yard hub itself
];
const xs = allPoints.map((p) => p.x);
const zs = allPoints.map((p) => p.z);
const GROUND_W = Math.max(400, Math.max(...xs) - Math.min(...xs) + MARGIN * 2);
const GROUND_D = Math.max(400, Math.max(...zs) - Math.min(...zs) + MARGIN * 2);
const GROUND_CX = (Math.max(...xs) + Math.min(...xs)) / 2;
const GROUND_CZ = (Math.max(...zs) + Math.min(...zs)) / 2;
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

// Real campus buildings, positioned from OpenStreetMap data (see
// src/campusData.*.js). Buildings tagged `special` get a researched,
// detailed model (src/buildings.js); everything else gets a generic
// treatment based on `kind` — this makes the whole thing campus-agnostic,
// so a new campus just needs data, not new dispatch logic.
BUILDINGS.forEach((b) => {
  if (b.footprint && !b.special) { createFootprintBuilding(scene, b); return; }
  if (b.special === "bell_tower") {
    createBellTower(scene, b.x, b.z);
    return;
  }
  if (b.special === "stadium") {
    createStadiumComplex(scene, b.x, b.z);
    return;
  }
  if (b.special === "union_cantilever") {
    createStudentUnion(scene, { x: b.x, z: b.z, w: b.w, h: b.h, d: b.d, label: b.name });
    return;
  }
  if (b.special === "library") {
    createLibrary(scene, { x: b.x, z: b.z, w: b.w, h: b.h, d: b.d, label: b.name });
    return;
  }
  if (b.special === "columns") {
    createModernHall(scene, { x: b.x, z: b.z, w: b.w, h: b.h, d: b.d, label: b.name, color: b.color, columns: true });
    return;
  }
  if (b.special === "hper") {
    createGymComplex(scene, { x: b.x, z: b.z, w: b.w, h: b.h, d: b.d, label: b.name, color: b.color });
    return;
  }
  if (b.special === "fine_arts") {
    createFineArtsCenter(scene, { x: b.x, z: b.z, w: b.w, h: b.h, d: b.d, label: b.name, color: b.color });
    return;
  }
  if (b.special === "stem") {
    createSTEMBuilding(scene, { x: b.x, z: b.z, w: b.w, h: b.h, d: b.d, label: b.name, color: b.color });
    return;
  }
  if (b.special === "caldwell") {
    createCaldwellHall(scene, { x: b.x, z: b.z, w: b.w, h: b.h, d: b.d, label: b.name });
    return;
  }
  if (b.kind === "student_life" || b.kind === "arts" || b.kind === "athletics" || b.kind === "admin") {
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

const minimap = initMinimap(document.getElementById("minimap"), { xMin: X_MIN, xMax: X_MAX, zMin: Z_MIN, zMax: Z_MAX, buildings: BUILDINGS, roads: MAP_ROADS });

// Render the pinned OpenStreetMap centerlines, not the old fictional loop.
const roadSurfaces = createMappedRoadNetwork(scene, MAP_ROADS);
const traffic = createMappedTraffic(scene, MAP_ROADS);

// Ambient NPC students strolling the campus hubs — purely decorative.
const pedestrians = createPedestrians(scene, PARTY_SPOTS, 2);

// Retail/dining kiosks near the Student Union (OSM has no interior POI data
// for these, so they're placed just outside the real union building)
RETAIL_NEAR_UNION.forEach((r) => {
  createBuilding({ x: r.x, z: r.z, w: 4, h: 3, d: 4, color: parseInt(r.color.slice(1), 16), label: `${r.icon} ${r.name}` });
});

const interactionZones = [];

// M4 — the Marching Musical Machine of the Mid-South — runs drill on the
// stadium approach. Only UAPB has a stadium special-tagged, so this is
// UAPB-only until another campus gets its own band treatment.
let band = null;
const stadiumBuilding = BUILDINGS.find((b) => b.special === "stadium");
if (stadiumBuilding) {
  const bx = stadiumBuilding.x;
  const bz = stadiumBuilding.z + 30;
  band = createMarchingBand(scene, bx, bz);
  interactionZones.push({ x: bx, z: bz + 2, radius: 8, key: "band", label: "Cheer for M4" });
}

// Homecoming photo-op arch near the Bell Tower plaza.
const photoSpot = activity("photobooth", -6, 8);
createPhotoBoothArch(scene, photoSpot.x, photoSpot.z, CAMPUS_META.shortName);
interactionZones.push({ x: photoSpot.x, z: photoSpot.z, radius: 3, key: "photobooth", label: "Take a photo" });

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

const kingSpot = activity("king", 0, 12);
const boardSpot = activity("billboards", 12, 8);
const corkSpot = activity("community", 8, -8);
interactionZones.push({ x: kingSpot.x, z: kingSpot.z, radius: 5, key: "king", label: "Homecoming Throne - Vote now" });
interactionZones.push({ x: boardSpot.x, z: boardSpot.z, radius: 3, key: "billboards", label: "Buy billboard ad space" });
interactionZones.push({ x: corkSpot.x, z: corkSpot.z, radius: 3, key: "community", label: "Check the community corkboard" });

createBillboard(boardSpot.x - 6, boardSpot.z, 0);
createBillboard(boardSpot.x + 6, boardSpot.z, 0);
createBillboard(boardSpot.x, boardSpot.z + 8, -Math.PI / 2);

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
const cardsSpot = activity("cards", 5, 5);
cardTable.position.set(cardsSpot.x, 0, cardsSpot.z);
scene.add(cardTable);
interactionZones.push({ x: cardsSpot.x, z: cardsSpot.z, radius: 3.2, key: "cards", label: "Pull up to the Spades table" });

// ---- Step show stage ----
const stage = new THREE.Mesh(
  new THREE.CylinderGeometry(4.5, 4.8, 0.5, 32),
  new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
);
const stepSpot = activity("stepshow", 5, -5);
stage.position.set(stepSpot.x, 0.25, stepSpot.z);
stage.castShadow = true;
stage.receiveShadow = true;
scene.add(stage);
const stageRing = new THREE.Mesh(
  new THREE.RingGeometry(4.6, 5, 32),
  new THREE.MeshBasicMaterial({ color: UAPB_GOLD, side: THREE.DoubleSide })
);
stageRing.rotation.x = -Math.PI / 2;
stageRing.position.set(stepSpot.x, 0.52, stepSpot.z);
scene.add(stageRing);
interactionZones.push({ x: stepSpot.x, z: stepSpot.z, radius: 4.8, key: "stepshow", label: "Step on stage to rehearse" });

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
const domSpot = activity("dominoes", -5, 5);
domTable.position.set(domSpot.x, 0.75, domSpot.z);
domTable.castShadow = true;
scene.add(domTable);
const domLeg = new THREE.Mesh(
  new THREE.CylinderGeometry(0.2, 0.25, 0.75, 8),
  new THREE.MeshStandardMaterial({ color: 0x3a2a1a })
);
domLeg.position.set(domSpot.x, 0.375, domSpot.z);
scene.add(domLeg);
interactionZones.push({ x: domSpot.x, z: domSpot.z, radius: 3, key: "dominoes", label: "Pull up to the dominoes" });

// ---- Double Dutch ropes — the classic block/sidewalk game ----
const { x: DD_X, z: DD_Z } = activity("doubledutch", -5, -5);
[-1.8, 1.8].forEach((ox) => {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 1.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a2a1a })
  );
  pole.position.set(DD_X + ox, 0.8, DD_Z);
  pole.castShadow = true;
  scene.add(pole);
});
const ddSign = new THREE.Mesh(
  new THREE.PlaneGeometry(2.8, 0.7),
  new THREE.MeshStandardMaterial({
    map: canvasTexture((ctx, w, h) => {
      ctx.fillStyle = "#121212";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#f4b223";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🪢 DOUBLE DUTCH", w / 2, h / 2 + 8);
    }, 320, 100),
  })
);
ddSign.position.set(DD_X, 1.9, DD_Z);
scene.add(ddSign);
interactionZones.push({ x: DD_X, z: DD_Z, radius: 3, key: "doubledutch", label: "Jump in on Double Dutch" });

// ---- Hopscotch grid — chalk on the sidewalk ----
const { x: HS_X, z: HS_Z } = activity("hopscotch", -10, 0);
const hopscotchGrid = new THREE.Mesh(
  new THREE.PlaneGeometry(2.4, 3.6),
  new THREE.MeshStandardMaterial({
    map: canvasTexture((ctx, w, h) => {
      ctx.fillStyle = "#5a4a3a";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#e8e2d0";
      ctx.lineWidth = 4;
      const rows = [[1], [2, 3], [4], [5, 6], [7], [8]];
      const rowH = h / rows.length;
      let n = 1;
      rows.forEach((row, r) => {
        const y = r * rowH;
        if (row.length === 1) {
          ctx.strokeRect(w * 0.25, y, w * 0.5, rowH);
          ctx.fillStyle = "#e8e2d0";
          ctx.font = "bold 28px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(String(n), w / 2, y + rowH * 0.65);
          n++;
        } else {
          ctx.strokeRect(0, y, w / 2, rowH);
          ctx.strokeRect(w / 2, y, w / 2, rowH);
          ctx.fillStyle = "#e8e2d0";
          ctx.font = "bold 28px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(String(n), w / 4, y + rowH * 0.65);
          ctx.fillText(String(n + 1), (w * 3) / 4, y + rowH * 0.65);
          n += 2;
        }
      });
    }, 192, 288),
  })
);
hopscotchGrid.rotation.x = -Math.PI / 2;
hopscotchGrid.position.set(HS_X, 0.02, HS_Z);
hopscotchGrid.receiveShadow = true;
scene.add(hopscotchGrid);
interactionZones.push({ x: HS_X, z: HS_Z, radius: 3, key: "hopscotch", label: "Play Hopscotch" });

// ---- Boombox — bring your own block party ----
const { x: BB_X, z: BB_Z } = activity("boombox", 0, 10);
const boomboxBody = new THREE.Mesh(
  new THREE.BoxGeometry(1.4, 0.7, 0.5),
  new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
);
boomboxBody.position.set(BB_X, 0.5, BB_Z);
boomboxBody.castShadow = true;
scene.add(boomboxBody);
[-0.45, 0.45].forEach((ox) => {
  const speaker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.08, 16),
    new THREE.MeshStandardMaterial({ color: 0x3a3a3a })
  );
  speaker.rotation.x = Math.PI / 2;
  speaker.position.set(BB_X + ox, 0.5, BB_Z + 0.26);
  scene.add(speaker);
});
const boomboxHandle = new THREE.Mesh(
  new THREE.TorusGeometry(0.35, 0.04, 8, 16, Math.PI),
  new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
);
boomboxHandle.position.set(BB_X, 0.9, BB_Z);
boomboxHandle.rotation.x = Math.PI;
scene.add(boomboxHandle);
const BOOMBOX_RANGE = 20;
interactionZones.push({ x: BB_X, z: BB_Z, radius: 3, key: "boombox", label: "Turn on the boombox" });

// ---- Pager / beeper booth ----
const pagerSpot = activity("pager", 10, 5);
createBuilding({ x: pagerSpot.x, z: pagerSpot.z, w: 3, h: 3.6, d: 3, color: 0xd9272e, label: "Page Somebody" });
interactionZones.push({ x: pagerSpot.x, z: pagerSpot.z, radius: 3, key: "pager", label: "Check the pager" });

// ---- Cookout grill ----
const grillDrum = new THREE.Mesh(
  new THREE.CylinderGeometry(1.4, 1.2, 1.2, 16),
  new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
);
const cookSpot = activity("cookout", -45, -10);
grillDrum.position.set(cookSpot.x, 0.9, cookSpot.z);
grillDrum.castShadow = true;
scene.add(grillDrum);
const grillLid = new THREE.Mesh(
  new THREE.SphereGeometry(1.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
);
grillLid.position.set(cookSpot.x, 1.5, cookSpot.z);
scene.add(grillLid);
const grillSign = new THREE.Mesh(
  new THREE.PlaneGeometry(2.4, 1),
  new THREE.MeshBasicMaterial({ map: labelTexture("Cookout Cook-Off", "#8a3b2b", "#fff"), transparent: true })
);
grillSign.position.set(cookSpot.x, 2.6, cookSpot.z);
scene.add(grillSign);
interactionZones.push({ x: cookSpot.x, z: cookSpot.z, radius: 3, key: "cookout", label: "Work the grill" });

// ---- Throne / King & Queen voting spot ----
const throne = new THREE.Mesh(
  new THREE.CylinderGeometry(3, 3.4, 0.6, 32),
  new THREE.MeshStandardMaterial({ color: 0xf4b223, emissive: 0x7a5200, emissiveIntensity: 0.3 })
);
throne.position.set(kingSpot.x, 0.3, kingSpot.z);
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
VENDING_SPOTS.forEach(([x, z]) => createVendingMachine(x, z));

// ---- The Lions Den — campus hangout spot, hosts Pretty Wednesday.
// UAPB-only (it's a Golden Lions thing) until another campus gets its own. ----
const PRETTY_WEDNESDAY = isPrettyWednesday();
if (CAMPUS_META.mascot === "Golden Lions") {
  const DEN_X = -45,
    DEN_Z = -5;
  createBuilding({
    x: DEN_X,
    z: DEN_Z,
    w: 6,
    h: 3.2,
    d: 5,
    color: PRETTY_WEDNESDAY ? 0xf4b223 : 0x1a1a1a,
    label: PRETTY_WEDNESDAY ? "✨ Lions Den ✨" : "Lions Den",
  });
  interactionZones.push({
    x: DEN_X,
    z: DEN_Z + 3,
    radius: 4,
    key: "lionsden",
    label: PRETTY_WEDNESDAY ? "✨ Pretty Wednesday at the Lions Den" : "Pull up to the Lions Den",
  });
}

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
  if (banner) banner.innerHTML = '🎃 <b>The Yard</b>: Harvest Bash is live — check the store for the Halloween drop';
} else if (PRETTY_WEDNESDAY && CAMPUS_META.mascot === "Golden Lions") {
  const banner = document.getElementById("announce-banner");
  if (banner) banner.innerHTML = '✨ <b>The Yard</b>: It\'s Pretty Wednesday — pull up to the Lions Den looking right';
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
  const tooClose = BUILDINGS.some(b => Math.abs(x - b.x) < b.w / 2 + 3 && Math.abs(z - b.z) < b.d / 2 + 3) || MAP_ROADS.some(road => road.points.some((b,i) => {
    if (!i) return false; const a=road.points[i-1],dx=b.x-a.x,dz=b.z-a.z;
    const t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz || 1),0,1);
    return Math.hypot(x-a.x-dx*t,z-a.z-dz*t)<4;
  }));
  if (tooClose) continue;
  createTree(x, z);
  placed++;
}

// Physical obstacles use the rendered meshes, including props and trees.
const movingRoots = new Set([...traffic.cars.map(c => c.mesh), ...pedestrians.npcs.map(n => n.mesh), ...(band?.members || [])]);
const world = createCollisionWorld(collidersFromMeshes(scene.children.filter(n => !movingRoots.has(n))));
const campusBounds = { xMin: X_MIN, xMax: X_MAX, zMin: Z_MIN, zMax: Z_MAX };
traffic.setWorld(world);
pedestrians.setWorld(world, campusBounds);
const spawnPoint = world.nearestClear({ x: 0, z: 10 });
for (const building of BUILDINGS) {
  building.enterable = Boolean(interiorType(building));
  building.entrance = world.nearestClear({ x: building.x, z: building.z + building.d / 2 + 2 });
  if (building.enterable && building.entrance) {
    const marker = new THREE.Mesh(new THREE.TorusGeometry(.65, .07, 6, 24), new THREE.MeshBasicMaterial({ color: '#f4b223' }));
    marker.rotation.x = Math.PI / 2; marker.position.set(building.entrance.x, .12, building.entrance.z); scene.add(marker);
    interactionZones.push({ ...building.entrance, radius: 2.6, key: 'enter-building', label: `Enter ${building.name}`, building });
  }
}
const statusEl = document.createElement('div'); statusEl.className = 'world-status hidden'; statusEl.setAttribute('role', 'status'); app.append(statusEl);
let statusTimer;
function announceWorld(text) { statusEl.textContent = text; statusEl.classList.remove('hidden'); clearTimeout(statusTimer); statusTimer = setTimeout(() => statusEl.classList.add('hidden'), 5000); }
const roomBar = document.createElement('div'); roomBar.className = 'room-bar hidden'; roomBar.innerHTML = '<div><strong></strong><small></small></div><button class="btn btn-secondary">Exit building</button>'; app.append(roomBar);
roomBar.querySelector('button').onclick = () => exitBuilding();

// ---- Avatar ----
let currentLook = loadLook();
let avatar = createCharacter(currentLook);
let torso = avatar.userData.torso;
function applyLook(look) {
  currentLook = look;
  const next = createCharacter(look);
  next.position.copy(avatar.position); next.rotation.copy(avatar.rotation);
  activeScene().remove(avatar); disposeCharacter(avatar); avatar = next; torso = avatar.userData.torso; activeScene().add(avatar);
}
avatar.position.set(spawnPoint.x, 0, spawnPoint.z);
scene.add(avatar);

{
  const start = view.offsetFor(false);
  camera.position.set(avatar.position.x + start.x, avatar.position.y + start.y, avatar.position.z + start.z);
}
camera.lookAt(avatar.position);

const navigation = createCampusNavigation({ scene, world, bounds: campusBounds, roads: MAP_ROADS, buildings: BUILDINGS, getPosition: () => exteriorPosition || avatar.position, onClose: () => closeModal() });
function enterBuilding(building, level = 0) {
  if (!interiorType(building)) return;
  clearInput();
  if (!currentRoom) { exteriorPosition = avatar.position.clone(); exteriorCamera = { zoom: view.zoom, yaw: view.yaw }; scene.remove(avatar); }
  else { currentRoom.scene.remove(avatar); currentRoom.dispose(); }
  currentRoom = createInterior(building, level); roomBuilding = building;
  avatar.position.set(currentRoom.spawn.x, 0, currentRoom.spawn.z); avatar.rotation.set(0, Math.PI, 0); currentRoom.scene.add(avatar);
  view.yaw = 0; view.zoom = 1.1; view.damp(10); hitTime = 0;
  const indoor = view.offsetFor(true);
  camera.position.set(avatar.position.x + indoor.x, avatar.position.y + indoor.y, avatar.position.z + indoor.z); camera.lookAt(avatar.position.x, 1.3, avatar.position.z);
  roomBar.querySelector('strong').textContent = currentRoom.label; roomBar.querySelector('small').textContent = currentRoom.confidence;
  roomBar.classList.remove('hidden'); app.classList.add('indoors');
}
function exitBuilding() {
  if (!currentRoom) return;
  clearInput(); currentRoom.scene.remove(avatar); currentRoom.dispose(); currentRoom = null; roomBuilding = null;
  scene.add(avatar); avatar.position.copy(exteriorPosition); exteriorPosition = null;
  view.zoom = exteriorCamera.zoom; view.yaw = exteriorCamera.yaw; view.damp(10); impactCooldown = 1.5;
  const outdoor = view.offsetFor(false);
  camera.position.set(avatar.position.x + outdoor.x, avatar.position.y + outdoor.y, avatar.position.z + outdoor.z);
  roomBar.classList.add('hidden'); app.classList.remove('indoors');
}
function recoverPosition() {
  if (currentRoom) exitBuilding();
  avatar.position.set(spawnPoint.x, 0, spawnPoint.z); avatar.rotation.z = 0; hitTime = 0; impactCooldown = 2;
  clearInput(); navigation.cancel(); resetCamera(); announceWorld('Returned to the Bell Tower plaza.');
}

// ---- Input (keyboard + gamepad + touch) ----
const input = createInputController({
  isBlocked: () => !enteredYard || modalIsOpen(),
  onZoom: changeZoom,
  onRotate: amount => view.rotate(amount),
  onReset: resetCamera,
  onInteract: () => tryInteract(),
});
function clearInput() { input.clear(); }
window.addEventListener('gamepadconnected', e => {
  gamepadHintEl.style.display = 'block';
  gamepadHintEl.textContent = `Controller connected: ${e.gamepad.id.slice(0, 28)}`;
  setTimeout(() => (gamepadHintEl.style.display = 'none'), 2500);
});
renderer.domElement.addEventListener('wheel', e => {
  if (!enteredYard || modalIsOpen()) return;
  e.preventDefault(); changeZoom(Math.sign(e.deltaY) * .08);
}, { passive: false });
mountExperience({ online: ONLINE,
  onEnter: () => { enteredYard = true; },
  onCustomize: () => openModal('character'),
  onNavigate: () => { if (currentRoom) announceWorld('Exit the building to plan a campus route.'); else openModal('destinations'); },
  onRecover: recoverPosition,
  onZoom: changeZoom, onRotate: amount => { view.rotate(amount); }, onReset: resetCamera,
  onMove: (x, z) => input.setStick(x, z)
});
document.querySelectorAll('.touch-btn[data-key]').forEach(btn => {
  const k = btn.dataset.key;
  const press = e => { e.preventDefault(); input.setKey(k, true); };
  const release = e => { e.preventDefault(); input.setKey(k, false); };
  btn.addEventListener('pointerdown', press);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointerleave', release);
  btn.addEventListener('pointercancel', release);
});
document.getElementById('touch-interact')?.addEventListener('pointerdown', e => {
  e.preventDefault();
  tryInteract();
});

const promptEl = document.createElement("div");
promptEl.className = "interact-prompt";
app.appendChild(promptEl);

const gamepadHintEl = document.createElement("div");
gamepadHintEl.className = "gamepad-hint";
app.appendChild(gamepadHintEl);

let activeZone = null;
const interactionTarget = createInteractionTarget();
function modalIsOpen() {
  return modalRoot.children.length > 0;
}
function tryInteract() {
  if (!enteredYard || !activeZone || modalIsOpen() || hitTime > 0) return;
  if (activeZone.key === 'enter-building') { enterBuilding(activeZone.building); return; }
  if (activeZone.key === 'exit-building') { exitBuilding(); return; }
  if (activeZone.key === 'floor-change') { enterBuilding(roomBuilding, currentRoom.level ? 0 : 1); return; }
  if (activeZone.key === 'room-info') { announceWorld(currentRoom.type === 'union' ? 'The renovated Union includes mail/print services, an elevator and an upstairs student lounge. This layout is a reconstruction.' : 'The library offers study spaces, research support and technology resources. This room is an illustrative layout.'); return; }
  openModal(activeZone.key, activeZone.note);
}
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
  chat: mountChat,
  lionsden: mountLionsDen,
  modqueue: mountModQueue,
  guidelines: mountGuidelines,
  leaderboard: mountLeaderboard,
  king: mountVoting,
  store: mountStore,
  parties: mountParties,
  vending: mountVending,
  achievements: mountAchievements,
  onboarding: mountOnboarding,
  band: mountBand,
  doubledutch: mountDoubleDutch,
  hopscotch: mountHopscotch,
  boombox: mountBoombox,
  photobooth: (root, opts) =>
    mountPhotoBooth(root, {
      ...opts,
      campusLabel: CAMPUS_META.shortName,
      capture: () => {
        // The renderer isn't created with preserveDrawingBuffer (that costs
        // perf every frame), so re-render synchronously right before
        // reading pixels — otherwise toDataURL() reads an already-cleared
        // buffer and comes back blank.
        renderer.render(activeScene(), camera);
        return renderer.domElement.toDataURL("image/png");
      },
    }),
};

// Modals with live Firestore listeners return a cleanup function; it runs on
// every close path (button, backdrop, or opening another modal) so a closed
// modal never keeps listening — and billing reads — in the background.
let modalCleanup = null;
let modalReturnFocus = null;
function prepareDialog() {
  const dialog = modalRoot.querySelector('.modal');
  if (!dialog) return;
  dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', dialog.querySelector('h3')?.textContent || 'The Yard');
  dialog.tabIndex = -1; dialog.focus();
}
new MutationObserver(() => { if (modalRoot.querySelector('.modal:not([role])')) prepareDialog(); }).observe(modalRoot, { childList: true, subtree: true });
document.addEventListener('keydown', e => {
  if (!modalIsOpen()) return;
  if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
  if (e.key === 'Tab') {
    const items = [...modalRoot.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
    const first = items[0], last = items.at(-1);
    if (!first) { e.preventDefault(); return; }
    if (e.shiftKey && (document.activeElement === first || document.activeElement.classList.contains('modal'))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

function runModalCleanup() {
  if (typeof modalCleanup === "function") modalCleanup();
  modalCleanup = null;
}

function closeModal() {
  runModalCleanup();
  modalRoot.innerHTML = "";
  clearInput();
  if (modalReturnFocus?.getClientRects().length) modalReturnFocus.focus();
  else document.querySelector('.yard-menu summary')?.focus();
  playClose();
}

function mountInBackdrop(mount) {
  runModalCleanup();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  modalRoot.innerHTML = "";
  modalRoot.appendChild(backdrop);
  modalCleanup = mount(backdrop);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
}

function openModal(key, zoneNote) {
  if (!modalIsOpen()) modalReturnFocus = document.activeElement;
  clearInput();
  playOpen();
  if (key === 'destinations') { mountInBackdrop(root => navigation.mount(root)); return; }
  if (key === 'character') {
    mountInBackdrop(root => mountCharacterEditor(root, { look: currentLook, onSave: applyLook, onClose: closeModal }));
    return;
  }
  if (key === "plots") {
    mountInBackdrop((root) => mountPlotClaim(root, { letters: zoneNote, onClose: closeModal }));
    return;
  }
  if (key === "auth") {
    mountInBackdrop((root) => mountAuthModal(root, { onClose: closeModal, openModal }));
    return;
  }
  if (MINIGAMES[key]) {
    mountInBackdrop((root) => MINIGAMES[key](root, { onClose: closeModal }));
    return;
  }
  runModalCleanup();

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
  el.addEventListener("click", () => { if (!el.disabled) openModal(el.dataset.modal); });
});

// ---- Auth + multiplayer wiring ----
const playerCountEl = document.getElementById("player-count-label");
const peerMeshes = new Map(); // key -> { group, label }
let peers = new Map();
let authUser = null;

function updatePlayerCountLabel() {
  if (!ONLINE) return;
  const count = peers.size + (authUser ? 1 : 0);
  playerCountEl.innerHTML = `<b>${count}</b> ${CAMPUS_META.mascot} on the Yard · free`;
}

// Auth state fires on every profile change (rename, equip), so presence and
// the wallet listener only restart when the signed-in account itself changes.
let presenceUid = null;
onAuthChange(async (state) => {
  authUser = state.user;
  if (!ONLINE) return;
  const uid = state.user?.uid ?? null;
  if (uid !== presenceUid) {
    if (presenceUid) {
      leavePresence();
      stopWatchingWallet();
    }
    presenceUid = uid;
    if (uid) {
      await joinPresence(uid, state.profile);
      watchWallet(uid);
    }
  }
  if (uid && state.profile) {
    setMyIdentity(state.profile.display_name || "Golden Lion", state.profile.color || "#f4b223");
    torso.material.color.set(state.profile.color || "#f4b223");
  }
  updateAuthButtons(state);
  updatePlayerCountLabel();
});

// Signed in: hide "Sign up", turn "Log in" into an account button.
function updateAuthButtons(state) {
  document.querySelectorAll('[data-modal="auth"]').forEach((btn) => {
    btn.dataset.label ??= btn.textContent;
    if (btn.classList.contains("btn-primary")) btn.classList.toggle("hidden", Boolean(state.user));
    else btn.textContent = state.user ? `👤 ${state.profile?.display_name || "Account"}` : btn.dataset.label;
  });
}

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
      const group = createCharacter({ shirt: p.color });
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
    entry.group.userData.torso.material.color.set(p.color || "#f4b223");
    entry.label.textContent = p.name || "Golden Lion";
  });
  for (const [key, entry] of peerMeshes) {
    if (!seen.has(key)) {
      scene.remove(entry.group);
      disposeCharacter(entry.group);
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
    entry.label.style.display = !currentRoom && pos.z < 1 ? "block" : "none";
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

function syncLiveParties(parties) {
  const liveIds = new Set(parties.map((p) => p.id));

  for (const [id, group] of partyMarkers) {
    if (!liveIds.has(id)) {
      scene.remove(group);
      partyMarkers.delete(id);
      for (let i = interactionZones.length - 1; i >= 0; i--) {
        if (interactionZones[i].partyId === id) interactionZones.splice(i, 1);
      }
    }
  }

  parties.forEach((p) => {
    if (partyMarkers.has(p.id)) return;
    const group = createPartyMarker(p.spot);
    partyMarkers.set(p.id, group);
    const spot = PARTY_SPOTS[p.spot] || PARTY_SPOTS.bell_tower_yard;
    interactionZones.push({ x: spot.x, z: spot.z, radius: 5, key: "parties", label: `${p.title}: RSVP / join in`, partyId: p.id });
  });
}

if (ONLINE) {
  // Only one inequality filter per Firestore query, so this fetches every
  // not-yet-ended party (endsAt >= now) via onSnapshot, then filters down to
  // "already started" client-side. A 20s re-check keeps catching parties
  // that cross their start time between writes — onSnapshot alone only
  // fires on document changes, not as time passes.
  let notYetEnded = [];
  const q = query(collection(db, "parties"), where("hidden", "==", false), where("endsAt", ">=", new Date()));
  onSnapshot(q, (snap) => {
    notYetEnded = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    syncLiveParties(notYetEnded.filter((p) => p.startsAt.toMillis() <= Date.now()));
  });
  setInterval(() => syncLiveParties(notYetEnded.filter((p) => p.startsAt.toMillis() <= Date.now())), 20000);
}

// ---- Loop ----
const clock = new THREE.Clock();
const SPEED = 6;
let lastMinimapUpdate = -1;

function updateAvatar(dt) {
  impactCooldown = Math.max(0, impactCooldown - dt);
  hitTime = Math.max(0, hitTime - dt);
  const intent = input.poll({ modalOpen: modalIsOpen() });
  if (modalIsOpen() || !enteredYard) return;
  let dx = intent.dx, dz = intent.dz;
  // Map screen directions into the current camera plane.
  const offset = cameraOffset();
  const heading = Math.atan2(offset.x, offset.z);
  const localX = dx;
  dx = localX * Math.cos(heading) + dz * Math.sin(heading);
  dz = -localX * Math.sin(heading) + dz * Math.cos(heading);
  if (hitTime > 0) { dx = 0; dz = 0; }
  avatar.rotation.z = hitTime > 0 ? Math.sin(Math.min(1, hitTime) * Math.PI / 2) * .85 : 0;
  avatar.userData.animate(dt, Math.min(1, Math.hypot(dx, dz)));

  if (dx !== 0 || dz !== 0) {
    unlockAchievement("first_steps");
    const len = Math.max(1, Math.hypot(dx, dz));
    dx /= len;
    dz /= len;
    const speed = currentRoom ? 3.5 : intent.sprint ? 10 : SPEED;
    const next = (currentRoom?.world || world).move(avatar.position, dx * speed * dt, dz * speed * dt, currentRoom?.bounds || campusBounds, currentRoom ? [] : traffic.colliders());
    avatar.position.x = next.x; avatar.position.z = next.z;
    const targetAngle = Math.atan2(dx, dz);
    const angleDelta = Math.atan2(Math.sin(targetAngle - avatar.rotation.y), Math.cos(targetAngle - avatar.rotation.y));
    avatar.rotation.y += angleDelta * (1 - Math.exp(-12 * dt));
  }

  if (hitTime > 0 && !currentRoom) {
    const next = world.move(avatar.position, impactX * dt, impactZ * dt, campusBounds);
    avatar.position.x = next.x; avatar.position.z = next.z;
    impactX *= Math.exp(-5 * dt); impactZ *= Math.exp(-5 * dt);
  }
  view.damp(dt);
  const look = cameraOffset();
  const pulled = view.pullForObstruction(
    { x: avatar.position.x, y: avatar.position.y + 1.2, z: avatar.position.z },
    { x: avatar.position.x + look.x, y: avatar.position.y + look.y, z: avatar.position.z + look.z },
    raycastCamera
  );
  desiredCamPos.set(pulled.x, pulled.y, pulled.z);
  camera.position.lerp(desiredCamPos, 1 - Math.exp(-8 * dt));
  camera.lookAt(avatar.position.x, avatar.position.y + 1, avatar.position.z);

  if (!currentRoom) updateMyPosition(avatar.position.x, avatar.position.z, avatar.rotation.y);
}

function updateInteractionPrompt() {
  const zones = currentRoom ? currentRoom.zones : interactionZones;
  activeZone = interactionTarget.pick(zones, avatar.position.x, avatar.position.z, activeZone);
  const ui = interactionTarget.prompt(activeZone, {
    entered: enteredYard,
    modalOpen: modalIsOpen(),
    stunned: hitTime > 0,
    gamepad: input.gamepadIndex !== null,
    coarse: matchMedia('(pointer: coarse)').matches,
  });
  const touchButton = document.getElementById('touch-interact'); touchButton.disabled = !ui.available;
  touchButton.setAttribute('aria-label', ui.available ? ui.label : 'No interaction nearby');
  promptEl.style.display = ui.available ? 'block' : 'none';
  if (ui.available) promptEl.textContent = ui.text;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const playerBefore = { x: avatar.position.x, z: avatar.position.z };
  updateAvatar(dt);
  updateInteractionPrompt();
  updatePeerLabels();
  if (!currentRoom) updateWeatherParticles(dt);
  traffic.update(dt, enteredYard && !currentRoom ? avatar.position : null);
  if (enteredYard && !currentRoom && !modalIsOpen() && impactCooldown <= 0) {
    for (const car of traffic.cars) {
      if (car.speed < .4) continue;
      if (sweptVehicleContact(playerBefore, avatar.position, car.previous, car.mesh.position, car.mesh.rotation.y)) {
        hitTime = 1.2; impactCooldown = 3;
        impactX = Math.sin(car.mesh.rotation.y) * Math.min(10, car.speed * 2);
        impactZ = Math.cos(car.mesh.rotation.y) * Math.min(10, car.speed * 2);
        car.speed = 0; clearInput(); announceWorld('Vehicle impact. Recovering… Check the road before crossing.'); break;
      }
    }
  }
  pedestrians.update(dt);
  band?.update(clock.elapsedTime);
  if (isBoomboxPlaying() && Math.hypot(avatar.position.x - BB_X, avatar.position.z - BB_Z) > BOOMBOX_RANGE) {
    stopBoombox();
  }
  navigation.update(clock.elapsedTime, Boolean(currentRoom));
  if (!currentRoom && clock.elapsedTime - lastMinimapUpdate > .15) { lastMinimapUpdate = clock.elapsedTime; minimap.update({ x: avatar.position.x, z: avatar.position.z, rotY: avatar.rotation.y, peers, route: navigation.route }); }
  renderer.render(activeScene(), camera);
}
animate();



if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) {
  window.__yardTest = {
    state: () => ({ position: { x: avatar.position.x, z: avatar.position.z }, room: currentRoom?.type || null, level: currentRoom?.level, hitTime, cameraZoom: view.zoom, cameraYaw: view.yaw, route: navigation.route, colliders: (currentRoom?.world || world).shapes, doors: BUILDINGS.filter(b => b.enterable).map(b => ({ name: b.name, ...b.entrance })) }),
    place: (x,z) => { avatar.position.set(x,0,z); clearInput(); },
    move: (dx,dz) => { const p = (currentRoom?.world || world).move(avatar.position, dx, dz, currentRoom?.bounds || campusBounds); avatar.position.x=p.x;avatar.position.z=p.z; },
    impact: () => { const c = traffic.cars[0]; const a=c.mesh.rotation.y; avatar.position.set(c.mesh.position.x+Math.sin(a)*1.3,0,c.mesh.position.z+Math.cos(a)*1.3); c.speed=4; impactCooldown=0; },
    roomZones: () => currentRoom?.zones || [],
    recover: recoverPosition,
  };
}

// ---- PWA install ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js").catch(() => {});
  });
}

let installPromptEvent = null;
const installChip = document.getElementById("install-chip");
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPromptEvent = e;
  if (installChip) installChip.classList.remove("hidden");
});
installChip?.addEventListener("click", async () => {
  if (!installPromptEvent) return;
  installPromptEvent.prompt();
  await installPromptEvent.userChoice;
  installPromptEvent = null;
  installChip.classList.add("hidden");
});
window.addEventListener("appinstalled", () => {
  installChip?.classList.add("hidden");
});
