// Ambient NPC students around each campus hub (PARTY_SPOTS), so the Yard feels
// populated even with no other players online. Roughly half of each hub's
// students stand in small chatting groups; the rest walk short closed or
// out-and-back polyline loops (jittered rectangles, L-shaped sidewalks) of
// radius 5-10 around the hub. Purely decorative: no collision against the
// player, no interaction, no name tags.
import { createCharacter, disposeCharacter } from "./avatar.js";

const SKIN_TONES = [0x8a5a3c, 0x6b4226, 0xc99a6b, 0x4a2e1a];
const SHIRT_COLORS = [0xf4b223, 0x121212, 0xffffff, 0x7a2e22, 0x3a5c8a];

const IDLE_ANIM_SPEED = 0.15;
const WALK_ANIM_SPEED = 0.5;
const ARRIVE_DIST = 0.45;
const STUCK_SECONDS = 0.7;

function createPedestrianMesh() {
  return createCharacter({
    shirt: '#' + SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)].toString(16).padStart(6, '0'),
    skin: '#' + SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)].toString(16).padStart(6, '0'),
    hair: ['Coils', 'Locs', 'Close crop', 'Bun'][Math.floor(Math.random() * 4)],
    build: ['Slender', 'Balanced', 'Broad'][Math.floor(Math.random() * 3)],
    height: .9 + Math.random() * .2,
  });
}

const between = (rng, a, b) => a + rng() * (b - a);

function rotate(x, z, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: x * c - z * s, z: x * s + z * c };
}

// Build a short sidewalk-style path around (cx, cz). `radius` (5-10) bounds how
// far any waypoint strays from the hub. Returns { points, pingPong }:
//  - closed loops (pingPong false): 4-point jittered rectangle or 5-point
//    rectangle with an extra bent corner, walked in order and wrapped.
//  - pingPong true: 3-point L-shaped sidewalk walked there and back.
export function buildPath(cx, cz, radius, rng = Math.random) {
  const yaw = rng() * Math.PI * 2;
  const jitter = (v) => v + between(rng, -0.12, 0.12) * radius;
  const kind = rng();
  const w = between(rng, 0.45, 0.7) * radius;
  const h = between(rng, 0.3, 0.55) * radius;
  let local;
  let pingPong = false;
  if (kind < 0.4) {
    local = [[-w, -h], [w, -h], [w, h], [-w, h]];
  } else if (kind < 0.65) {
    // 5 points: rectangle with a notch on the top side
    local = [[-w, -h], [0, -h * 0.4], [w, -h], [w, h], [-w, h]];
  } else {
    // L: along one side, then turn the corner
    local = [[-w, -h], [w, -h], [w, h]];
    pingPong = true;
  }
  const points = local.map(([x, z]) => {
    const p = rotate(jitter(x), jitter(z), yaw);
    const d = Math.hypot(p.x, p.z);
    const k = d > radius ? radius / d : 1;
    return { x: cx + p.x * k, z: cz + p.z * k };
  });
  return { points, pingPong };
}

// Next waypoint index for a path walker. dir is +1/-1 (only changes when pingPong).
export function nextWaypoint(index, dir, count, pingPong) {
  if (!pingPong) return { index: (index + 1) % count, dir: 1 };
  let ni = index + dir, nd = dir;
  if (ni >= count) { nd = -1; ni = count - 2; }
  else if (ni < 0) { nd = 1; ni = 1; }
  return { index: ni, dir: nd };
}

