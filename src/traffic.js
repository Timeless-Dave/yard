// Ambient road network and looping car traffic, driven by imported OSM
// centerlines. Cars are simple low-poly meshes on driveable ways only.
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
    wheel.rotation.z = Math.PI / 2;
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

// OSM centerlines replace the invented road loop. Roads and pedestrian paths
// are separate surfaces, and vehicles never choose footway data.
export function createMappedRoadNetwork(scene, roads) {
  const surfaces = new Map();
  function strip(a, b, width, y, color) {
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz); if (length < .01) return;
    const nx = -dz / length * width / 2, nz = dx / length * width / 2;
    if (!surfaces.has(color)) surfaces.set(color, []);
    const v = surfaces.get(color);
    for (const p of [[a.x+nx,a.z+nz],[b.x+nx,b.z+nz],[a.x-nx,a.z-nz],[a.x-nx,a.z-nz],[b.x+nx,b.z+nz],[b.x-nx,b.z-nz]]) v.push(p[0], y, p[1]);
  }
  for (const road of roads) {
    const path = ['footway','track'].includes(road.kind), width = path ? 1.25 : ['primary','tertiary'].includes(road.kind) ? 5.2 : 3.4;
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i-1], b = road.points[i];
      strip(a,b,width + (path ? .1 : .6),.025,path ? '#b9b7a9' : '#8d908b');
      strip(a,b,width,.035,path ? '#c9c6b9' : '#484d4e');
      if (!path && road.kind !== 'service') strip(a,b,.055,.045,'#d5be65');
    }
  }
  const group = new THREE.Group();
  surfaces.forEach((positions,color) => {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions,3)); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,side:THREE.DoubleSide,roughness:1})); mesh.receiveShadow=true; mesh.userData.noCollision=true; group.add(mesh);
  }); scene.add(group); return group;
}

export function createMappedTraffic(scene, roads) {
  const choices = roads.filter(r => ['tertiary','residential','living_street'].includes(r.kind) && r.points.length > 2)
    .map(r => ({...r, length:r.points.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-r.points[i].x,p.z-r.points[i].z),0)}))
    .filter(r=>r.length>50).sort((a,b)=>b.length-a.length).slice(0,6);
  function sample(road, distance, direction) {
    let d=distance;
    for(let i=1;i<road.points.length;i++) {
      const a=road.points[i-1],b=road.points[i],length=Math.hypot(b.x-a.x,b.z-a.z);
      if(d<=length || i===road.points.length-1) {
        const t=Math.min(1,d/Math.max(length,.001)),angle=Math.atan2(b.x-a.x,b.z-a.z)+(direction<0?Math.PI:0);
        return {x:a.x+(b.x-a.x)*t+Math.cos(angle)*.7,z:a.z+(b.z-a.z)*t-Math.sin(angle)*.7,angle};
      } d-=length;
    }
  }
  const cars=choices.map((road,i)=>{
    const mesh=createCarMesh(CAR_COLORS[i%CAR_COLORS.length]);mesh.userData.dynamic=true;scene.add(mesh);
    const dist=road.length*(.15+i*.1),p=sample(road,dist,1);mesh.position.set(p.x,0,p.z);mesh.rotation.y=p.angle;
    return {mesh,road,dist,direction:1,speed:0,cruise:3.8+i*.15,previous:{x:p.x,z:p.z}};
  });
  let collisionWorld = null;
  function update(dt,player) {
    for(const car of cars) {
      car.previous={x:car.mesh.position.x,z:car.mesh.position.z};
      const angle=car.mesh.rotation.y,dx=(player?.x??1e6)-car.mesh.position.x,dz=(player?.z??1e6)-car.mesh.position.z;
      const ahead=dx*Math.sin(angle)+dz*Math.cos(angle),side=Math.abs(dx*Math.cos(angle)-dz*Math.sin(angle));
      const lookAhead = sample(car.road, THREE.MathUtils.clamp(car.dist + car.direction * 4, 0, car.road.length), car.direction);
      const blocked = collisionWorld && !collisionWorld.clear(lookAhead.x, lookAhead.z, 1.3);
      const braking=blocked || (player && ahead>0 && ahead<7 && side<1.5);
      const target=braking?0:car.cruise;
      car.speed=THREE.MathUtils.damp(car.speed,target,braking?8:2,dt);
      const proposed = car.dist+car.speed*dt*car.direction;
      const candidate = sample(car.road, THREE.MathUtils.clamp(proposed, 0, car.road.length), car.direction);
      if (!collisionWorld || collisionWorld.clear(candidate.x, candidate.z, 1.3)) car.dist=proposed;
      else car.speed=0;
      if(car.dist>car.road.length){car.dist=car.road.length;car.direction=-1;car.speed=0;}
      if(car.dist<0){car.dist=0;car.direction=1;car.speed=0;}
      const p=sample(car.road,car.dist,car.direction);car.mesh.position.set(p.x,0,p.z);car.mesh.rotation.y=p.angle;
    }
  }
  function setWorld(world) {
    collisionWorld=world;
    // Keep vehicles out of props or buildings even when an OSM centerline is incomplete.
    for (const car of cars) for (let d=car.dist, n=0; n<Math.ceil(car.road.length); n++, d=(d+1)%car.road.length) {
      const p=sample(car.road,d,car.direction);
      if(world.clear(p.x,p.z,1.3)){car.dist=d;car.mesh.position.set(p.x,0,p.z);car.previous={x:p.x,z:p.z};break;}
    }
  }
  return {cars,update,setWorld,colliders:()=>cars.map(c=>({x:c.mesh.position.x,z:c.mesh.position.z,w:1.1,d:2.3,angle:c.mesh.rotation.y}))};
}
