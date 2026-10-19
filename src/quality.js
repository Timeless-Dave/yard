const KEY = 'yard-quality-v1';
const LEVELS = ['low', 'medium', 'high'];

export function readQuality() {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
  return LEVELS.includes(saved) ? saved : 'medium';
}

export function nextQuality(current) {
  return LEVELS[(LEVELS.indexOf(current) + 1) % LEVELS.length];
}

export function qualityLabel(level) {
  return `Quality: ${level[0].toUpperCase()}${level.slice(1)}`;
}

export function applyQuality(level, { renderer, sun } = {}) {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const caps = {
    low: { pixel: 1, shadows: false, map: 512, npc: false },
    medium: { pixel: Math.min(dpr, 1.25), shadows: true, map: 1024, npc: true },
    high: { pixel: Math.min(dpr, 2), shadows: true, map: 2048, npc: true },
  }[level] || { pixel: 1, shadows: true, map: 1024, npc: true };
  if (renderer) {
    renderer.setPixelRatio(caps.pixel);
    renderer.shadowMap.enabled = caps.shadows;
  }
  if (sun) {
    sun.castShadow = caps.shadows;
    sun.shadow.mapSize.set(caps.map, caps.map);
  }
  try { localStorage.setItem(KEY, level); } catch { /* ignore */ }
  return caps;
}
