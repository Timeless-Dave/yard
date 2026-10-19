import { playClick, playSuccess } from "../sound.js";
import { unlockAchievement } from "../achievements.js";

function compositeFrame(rawDataUrl, campusLabel) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const pad = 36;
      const bottomBand = 70;
      const canvas = document.createElement("canvas");
      canvas.width = img.width + pad * 2;
      canvas.height = img.height + pad * 2 + bottomBand;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#f4f0e4";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, pad, pad);
      ctx.strokeStyle = "#f4b223";
      ctx.lineWidth = 6;
      ctx.strokeRect(pad - 3, pad - 3, img.width + 6, img.height + 6);
      ctx.fillStyle = "#121212";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${campusLabel} HOMECOMING · THE YARD`, canvas.width / 2, canvas.height - bottomBand / 2 + 4);
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#555";
      ctx.fillText(new Date().toLocaleDateString(), canvas.width / 2, canvas.height - 16);
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = rawDataUrl;
  });
}

export function mountPhotoBooth(root, { onClose, capture, campusLabel = "UAPB" } = {}) {
  root.innerHTML = `
    <div class="modal">
      <h3>📸 Photo Op</h3>
      <p>Strike a pose — this snapshots the Yard right where you're standing.</p>
      <div id="pb-preview" style="min-height:120px;display:flex;align-items:center;justify-content:center;"></div>
      <button class="btn btn-primary" id="pb-shoot" style="width:100%;">📸 Smile!</button>
      <a id="pb-download" class="btn btn-secondary" style="width:100%;margin-top:8px;display:none;text-align:center;text-decoration:none;" download="the-yard-homecoming.png">⬇️ Download photo</a>
      <button class="btn btn-secondary close" style="width:100%;margin-top:8px;">Close</button>
    </div>`;

  root.querySelector("#pb-shoot").addEventListener("click", async () => {
    playClick();
    if (!capture) return;
    const raw = capture();
    const framed = await compositeFrame(raw, campusLabel);
    const preview = root.querySelector("#pb-preview");
    preview.innerHTML = `<img src="${framed}" style="max-width:100%;border-radius:0;" />`;
    const dl = root.querySelector("#pb-download");
    dl.href = framed;
    dl.style.display = "block";
    playSuccess();
    unlockAchievement("photo_op");
  });

  root.querySelector(".close").addEventListener("click", () => onClose?.());
}
