// Ambient NPC students — small groups walking slow circles around each
// campus hub (PARTY_SPOTS), so the Yard feels populated even with no other
// players online. Purely decorative: no collision, no interaction.
import { createCharacter } from "./avatar.js";

const SKIN_TONES = [0x8a5a3c, 0x6b4226, 0xc99a6b, 0x4a2e1a];
const SHIRT_COLORS = [0xf4b223, 0x121212, 0xffffff, 0x7a2e22, 0x3a5c8a];

function createPedestrianMesh() {
  return createCharacter({
    shirt: '#' + SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)].toString(16).padStart(6, '0'),
    skin: '#' + SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)].toString(16).padStart(6, '0'),
    hair: ['Coils', 'Locs', 'Close crop', 'Bun'][Math.floor(Math.random() * 4)],
    build: ['Slender', 'Balanced', 'Broad'][Math.floor(Math.random() * 3)],
    height: .9 + Math.random() * .2,
  });
}

export function createPedestrians(scene, partySpots, perSpot = 2) {
  const npcs = [];
  Object.values(partySpots || {}).forEach((spot) => {
    for (let i = 0; i < perSpot; i++) {
      const mesh = createPedestrianMesh();
      const radius = 4 + Math.random() * 5;
      const angle = Math.random() * Math.PI * 2;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const speed = (0.25 + Math.random() * 0.15) * dir;
      mesh.position.set(spot.x + Math.cos(angle) * radius, 0, spot.z + Math.sin(angle) * radius);
      scene.add(mesh);
      npcs.push({ mesh, cx: spot.x, cz: spot.z, radius, angle, speed, bob: Math.random() * Math.PI * 2 });
    }
  });

  let collisionWorld=null, bounds=null;
  function setWorld(world, limits) {
    collisionWorld=world; bounds=limits;
    npcs.forEach(n => { const p=world.nearestClear(n.mesh.position); if(p) n.mesh.position.set(p.x,0,p.z); });
  }
  function update(dt) {
    npcs.forEach((npc) => {
      npc.angle += npc.speed * dt;
      npc.bob += dt * 4;
      const x = npc.cx + Math.cos(npc.angle) * npc.radius;
      const z = npc.cz + Math.sin(npc.angle) * npc.radius;
      const dx=x-npc.mesh.position.x,dz=z-npc.mesh.position.z,distance=Math.hypot(dx,dz);
      const step=Math.min(distance,dt*1.8),nx=distance?dx/distance*step:0,nz=distance?dz/distance*step:0;
      const next=collisionWorld?collisionWorld.move(npc.mesh.position,nx,nz,bounds):{x,z};
      const moved=Math.hypot(next.x-npc.mesh.position.x,next.z-npc.mesh.position.z);
      if(moved<dt*.15 && distance>1) {npc.speed=-npc.speed;npc.angle+=.3;}
      if(moved>.001) npc.mesh.rotation.y=Math.atan2(next.x-npc.mesh.position.x,next.z-npc.mesh.position.z);
      npc.mesh.position.set(next.x, Math.abs(Math.sin(npc.bob)) * .025, next.z);
      npc.mesh.userData.animate(dt, .5);
    });
  }

  return { npcs, update, setWorld };
}
