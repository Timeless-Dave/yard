// UAPB's "Marching Musical Machine of the Mid-South" (M4) — a visual
// formation of band members near the stadium approach, marching in place.
// Researched: founded 1946, the name spells M-4 (Marching / Musical /
// Machine / of the Mid-South), a nickname credited to director John R.
// Graham Jr.
import * as THREE from "three";

const GOLD = 0xf4b223;
const BLACK = 0x121212;

function createBandMember(instrument) {
  const group = new THREE.Group();

  const uniform = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.6, 4, 8),
    new THREE.MeshStandardMaterial({ color: BLACK })
  );
  uniform.position.y = 0.7;
  uniform.castShadow = true;
  group.add(uniform);

  const sash = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.5, 0.08),
    new THREE.MeshStandardMaterial({ color: GOLD })
  );
  sash.position.set(0, 0.75, 0.2);
  group.add(sash);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), new THREE.MeshStandardMaterial({ color: 0x6b4226 }));
  head.position.y = 1.28;
  group.add(head);

  const hat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.2, 0.35, 10),
    new THREE.MeshStandardMaterial({ color: BLACK })
  );
  hat.position.y = 1.58;
  group.add(hat);
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 6), new THREE.MeshStandardMaterial({ color: GOLD }));
  plume.position.y = 1.9;
  group.add(plume);

  if (instrument === "drum") {
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.3, 12),
      new THREE.MeshStandardMaterial({ color: 0xe8e2d0 })
    );
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0, 0.85, 0.35);
    group.add(drum);
  } else {
    const horn = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.5, 10),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.6, roughness: 0.3 })
    );
    horn.rotation.x = Math.PI / 2.2;
    horn.position.set(0.15, 0.95, 0.35);
    group.add(horn);
  }

  return group;
}

export function createMarchingBand(scene, x, z) {
  const members = [];
  const rows = 3;
  const cols = 6;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const instrument = r === 0 ? "drum" : "horn";
      const mesh = createBandMember(instrument);
      const mx = x + (c - (cols - 1) / 2) * 1.3;
      const mz = z + r * 1.6;
      mesh.position.set(mx, 0, mz);
      mesh.userData.baseY = 0;
      mesh.userData.phase = Math.random() * Math.PI * 2;
      scene.add(mesh);
      members.push(mesh);
    }
  }

  function update(t) {
    members.forEach((m, i) => {
      m.position.y = Math.abs(Math.sin(t * 4 + m.userData.phase)) * 0.12;
      m.rotation.y = Math.sin(t * 2 + i) * 0.08;
    });
  }

  return { members, update };
}
