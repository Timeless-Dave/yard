// Escape user-controlled text at render time. Never trust that the writer
// escaped it: Firestore rules can't sanitize HTML, so any modified client can
// store raw markup that would otherwise run in every other player's browser.
const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ENTITIES[c]);
}
