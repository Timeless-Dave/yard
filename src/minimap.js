const KIND_COLORS = {
  landmark: "#f4b223",
  athletics: "#2d6b4a",
  student_life: "#eef0ee",
  academic: "#7a8fb0",
  arts: "#a05fc0",
  admin: "#999999",
  dorm: "#a0724a",
};

export function createMapCamera({ xMin, xMax, zMin, zMax }) {
  const worldW = xMax - xMin;
  const worldD = zMax - zMin;
  let cx = (xMin + xMax) / 2;
  let cz = (zMin + zMax) / 2;
  let metersPerPixel = Math.max(worldW, worldD) / 200;

  function clampCenter() {
    const pad = metersPerPixel * 40;
    cx = Math.min(xMax + pad, Math.max(xMin - pad, cx));
    cz = Math.min(zMax + pad, Math.max(zMin - pad, cz));
  }

  return {
    get state() { return { cx, cz, metersPerPixel }; },
    fitAll(width, height) {
      metersPerPixel = Math.max(worldW / Math.max(1, width), worldD / Math.max(1, height)) * 1.08;
      cx = (xMin + xMax) / 2;
      cz = (zMin + zMax) / 2;
    },
    centerOn(x, z) { cx = x; cz = z; clampCenter(); },
    pan(dxPx, dyPx) { cx -= dxPx * metersPerPixel; cz -= dyPx * metersPerPixel; clampCenter(); },
    zoomAt(factor, px, py, width, height) {
      const before = toWorld(px, py, width, height);
      metersPerPixel = Math.min(Math.max(worldW, worldD) / 80, Math.max(0.08, metersPerPixel * factor));
      const after = toWorld(px, py, width, height);
      cx += before.x - after.x;
      cz += before.z - after.z;
      clampCenter();
    },
    toScreen(x, z, width, height) {
      return [(x - cx) / metersPerPixel + width / 2, (z - cz) / metersPerPixel + height / 2];
    },
    toWorld(px, py, width, height) {
      return { x: cx + (px - width / 2) * metersPerPixel, z: cz + (py - height / 2) * metersPerPixel };
    },
  };

  function toWorld(px, py, width, height) {
    return { x: cx + (px - width / 2) * metersPerPixel, z: cz + (py - height / 2) * metersPerPixel };
  }
}

function nearestBuilding(buildings, x, z, maxDist) {
  let best = null, dist = maxDist;
  for (const b of buildings) {
    const d = Math.hypot(b.x - x, b.z - z);
    if (d < dist) { dist = d; best = b; }
  }
  return best;
}

