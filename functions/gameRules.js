// Economy rules shared by the browser (to show what a round pays) and Cloud
// Functions (which decide what actually gets paid). The client only says
// *what happened* (source + grade); the server picks the amount and enforces
// cooldowns, one-time rewards, and a daily cap, so a modified client can't
// mint coins by calling earnCoins in a loop.
//
// Minigames run in the browser, so the server can't prove a round was really
// won — these limits bound what a cheater can gain rather than prevent it.

export const GRADE_COINS = { S: 100, A: 70, B: 40, C: 15 };
export const ACHIEVEMENT_BONUS = 25;
export const DAILY_EARN_CAP = 1000;
export const CAMPUS_TIMEZONE = "America/Chicago";

export const EARN_SOURCES = {
  spades_win: { amount: 15, cooldownSec: 45 },
  dominoes_win: { amount: 20, cooldownSec: 45 },
  dominoes_blocked_win: { amount: 12, cooldownSec: 45 },
  cookout: { graded: true, cooldownSec: 30 },
  hopscotch: { graded: true, cooldownSec: 30 },
  doubledutch: { graded: true, cooldownSec: 30 },
  pager: { graded: true, cooldownSec: 30 },
  stepshow: { graded: true, cooldownSec: 30 },
  band_cheer: { amount: 10, oncePerDay: true },
  lions_den: { amount: 15, oncePerDay: true, wednesdayOnly: true },
};

export const ACHIEVEMENT_IDS = [
  "first_steps",
  "card_shark",
  "domino_king",
  "step_perfect",
  "page_me",
  "grill_master",
  "voter",
  "plot_owner",
  "party_people",
  "shopper",
  "fresh_fit",
  "corkboard_poster",
  "night_owl",
  "band_fan",
  "photo_op",
  "rope_champ",
  "hopscotch_champ",
  "dj_yard",
  "yard_talk",
  "pretty_wednesday",
];

function campusParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPUS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

// "YYYY-MM-DD" in campus time — the day boundary for daily caps.
export function campusDay(date = new Date()) {
  const p = campusParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function isCampusWednesday(date = new Date()) {
  return campusParts(date).weekday === "Wed";
}

// Returns { amount } or { error } for an earn request, given the player's
// earn log ({ day, earnedToday, lastAt: {source: ms}, lastDay: {source: day},
// claimedAchievements: {id: true} }). Pure, so it's unit-testable without
// Firestore.
export function evaluateEarn({ source, grade, achievementId }, log = {}, now = new Date()) {
  const today = campusDay(now);
  const earnedToday = log.day === today ? log.earnedToday || 0 : 0;

  let amount;
  if (source === "achievement") {
    if (!ACHIEVEMENT_IDS.includes(achievementId)) return { error: "unknown achievement" };
    if (log.claimedAchievements?.[achievementId]) return { error: "already claimed" };
    amount = ACHIEVEMENT_BONUS;
  } else {
    const rule = EARN_SOURCES[source];
    if (!rule) return { error: "unknown source" };
    if (rule.graded) {
      amount = GRADE_COINS[grade];
      if (!amount) return { error: "invalid grade" };
    } else {
      amount = rule.amount;
    }
    if (rule.wednesdayOnly && !isCampusWednesday(now)) return { error: "only on Wednesdays" };
    if (rule.oncePerDay && log.lastDay?.[source] === today) return { error: "already claimed today" };
    const last = log.lastAt?.[source];
    if (rule.cooldownSec && last && now.getTime() - last < rule.cooldownSec * 1000) return { error: "cooldown" };
  }

  if (earnedToday + amount > DAILY_EARN_CAP) return { error: "daily cap reached" };
  return { amount, today, earnedToday: earnedToday + amount };
}