function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function createPedestrians(scene, partySpots, perSpot = 2) {
  const npcs = [];
  Object.values(partySpots || {}).forEach((spot) => {
    const idleCount = Math.min(perSpot, Math.round(perSpot * 0.5));
    // One conversation group per hub, a few units off the hub center.
    const groupAngle = Math.random() * Math.PI * 2;
    const groupDist = 2 + Math.random() * 3;
    const anchor = { x: spot.x + Math.cos(groupAngle) * groupDist, z: spot.z + Math.sin(groupAngle) * groupDist };
    const ringOffset = Math.random() * Math.PI * 2;
    for (let i = 0; i < perSpot; i++) {
      const mesh = createPedestrianMesh();
      let npc;
      if (i < idleCount) {
        const a = ringOffset + (i / Math.max(1, idleCount)) * Math.PI * 2;
        const r = idleCount > 1 ? 0.9 + Math.random() * 0.4 : 0;
        const x = anchor.x + Math.cos(a) * r, z = anchor.z + Math.sin(a) * r;
        // Face the group center; a lone idler just picks a random heading.
        const facing = idleCount > 1 ? Math.atan2(anchor.x - x, anchor.z - z) : Math.random() * Math.PI * 2;
        mesh.position.set(x, 0, z);
        mesh.rotation.y = facing;
        npc = {
          mode: 'idle', mesh, cx: spot.x, cz: spot.z,
          home: { x, z }, baseYaw: facing, targetYaw: facing,
          turnTimer: 1 + Math.random() * 4, bob: Math.random() * Math.PI * 2,
        };
      } else {
        const radius = 5 + Math.random() * 5;
        const { points, pingPong } = buildPath(spot.x, spot.z, radius);
        const start = Math.floor(Math.random() * points.length);
        mesh.position.set(points[start].x, 0, points[start].z);
        npc = {
          mode: 'walk', mesh, cx: spot.x, cz: spot.z, radius,
          points, pingPong, index: (start + 1) % points.length, dir: 1,
          walkSpeed: 1.05 + Math.random() * 0.3, // a touch slower than live players
          pause: 0, stuck: 0, bob: Math.random() * Math.PI * 2,
        };
      }
      scene.add(mesh);
      npcs.push(npc);
    }
  });

  let collisionWorld = null, bounds = null;
  function setWorld(world, limits) {
    collisionWorld = world; bounds = limits;
    npcs.forEach(n => {
      const p = world.nearestClear(n.mesh.position);
      if (p) n.mesh.position.set(p.x, 0, p.z);
      // Keep routes and idle spots on clear ground too.
      if (n.mode === 'walk') {
        n.points = n.points.map(pt => world.nearestClear(pt) || pt);
      } else {
        const h = world.nearestClear(n.home);
        if (h) n.home = h;
      }
    });
  }

  function updateIdle(npc, dt) {
    npc.turnTimer -= dt;
    if (npc.turnTimer <= 0) {
      // Occasional small turn around the original facing, like glancing around.
      npc.targetYaw = npc.baseYaw + (Math.random() - 0.5) * 1.2;
      npc.turnTimer = 2 + Math.random() * 5;
    }
    const diff = angleDelta(npc.mesh.rotation.y, npc.targetYaw);
    npc.mesh.rotation.y += diff * Math.min(1, dt * 3);
    npc.bob += dt * 1.5;
    // Idle NPCs hold their spot, but still go through move so a late-added
    // collider cannot trap them inside a building.
    const pos = npc.mesh.position;
    const dx = npc.home.x - pos.x, dz = npc.home.z - pos.z;
    const dist = Math.hypot(dx, dz);
    let nx = pos.x, nz = pos.z;
    if (dist > 0.05) {
      const step = Math.min(dist, dt * 1.0);
      const mx = dx / dist * step, mz = dz / dist * step;
      const next = collisionWorld ? collisionWorld.move(pos, mx, mz, bounds) : { x: pos.x + mx, z: pos.z + mz };
      nx = next.x; nz = next.z;
    }
    npc.mesh.position.set(nx, 0, nz);
    npc.mesh.userData.animate(dt, IDLE_ANIM_SPEED);
  }

  function updateWalk(npc, dt) {
    const pos = npc.mesh.position;
    if (npc.pause > 0) {
      npc.pause -= dt;
      npc.mesh.userData.animate(dt, IDLE_ANIM_SPEED);
      return;
    }
    npc.bob += dt * 4;
    const target = npc.points[npc.index];
    const dx = target.x - pos.x, dz = target.z - pos.z;
    const distance = Math.hypot(dx, dz);
    if (distance < ARRIVE_DIST) {
      const n = nextWaypoint(npc.index, npc.dir, npc.points.length, npc.pingPong);
      npc.index = n.index; npc.dir = n.dir; npc.stuck = 0;
      // Brief stop at some corners, like waiting for a friend.
      if (Math.random() < 0.35) npc.pause = 0.8 + Math.random() * 2.2;
      npc.mesh.userData.animate(dt, IDLE_ANIM_SPEED);
      return;
    }
    const step = Math.min(distance, dt * npc.walkSpeed);
    const mx = dx / distance * step, mz = dz / distance * step;
    const next = collisionWorld ? collisionWorld.move(pos, mx, mz, bounds) : { x: pos.x + mx, z: pos.z + mz };
    const moved = Math.hypot(next.x - pos.x, next.z - pos.z);
    if (moved < step * 0.25) {
      npc.stuck += dt;
      if (npc.stuck > STUCK_SECONDS) {
        // Blocked: skip to the next waypoint instead of grinding on a wall.
        const n = nextWaypoint(npc.index, npc.dir, npc.points.length, npc.pingPong);
        npc.index = n.index; npc.dir = n.dir; npc.stuck = 0;
      }
    } else {
      npc.stuck = 0;
    }
    if (moved > 0.001) npc.mesh.rotation.y = Math.atan2(next.x - pos.x, next.z - pos.z);
    npc.mesh.position.set(next.x, Math.abs(Math.sin(npc.bob)) * .025, next.z);
    npc.mesh.userData.animate(dt, WALK_ANIM_SPEED);
  }

  function update(dt) {
    npcs.forEach((npc) => {
      if (npc.mode === 'idle') updateIdle(npc, dt);
      else updateWalk(npc, dt);
    });
  }

  function refreshMeshes() {
    npcs.forEach(npc => {
      const parent = npc.mesh.parent;
      const position = npc.mesh.position.clone();
      const yaw = npc.mesh.rotation.y;
      parent?.remove(npc.mesh);
      disposeCharacter(npc.mesh);
      npc.mesh = createPedestrianMesh();
      npc.mesh.position.copy(position);
      npc.mesh.rotation.y = yaw;
      parent?.add(npc.mesh);
    });
  }

  return { npcs, update, setWorld, refreshMeshes };
}
