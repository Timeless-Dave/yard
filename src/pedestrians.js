// Ambient NPC students — small groups walking slow circles around each
// campus hub (PARTY_SPOTS), so the Yard feels populated even with no other
// players online. Purely decorative: no collision, no interaction.
import * as THREE from "three";

const SKIN_TONES = [0x8a5a3c, 0x6b4226, 0xc99a6b, 0x4a2e1a];
const SHIRT_COLORS = [0xf4b223, 0x121212, 0xffffff, 0x7a2e22, 0x3a5c8a];

function createPedestrianMesh() {
  const group = new THREE.Group();
  const shirt = SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)];
  const skin = SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)];

  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.65, 4, 8),
    new THREE.MeshStandardMaterial({ color: shirt })
  );
  torso.position.y = 0.75;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 12, 12),
    new THREE.MeshStandardMaterial({ color: skin })
  );
  head.position.y = 1.35;
  head.castShadow = true;
  group.add(head);

  return group;
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

  function update(dt) {
    npcs.forEach((npc) => {
      npc.angle += npc.speed * dt;
      npc.bob += dt * 4;
      const x = npc.cx + Math.cos(npc.angle) * npc.radius;
      const z = npc.cz + Math.sin(npc.angle) * npc.radius;
      npc.mesh.position.set(x, Math.abs(Math.sin(npc.bob)) * 0.05, z);
      const targetAngle = npc.angle + (npc.speed > 0 ? Math.PI / 2 : -Math.PI / 2);
      npc.mesh.rotation.y = targetAngle;
    });
  }

  return { npcs, update };
}
