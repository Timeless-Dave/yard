import * as THREE from 'three';
import { createCharacter, normalizeLook, disposeCharacter, loadCharacterAssets } from './avatar.js';

export function mountCharacterEditor(root, { look, onSave, onClose }) {
  root.innerHTML = `<div class="modal character-editor"><div><h3>Make yourself at home.</h3><p>Choose your look. Every style is available to every gender.</p></div><div class="character-workspace"><div class="character-preview" aria-label="Live character preview"></div><form>
    <label>Gender<select name="gender"><option>Unspecified</option><option>Woman</option><option>Man</option><option>Nonbinary</option><option>Self-described</option></select></label>
    <label>Build<select name="build"><option>Slender</option><option>Balanced</option><option>Broad</option></select></label>
    <label>Hair<select name="hair"><option>Coils</option><option>Close crop</option><option>Locs</option><option>Bun</option><option>Bald</option></select></label>
    <label>Skin tone<input type="color" name="skin"></label><label>Top color<input type="color" name="shirt"></label>
    <label>Height<input type="range" name="height" min="0.85" max="1.15" step="0.01"></label>
    <p class="save-note">Saved on this browser. Hair styles apply to the fallback body. The Kenney mesh (CC0) uses the published skins. Online appearance sync is not available yet.</p><button class="btn btn-primary" type="submit">Save character</button><button class="btn btn-secondary close" type="button">Cancel</button>
  </form></div></div>`;
  const form = root.querySelector('form');
  for (const [key, value] of Object.entries(look)) if (form.elements[key]) form.elements[key].value = value;
  const host = root.querySelector('.character-preview');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); host.append(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, .1, 30);
  camera.position.set(0, 1.8, 5.8); camera.lookAt(0, 1.35, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 2.6)); const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(3, 5, 4); scene.add(light);
  let draft = normalizeLook(look), model = createCharacter(draft); scene.add(model);
  let closed = false;
  loadCharacterAssets().then(() => {
    if (closed) return;
    scene.remove(model); disposeCharacter(model); model = createCharacter(draft); scene.add(model);
  });
  form.oninput = () => { draft = normalizeLook(Object.fromEntries(new FormData(form))); scene.remove(model); disposeCharacter(model); model = createCharacter(draft); scene.add(model); };
  form.onsubmit = e => { e.preventDefault(); try { localStorage.setItem('yard-look-v1', JSON.stringify(draft)); } catch { root.querySelector('.save-note').textContent = 'Storage unavailable. Your look can only last this session.'; onSave(draft); return; } onSave(draft); onClose(); };
  root.querySelector('.close').onclick = onClose;
  const observer = new ResizeObserver(() => { const { width, height } = host.getBoundingClientRect(); renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); }); observer.observe(host);
  const clock = new THREE.Clock();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  renderer.setAnimationLoop(() => { model.rotation.y = reducedMotion.matches ? 0 : Math.sin(clock.elapsedTime * .35) * .35; model.userData.animate(reducedMotion.matches ? 0 : clock.getDelta(), 0); renderer.render(scene, camera); });
  return () => { closed = true; observer.disconnect(); renderer.setAnimationLoop(null); disposeCharacter(model); renderer.dispose(); };
}
