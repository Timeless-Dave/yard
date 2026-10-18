// Ambient road network and looping car traffic, driven by a campus's
// ROAD_ROUTE waypoint list (see campusData.*.js). Cars are simple
// low-poly meshes that follow the loop at slightly different speeds.
import * as THREE from "three";

const CAR_COLORS = [0xcc2a2a, 0x2a4acc, 0xe8e2d0, 0x2a2a2a, 0xf4b223];

function createCarMesh(color) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.5, 2.2),
    new THREE.MeshStandardMaterial({ color })
  );
  body.position.y = 0.45;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.4, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x1a2430, transparent: true, opacity: 0.85 })
  );
  cabin.position.set(0, 0.88, -0.1);
  group.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.22, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  [
    [-0.55, 0.22, 0.75],
    [0.55, 0.22, 0.75],
    [-0.55, 0.22, -0.75],
    [0.55, 0.22, -0.75],
  ].forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    group.add(wheel);
  });

  const headlights = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.12, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xfff6cc, emissive: 0xfff6cc, emissiveIntensity: 0.4 })
  );
  headlights.position.set(0, 0.45, 1.13);
  group.add(headlights);

  return group;
}

export function createRoadNetwork(scene, route) {
  const roadGroup = new THREE.Group();
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xe8d84a });

  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);

    const seg = new THREE.Mesh(new THREE.PlaneGeometry(4.2, len + 2), asphalt);
    seg.rotation.x = -Math.PI / 2;
    seg.rotation.z = -angle;
    seg.position.set((a.x + b.x) / 2, 0.015, (a.z + b.z) / 2);
    seg.receiveShadow = true;
    roadGroup.add(seg);

    const dashCount = Math.max(2, Math.floor(len / 4));
    for (let d = 0; d < dashCount; d++) {
      const t = (d + 0.5) / dashCount;
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 1.2), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.rotation.z = -angle;
      dash.position.set(a.x + dx * t, 0.02, a.z + dz * t);
      roadGroup.add(dash);
    }
  }
  scene.add(roadGroup);
  return roadGroup;
}

export function createTraffic(scene, route, count = 4) {
  const totalLen = route.reduce((sum, p, i) => {
    if (i === 0) return 0;
    return sum + Math.hypot(p.x - route[i - 1].x, p.z - route[i - 1].z);
  }, 0);

  function positionAt(dist) {
    let d = ((dist % totalLen) + totalLen) % totalLen;
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i];
      const b = route[i + 1];
      const segLen = Math.hypot(b.x - a.x, b.z - a.z);
      if (d <= segLen || i === route.length - 2) {
        const t = segLen === 0 ? 0 : d / segLen;
        return {
          x: a.x + (b.x - a.x) * t,
          z: a.z + (b.z - a.z) * t,
          angle: Math.atan2(b.x - a.x, b.z - a.z),
        };
      }
      d -= segLen;
    }
    return { x: route[0].x, z: route[0].z, angle: 0 };
  }

  const cars = Array.from({ length: count }).map((_, i) => {
    const mesh = createCarMesh(CAR_COLORS[i % CAR_COLORS.length]);
    scene.add(mesh);
    return {
      mesh,
      dist: (totalLen / count) * i,
      speed: 5 + Math.random() * 2,
    };
  });

  function update(dt) {
    cars.forEach((car) => {
      car.dist += car.speed * dt;
      const p = positionAt(car.dist);
      car.mesh.position.set(p.x, 0, p.z);
      car.mesh.rotation.y = THREE.MathUtils.lerp(car.mesh.rotation.y, p.angle, 0.15);
    });
  }

  return { cars, update };
}