export function initMinimap(canvas, { xMin, xMax, zMin, zMax, buildings, roads = [], onSelect } = {}) {
  const app = document.getElementById("app") || canvas.parentElement;
  const overlay = document.createElement("div");
  overlay.className = "campus-map hidden";
  overlay.innerHTML = `<header>
      <strong>Campus map</strong>
      <button type="button" class="chip" data-map="me">My location</button>
      <button type="button" class="chip" data-map="fit">All campus</button>
      <button type="button" class="chip" data-map="close">Close</button>
    </header>
    <canvas width="960" height="720" aria-label="UAPB campus map. Drag to pan, scroll to zoom, tap a building to route."></canvas>
    <footer>
      <span data-map-label>N ↑ · drag · pinch or scroll to zoom</span>
      <span class="map-attribution">Geometry © OpenStreetMap contributors. Game routes are not official campus directions.</span>
    </footer>`;
  app.append(overlay);
  const big = overlay.querySelector("canvas");
  const miniCtx = canvas.getContext("2d");
  const bigCtx = big.getContext("2d");
  const miniCam = createMapCamera({ xMin, xMax, zMin, zMax });
  const overlayCam = createMapCamera({ xMin, xMax, zMin, zMax });
  miniCam.fitAll(canvas.width, canvas.height);
  overlayCam.fitAll(big.width, big.height);
  let open = false;
  let last = { x: 0, z: 0, rotY: 0, peers: [], route: [] };

  function draw(ctx, cam, width, height, { labels }) {
    ctx.fillStyle = "#121612";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#6f7a6c";
    ctx.lineWidth = Math.max(1, 2 / cam.state.metersPerPixel);
    roads.forEach((road) => {
      ctx.beginPath();
      road.points.forEach((p, i) => {
        const [x, y] = cam.toScreen(p.x, p.z, width, height);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.stroke();
    });
    buildings.forEach((b) => {
      const [mx, mz] = cam.toScreen(b.x, b.z, width, height);
      const r = b.kind === "landmark" ? 5 : 3.2;
      ctx.fillStyle = KIND_COLORS[b.kind] || "#888";
      ctx.beginPath();
      ctx.arc(mx, mz, r, 0, Math.PI * 2);
      ctx.fill();
      if (labels && cam.state.metersPerPixel < 0.9) {
        ctx.fillStyle = "#f3f1ea";
        ctx.font = "600 11px sans-serif";
        ctx.fillText(b.name, mx + 6, mz + 4);
      }
    });
    if (last.route?.length) {
      ctx.strokeStyle = "#ffd56a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      last.route.forEach((p, i) => {
        const [x, y] = cam.toScreen(p.x, p.z, width, height);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
    (last.peers || []).forEach((p) => {
      if (typeof p.x !== "number") return;
      const [mx, mz] = cam.toScreen(p.x, p.z, width, height);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(mx, mz, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    const [px, pz] = cam.toScreen(last.x, last.z, width, height);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(last.rotY || 0);
    ctx.fillStyle = "#f4b223";
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#eeeeee";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("N ↑", 10, 18);
  }

  function paint() {
    draw(miniCtx, miniCam, canvas.width, canvas.height, { labels: false });
    if (open) {
      const w = big.width = overlay.querySelector("canvas").clientWidth || 960;
      const h = big.height = overlay.querySelector("canvas").clientHeight || 720;
      draw(bigCtx, overlayCam, w, h, { labels: true });
    }
  }

  function expand() {
    open = true;
    overlay.classList.remove("hidden");
    overlayCam.centerOn(last.x, last.z);
    requestAnimationFrame(paint);
  }
  function collapse() {
    open = false;
    overlay.classList.add("hidden");
  }

  canvas.style.cursor = "pointer";
  canvas.title = "Open campus map";
  canvas.addEventListener("click", () => expand());
  overlay.querySelector('[data-map="close"]').onclick = collapse;
  overlay.querySelector('[data-map="me"]').onclick = () => { overlayCam.centerOn(last.x, last.z); paint(); };
  overlay.querySelector('[data-map="fit"]').onclick = () => { overlayCam.fitAll(big.clientWidth || 960, big.clientHeight || 720); paint(); };

  let drag = null;
  let pointers = new Map();
  function point(e) {
    const r = big.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }
  big.addEventListener("pointerdown", (e) => {
    big.setPointerCapture(e.pointerId);
    const p = point(e);
    pointers.set(e.pointerId, p);
    drag = { x: e.clientX, y: e.clientY, moved: false };
  });
  big.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    const p = point(e);
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      const prev = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pointers.set(e.pointerId, p);
      const next = [...pointers.values()];
      const now = Math.hypot(next[0].x - next[1].x, next[0].y - next[1].y);
      if (prev > 8 && now > 8) overlayCam.zoomAt(prev / now, (next[0].x + next[1].x) / 2, (next[0].y + next[1].y) / 2, p.w, p.h);
      paint();
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    overlayCam.pan(dx, dy);
    drag.x = e.clientX; drag.y = e.clientY;
    pointers.set(e.pointerId, p);
    paint();
  });
  function endPointer(e) {
    const p = point(e);
    if (drag && !drag.moved && pointers.size < 2) {
      const world = overlayCam.toWorld(p.x, p.y, p.w, p.h);
      const hit = nearestBuilding(buildings, world.x, world.z, overlayCam.state.metersPerPixel * 28);
      if (hit) {
        overlay.querySelector("[data-map-label]").textContent = hit.name;
        onSelect?.(hit);
      }
    }
    pointers.delete(e.pointerId);
    if (!pointers.size) drag = null;
  }
  big.addEventListener("pointerup", endPointer);
  big.addEventListener("pointercancel", endPointer);
  big.addEventListener("wheel", (e) => {
    e.preventDefault();
    const p = point(e);
    overlayCam.zoomAt(e.deltaY > 0 ? 1.12 : 0.88, p.x, p.y, p.w, p.h);
    paint();
  }, { passive: false });

  function update(state) {
    last = state;
    if (!open) miniCam.centerOn(state.x, state.z);
    paint();
  }

  return { update, expand, collapse, get open() { return open; } };
}
