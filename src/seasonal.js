// Seasons are date-gated so the store and campus decorations change
// automatically — no manual flipping needed. Add more ranges here as
// other seasons/events come up (finals week, spring fling, etc.).
const SEASONS = [
  { id: "halloween", label: "🎃 Harvest Bash", start: [10, 1], end: [11, 2] },
];

function inRange(month, day, [sm, sd], [em, ed]) {
  const t = month * 100 + day;
  const s = sm * 100 + sd;
  const e = em * 100 + ed;
  return s <= e ? t >= s && t <= e : t >= s || t <= e; // handles wraparound
}

export function getActiveSeason(date = new Date()) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return SEASONS.find((s) => inRange(month, day, s.start, s.end)) || null;
}

export function isHalloween(date = new Date()) {
  return getActiveSeason(date)?.id === "halloween";
}

// Weekly, not a date range — and in campus time, so a player in another
// timezone sees the same Wednesday the server pays out on.
export { isCampusWednesday as isPrettyWednesday } from "../functions/gameRules.js";
