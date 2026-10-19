// A* over the same collision world used by the player. Mapped paths have
// preference; lawns are a fallback, never an assertion of an official route.
class Heap {
  data = [];
  push(value) { let i = this.data.length; this.data.push(value); while (i) { const p = (i - 1) >> 1; if (this.data[p].f <= value.f) break; this.data[i] = this.data[p]; i = p; } this.data[i] = value; }
  pop() { const first = this.data[0], last = this.data.pop(); if (this.data.length) { let i = 0; while (i * 2 + 1 < this.data.length) { let c = i * 2 + 1; if (c + 1 < this.data.length && this.data[c + 1].f < this.data[c].f) c++; if (this.data[c].f >= last.f) break; this.data[i] = this.data[c]; i = c; } this.data[i] = last; } return first; }
}
export function createRoutePlanner(world, bounds, roads = [], step = 1.5) {
  const width = Math.ceil((bounds.xMax - bounds.xMin) / step) + 1, height = Math.ceil((bounds.zMax - bounds.zMin) / step) + 1;
  const point = id => ({ x: bounds.xMin + id % width * step, z: bounds.zMin + Math.floor(id / width) * step });
  const idAt = p => Math.round((p.z - bounds.zMin) / step) * width + Math.round((p.x - bounds.xMin) / step);
  const blocked = new Uint8Array(width * height), preferred = new Set();
  for (let id = 0; id < blocked.length; id++) { const p = point(id); blocked[id] = world.clear(p.x, p.z, .6) ? 0 : 1; }
  roads.filter(r => ['footway', 'living_street', 'service'].includes(r.kind)).forEach(r => {
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1], b = r.points[i], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step);
      for (let j = 0; j <= n; j++) preferred.add(idAt({ x: a.x + (b.x - a.x) * j / Math.max(1, n), z: a.z + (b.z - a.z) * j / Math.max(1, n) }));
    }
  });
  function segmentClear(a, b) { const n = Math.ceil(Math.hypot(a.x - b.x, a.z - b.z) / .3); for (let i = 0; i <= n; i++) if (!world.clear(a.x + (b.x - a.x) * i / Math.max(1, n), a.z + (b.z - a.z) * i / Math.max(1, n), .5)) return false; return true; }
  function gridNear(p) {
    const base = idAt(p), candidates = [];
    for (let z = -3; z <= 3; z++) for (let x = -3; x <= 3; x++) { const id = base + z * width + x; if (id >= 0 && id < blocked.length && !blocked[id] && segmentClear(p, point(id))) candidates.push(id); }
    candidates.sort((a, b) => Math.hypot(point(a).x - p.x, point(a).z - p.z) - Math.hypot(point(b).x - p.x, point(b).z - p.z)); return candidates[0];
  }
  return function route(start, destination) {
    const from = gridNear(start), to = gridNear(destination);
    if (from === undefined || to === undefined) return null;
    const heap = new Heap(), g = new Float64Array(blocked.length).fill(Infinity), parent = new Int32Array(blocked.length).fill(-1), visited = new Uint8Array(blocked.length);
    const heuristic = id => Math.hypot(id % width - to % width, Math.floor(id / width) - Math.floor(to / width));
    heap.push({ id: from, f: heuristic(from) }); g[from] = 0;
    while (heap.data.length) {
      const { id } = heap.pop(); if (visited[id]) continue; visited[id] = 1;
      if (id === to) { const path = [destination]; for (let n = to; n !== -1; n = parent[n]) path.push(point(n)); path.push(start); return path.reverse(); }
      for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        const x = id % width + dx, z = Math.floor(id / width) + dz, next = z * width + x;
        if (x < 0 || x >= width || z < 0 || z >= height || blocked[next] || visited[next]) continue;
        if (!segmentClear(point(id), point(next))) continue;
        const score = g[id] + Math.hypot(dx, dz) * (preferred.has(next) ? 1 : 1.8);
        if (score < g[next]) { g[next] = score; parent[next] = id; heap.push({ id: next, f: score + heuristic(next) }); }
      }
    }
    return null;
  };
}
