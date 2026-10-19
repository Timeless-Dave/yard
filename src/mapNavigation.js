import * as THREE from 'three';
import { createRoutePlanner } from './routePlanner.js';

export function createCampusNavigation({ scene, world, bounds, roads, buildings, getPosition, onClose }) {
  const plan = createRoutePlanner(world, bounds, roads);
  let route = [], destination = null, line = null, lastRefresh = 0, routeIndex = 0;
  const badge = document.createElement('div'); badge.className = 'route-status hidden'; badge.innerHTML = '<span></span><button aria-label="Cancel route">×</button>'; document.getElementById('app').append(badge);
  badge.querySelector('button').onclick = cancel;
  function cancel() { route = []; destination = null; if (line) { scene.remove(line); line.geometry.dispose(); line.material.dispose(); line = null; } badge.classList.add('hidden'); }
  function choose(building) {
    const target = building.entrance || world.nearestClear({ x: building.x, z: building.z + building.d / 2 + 2 });
    if (!target) return false;
    const path = plan(getPosition(), target); if (!path) return false;
    cancel(); destination = building; route = path; routeIndex = 0;
    const geometry = new THREE.BufferGeometry().setFromPoints(route.map(p => new THREE.Vector3(p.x, .13, p.z)));
    line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#ffd56a', depthTest: false })); line.renderOrder = 5; scene.add(line); badge.classList.remove('hidden');
    return true;
  }
  function mount(root) {
    root.innerHTML = '<div class="modal destination-modal"><h3>Find a place at UAPB</h3><label>Search buildings<input id="destination-search" type="search" placeholder="Library, Student Union, Caldwell…"></label><p class="map-attribution">Map geometry © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>. Game routes are not official campus directions.</p><div class="destination-list"></div><p class="route-error" role="status"></p><button class="btn btn-secondary close">Close</button></div>';
    const list = root.querySelector('.destination-list');
    function render(query = '') {
      list.replaceChildren();
      buildings.filter(b => b.name.toLowerCase().includes(query.toLowerCase())).forEach(b => {
        const button = document.createElement('button'); button.className = 'destination-row';
        const label = document.createElement('strong'); label.textContent = b.name;
        const detail = document.createElement('span'); detail.textContent = b.enterable ? 'Route to the door. Interior available.' : 'Route to the building. Exterior only.';
        button.append(label, detail); button.onclick = () => { if (choose(b)) onClose(); else root.querySelector('.route-error').textContent = 'No clear route from here. Move into an open area and try again.'; }; list.append(button);
      });
      if (!list.childElementCount) list.textContent = 'No matching building.';
    }
    root.querySelector('input').oninput = e => render(e.target.value); root.querySelector('.close').onclick = onClose; render();
  }
  function update(time, indoors) {
    badge.classList.toggle('hidden', !destination || indoors);
    if (!destination || time - lastRefresh < .25) return; lastRefresh = time;
    const p = getPosition(), end = route.at(-1);
    let nearest = routeIndex, distance = Infinity;
    for (let i = routeIndex; i < route.length; i++) { const d = Math.hypot(p.x - route[i].x, p.z - route[i].z); if (d < distance) { distance = d; nearest = i; } }
    routeIndex = nearest;
    let remaining = Math.hypot(p.x - route[nearest].x, p.z - route[nearest].z);
    for (let i = nearest + 1; i < route.length; i++) remaining += Math.hypot(route[i].x - route[i-1].x, route[i].z - route[i-1].z);
    badge.querySelector('span').textContent = Math.hypot(p.x - end.x, p.z - end.z) < 2.5 ? `Arrived at ${destination.name}${destination.enterable ? '. Press E to enter.' : '.'}` : `${destination.name}: ${Math.ceil(remaining / .35)} m of modeled route${distance > 8 ? '. Return to the gold line.' : ''}`;
  }
  return { mount, choose, update, cancel, get route() { return route; } };
}
