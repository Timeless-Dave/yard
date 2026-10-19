const CAMPUS_TIMEZONE = 'America/Chicago';

// Published UAPB 2025-26 double-room semester dollars, used only to rank
// in-game Yard Coin prices. This is not real rent. JBJ is priced highest
// because it is the upperclass honor-suite complex (30 hours, 2.5 GPA).
// Delta II lists a higher dollar double rate on the sheet.
export const HALLS = [
  { id: 'holiday', match: /holiday/i, name: 'Holiday Hall', coins: 180, band: 'Traditional hall', note: 'Other residence halls, lowest published double rate.' },
  { id: 'larrison', match: /larrison/i, name: 'Larrison Hall', coins: 180, band: 'Traditional hall', note: 'Other residence halls band on the 2025-26 sheet.' },
  { id: 'woodard', match: /woodard|woodward/i, name: 'Woodard Hall', coins: 180, band: 'Traditional hall', note: 'Other residence halls band on the 2025-26 sheet.' },
  { id: 'harrold', match: /harrold/i, name: 'Harrold Complex', coins: 200, band: 'Freshman living/learning', note: 'Harrold Living/Learning Center. Freshman population on the Residential Life list.' },
  { id: 'delta', match: /delta/i, name: 'Delta Housing Complex', coins: 230, band: 'Apartment-style', note: 'Delta I/II are among the highest published dollar rates. Res Life office is in Delta II.' },
  { id: 'jbj', match: /johnny b\.? johnson|j\.?b\.?j/i, name: 'Johnny B. Johnson Complex', coins: 280, band: 'Honor suites', note: 'Nine buildings, suite kitchens, 30 credit hours and 2.5 GPA in real life. Highest Yard Coin price.' },
];

const LEASE_KEY = 'yard-lease-v1';

export function hallForBuilding(building) {
  const name = String(building?.name || '');
  return HALLS.find(h => h.match.test(name)) || null;
}

function chicagoParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CAMPUS_TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(p => [p.type, p.value]));
}

// Residential Life handbook: Sun-Thu 5pm-12am, Fri-Sat 5pm-1am.
// JBJ page says weeknights end at 10pm; we use the campus-wide handbook hours.
export function visitationWindow(date = new Date()) {
  const p = chicagoParts(date);
  const weekend = p.weekday === 'Fri' || p.weekday === 'Sat';
  return { startHour: 17, endHour: weekend ? 25 : 24, weekend, weekday: p.weekday };
}

export function visitationOpen(date = new Date()) {
  const p = chicagoParts(date);
  const hour = Number(p.hour) + Number(p.minute) / 60;
  const { startHour, endHour } = visitationWindow(date);
  const hours = hour < 5 ? hour + 24 : hour;
  return hours >= startHour && hours < endHour;
}

export function visitationLabel(date = new Date()) {
  const open = visitationOpen(date);
  const { weekend } = visitationWindow(date);
  const span = weekend ? 'Fri-Sat 5pm-1am' : 'Sun-Thu 5pm-midnight';
  return open ? `Visiting hours are open (${span}, campus time).` : `Front desk. Visiting hours ${span}, America/Chicago.`;
}

export function loadLease() {
  try { return JSON.parse(localStorage.getItem(LEASE_KEY) || 'null'); } catch { return null; }
}

export function saveLease(lease) {
  try {
    if (!lease) localStorage.removeItem(LEASE_KEY);
    else localStorage.setItem(LEASE_KEY, JSON.stringify(lease));
  } catch { /* private mode */ }
  return lease;
}

export function holdsLease(building, lease = loadLease()) {
  const hall = hallForBuilding(building);
  return Boolean(hall && lease?.hallId === hall.id);
}

export function accessFor(building, { lease = loadLease(), now = new Date() } = {}) {
  const hall = hallForBuilding(building);
  if (!hall) return { hall: null, enter: false, mode: null, reason: null };
  if (holdsLease(building, lease)) return { hall, enter: true, mode: 'room', reason: `Your leased room in ${hall.name}. Illustrative interior.` };
  if (visitationOpen(now)) return { hall, enter: true, mode: 'lobby', reason: visitationLabel(now) };
  return { hall, enter: false, mode: null, reason: visitationLabel(now) };
}
