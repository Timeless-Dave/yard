// A simple top-down 2D canvas minimap — the real campus is ~500m across
// (the stadium alone is 430m from the Bell Tower), so without this players
// have no way to tell where anything is relative to them.
const KIND_COLORS = {
  landmark: "#f4b223",
  athletics: "#2d6b4a",
  student_life: "#eef0ee",
  academic: "#7a8fb0",
  arts: "#a05fc0",
  admin: "#999999",
  dorm: "#a0724a",
};

export function initMinimap(canvas, { xMin, xMax, zMin, zMax, buildings }) {
  const ctx = canvas.getContext("2d");
  const size = canvas.width; // square canvas, CSS controls display size
  const worldW = xMax - xMin;
  const worldD = zMax - zMin;
  const pad = size * 0.04;

  function toMap(x, z) {
    return [pad + ((x - xMin) / worldW) * (size - pad * 2), pad + ((z - zMin) / worldD) * (size - pad * 2)];
  }

  function drawStatic() {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "rgba(10,20,10,0.55)";
    ctx.fillRect(0, 0, size, size);

    buildings.forEach((b) => {
      const [mx, mz] = toMap(b.x, b.z);
      const r = b.kind === "landmark" ? 3.5 : 2.2;
      ctx.fillStyle = KIND_COLORS[b.kind] || "#888";
      ctx.beginPath();
      ctx.arc(mx, mz, r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.strokeStyle = "rgba(244,178,35,0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);
  }

  drawStatic();

  function update({ x, z, rotY, peers }) {
    drawStatic();
    if (peers) {
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      peers.forEach((p) => {
        if (typeof p.x !== "number") return;
        const [mx, mz] = toMap(p.x, p.z);
        ctx.beginPath();
        ctx.arc(mx, mz, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    const [px, pz] = toMap(x, z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(rotY);
    ctx.fillStyle = "#f4b223";
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(3.5, 4);
    ctx.lineTo(-3.5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  return { update };
}
