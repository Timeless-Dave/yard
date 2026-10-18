// A simple homecoming photo-op arch — gold balloon columns and a banner,
// the kind every HBCU homecoming has somewhere on the Yard for pictures.
import * as THREE from "three";

function canvasTexture(draw, w = 256, h = 128) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export function createPhotoBoothArch(scene, x, z, campusLabel = "UAPB") {
  const group = new THREE.Group();
  const gold = 0xf4b223;
  const black = 0x121212;

  function balloonColumn(px) {
    const col = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const balloon = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 10, 10),
        new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? gold : black })
      );
      balloon.position.set(px, 0.4 + i * 0.5, 0);
      col.add(balloon);
    }
    group.add(col);
    return col;
  }
  balloonColumn(-1.6);
  balloonColumn(1.6);

  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 0.9),
    new THREE.MeshStandardMaterial({
      map: canvasTexture((ctx, w, h) => {
        ctx.fillStyle = "#121212";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#f4b223";
        ctx.lineWidth = 6;
        ctx.strokeRect(4, 4, w - 8, h - 8);
        ctx.fillStyle = "#f4b223";
        ctx.font = "bold 26px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${campusLabel} HOMECOMING`, w / 2, h / 2 - 6);
        ctx.font = "16px sans-serif";
        ctx.fillText("📸 Photo Op", w / 2, h / 2 + 24);
      }, 512, 128),
    })
  );
  banner.position.set(0, 2.5, 0);
  group.add(banner);

  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}
