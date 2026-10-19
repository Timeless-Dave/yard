import { describe, it, expect } from 'vitest';
import { createCollisionWorld, overlaps, sweptVehicleContact, doorwayPolygon } from '../../src/worldPhysics.js';
import { createRoutePlanner } from '../../src/routePlanner.js';
import { bellTowerColliders, stadiumColliders } from '../../src/buildings.js';
import map from '../../src/uapbMap.generated.json';
const bounds = { xMin: -12, xMax: 12, zMin: -12, zMax: 12 };
describe('physical campus', () => {
  it('blocks a long move through solid furniture and slides along walls', () => {
    const world = createCollisionWorld([{ x: 0, z: 0, w: 2, d: 8 }]);
    expect(world.move({x:-5,z:0},12,0,bounds).x).toBeLessThan(-1.3);
    const p=world.move({x:-1.5,z:0},1,3,bounds); expect(p.x).toBeLessThan(-1.3);expect(p.z).toBeCloseTo(3);
  });
  it('leaves a south door recess walkable while blocking the building mass', () => {
    const shape = { x: 0, z: 0, w: 8, d: 8, polygon: doorwayPolygon({ x: 0, z: 0, w: 8, d: 8, door: 3, recess: 0.8 }) };
    expect(overlaps(0, 0, shape, .2)).toBe(true);
    expect(overlaps(0, 4.2, shape, .2)).toBe(false);
  });
  it('keeps the open corner of an irregular footprint walkable', () => {
    const shape={x:1.5,z:1.5,w:3,d:3,polygon:[{x:0,z:0},{x:3,z:0},{x:3,z:1},{x:1,z:1},{x:1,z:3},{x:0,z:3},{x:0,z:0}]};
    expect(overlaps(2,2,shape,.2)).toBe(false);expect(overlaps(.5,2,shape,.2)).toBe(true);
  });
  it('respects rotated parked vehicles and trunks', () => {
    expect(overlaps(1,0,{x:0,z:0,w:1,d:4,angle:Math.PI/2})).toBe(true);
    expect(overlaps(0,1.5,{x:0,z:0,w:1,d:4,angle:Math.PI/2})).toBe(false);
    expect(createCollisionWorld([{x:0,z:0,radius:.3}]).clear(.4,0)).toBe(false);
  });
  it('detects a fast crossing vehicle and ignores a separated pass', () => {
    expect(sweptVehicleContact({x:0,z:0},{x:0,z:0},{x:0,z:-10},{x:0,z:10},0)).toBe(true);
    expect(sweptVehicleContact({x:5,z:0},{x:5,z:0},{x:0,z:-10},{x:0,z:10},0)).toBe(false);
  });
  it('routes around obstacles, returns null for sealed destinations', () => {
    const world=createCollisionWorld([{x:0,z:0,w:2,d:10}]), plan=createRoutePlanner(world,bounds,[],1);
    const route=plan({x:-5,z:0},{x:5,z:0}); expect(route.length).toBeGreaterThan(10);
    for(const p of route) expect(world.clear(p.x,p.z,.5)).toBe(true);
    expect(plan({x:-5,z:0},{x:0,z:0})).toBeNull();
  });
  it('pins coordinate provenance and maps the correct current library', () => {
    expect(map.scale).toBe(.35);expect(map.roads.length).toBeGreaterThan(100);
    const library=map.buildings.find(b=>b.name==='John B. Watson Library');
    expect(library.osmId).toBe('818591116');expect(library.w).toBeGreaterThan(15);
    expect(map.buildings.find(b=>b.name==='Childress Hall').osmId).not.toBe(library.osmId);
  });
});

describe("bell tower 4-way open base", () => {
  const cx = 7, cz = -3;
  const r = 0.38;
  const world = createCollisionWorld(bellTowerColliders(cx, cz));
  it("exposes four corner piers (not two)", () => {
    expect(bellTowerColliders(cx, cz)).toHaveLength(4);
  });
  it("leaves the center walkable so people can stand under the tower", () => {
    expect(world.clear(cx, cz, r)).toBe(true);
  });
  it("keeps the full N/S transit through the base clear", () => {
    for (let dz = -2; dz <= 2; dz += 0.25) {
      expect(world.clear(cx, cz + dz, r)).toBe(true);
    }
  });
  it("keeps the full E/W transit through the base clear", () => {
    for (let dx = -2; dx <= 2; dx += 0.25) {
      expect(world.clear(cx + dx, cz, r)).toBe(true);
    }
  });
  it("blocks all four corner piers", () => {
    const offset = 1.075;
    expect(world.clear(cx - offset, cz - offset, r)).toBe(false);
    expect(world.clear(cx + offset, cz - offset, r)).toBe(false);
    expect(world.clear(cx - offset, cz + offset, r)).toBe(false);
    expect(world.clear(cx + offset, cz + offset, r)).toBe(false);
  });
});

describe("stadium colliders", () => {
  const cx = -4, cz = 12;
  const world = createCollisionWorld(stadiumColliders(cx, cz));
  it("keeps the field center walkable for players on the turf", () => {
    expect(world.clear(cx, cz, 0.38)).toBe(true);
    expect(world.clear(cx + 10, cz + 4, 0.38)).toBe(true); // mid-field position
  });
  it("blocks the home grandstand, away stand, and press box", () => {
    expect(world.clear(cx, cz - 10.5, 0.38)).toBe(false);   // home stand front row
    expect(world.clear(cx, cz + 10.5, 0.38)).toBe(false);   // away stand front row
    expect(world.clear(cx, cz - 13.7, 0.38)).toBe(false);   // press box footprint
  });
});
