// Shared text moderation — imported by both the browser (instant feedback
// before a write) and Cloud Functions (re-checks every write server-side,
// since a modified client can skip the browser check entirely).
// Pure ESM, no dependencies.

export const MAX_LENGTHS = {
  displayName: 24,
  chat: 200,
  corkboard: 140,
  nominee: 30,
  partyTitle: 40,
};

// Each entry is a word whose letters may each repeat ("fuuuck"), matched
// against whole tokens. `suffix: true` also catches inflections
// ("fucking", "fucker"); off for words that start innocent ones.
const TERMS = [
  // slurs / hate
  { w: "nigger", suffix: true },
  { w: "nigga", suffix: true },
  { w: "faggot", suffix: true },
  { w: "fag", suffix: false },
  { w: "dyke", suffix: false },
  { w: "tranny", suffix: false },
  { w: "retard", suffix: false },
  { w: "retarded", suffix: false },
  { w: "spic", suffix: false },
  { w: "chink", suffix: false },
  { w: "kike", suffix: false },
  { w: "wetback", suffix: true },
  { w: "coon", suffix: false },
  { w: "jigaboo", suffix: true },
  { w: "porchmonkey", suffix: true },
  { w: "beaner", suffix: true },
  { w: "gook", suffix: false },
  { w: "raghead", suffix: true },
  { w: "towelhead", suffix: true },
  // sexual / explicit
  { w: "porn", suffix: true },
  { w: "pussy", suffix: true },
  { w: "dick", suffix: false },
  { w: "dickhead", suffix: false },
  { w: "cock", suffix: false },
  { w: "cocksucker", suffix: true },
  { w: "cunt", suffix: true },
  { w: "blowjob", suffix: true },
  { w: "handjob", suffix: true },
  { w: "rape", suffix: false },
  { w: "rapist", suffix: true },
  { w: "nudes", suffix: false },
  { w: "dildo", suffix: true },
  { w: "milf", suffix: false },
  { w: "whore", suffix: true },
  { w: "slut", suffix: true },
  { w: "hoe", suffix: false },
  { w: "thot", suffix: false },
  // strong profanity / harassment
  { w: "fuck", suffix: true },
  { w: "motherfucker", suffix: true },
  // suffix off: "shiitake" would otherwise match
  { w: "shit", suffix: false },
  { w: "shitty", suffix: false },
  { w: "bullshit", suffix: true },
  { w: "bitch", suffix: true },
  { w: "bastard", suffix: true },
  { w: "asshole", suffix: true },
  { w: "kys", suffix: false },
];

// Severe terms also checked against the text with spaces and punctuation
// removed, to catch "n i g g e r" / "f.a.g.g.o.t" evasion. Kept to long,
// distinctive words so innocent text can't accidentally form them.
const SEVERE_SQUASHED = ["nigger", "nigga", "faggot", "jigaboo", "porchmonkey", "cocksucker", "motherfucker"];

const PHRASES = [/\bkill\s+(your\s*self|urself|yourself)\b/, /\bgo\s+die\b/, /\bhope\s+you\s+die\b/];

const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", 8: "b", "@": "a", $: "s", "!": "i", "|": "i", "+": "t" };

const URL_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|app|gg|xyz|ly|co|me|tv|link|site|info|biz)\b)/i;
const PHONE_RE = /\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/;
const EMAIL_RE = /\b[^\s@]+@[^\s@]+\.[a-z]{2,}\b/i;

function letterPattern(word) {
  return word
    .split("")
    .map((c) => `${c}+`)
    .join("");
}

const TOKEN_RES = TERMS.map(({ w, suffix }) => new RegExp(`^${letterPattern(w)}${suffix ? "[a-z]*" : "s?"}$`));
const SQUASHED_RES = SEVERE_SQUASHED.map((w) => new RegExp(letterPattern(w)));

function normalize(text) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[0134578@$!|+]/g, (c) => LEET[c] ?? c);
}

function tokens(normalized) {
  const raw = normalized.split(/[^a-z]+/).filter(Boolean);
  // Re-join runs of single letters so "f u c k" is checked as "fuck".
  const out = [];
  let run = "";
  for (const t of raw) {
    if (t.length === 1) {
      run += t;
      continue;
    }
    if (run) out.push(run);
    run = "";
    out.push(t);
  }
  if (run) out.push(run);
  return out;
}

export function containsBlockedLanguage(text) {
  const n = normalize(text);
  if (tokens(n).some((t) => TOKEN_RES.some((re) => re.test(t)))) return true;
  const squashed = n.replace(/[^a-z]/g, "");
  if (SQUASHED_RES.some((re) => re.test(squashed))) return true;
  const spaced = n.replace(/[^a-z]+/g, " ");
  return PHRASES.some((re) => re.test(spaced));
}

// Returns { ok: true, text } with the trimmed text, or { ok: false, reason }
// with a short, player-facing reason.
export function moderateText(input, { maxLength, allowEmpty = false } = {}) {
  if (typeof input !== "string") return { ok: false, reason: "That isn't valid text." };
  const text = input.replace(/\s+/g, " ").trim();
  if (!text && !allowEmpty) return { ok: false, reason: "Write something first." };
  if (maxLength && text.length > maxLength) return { ok: false, reason: `Keep it under ${maxLength} characters.` };
  if (EMAIL_RE.test(text) || PHONE_RE.test(text)) {
    return { ok: false, reason: "Don't post phone numbers or emails — keep personal info off the Yard." };
  }
  if (URL_RE.test(text)) return { ok: false, reason: "Links aren't allowed here." };
  if (containsBlockedLanguage(text)) return { ok: false, reason: "That message breaks the community guidelines." };
  return { ok: true, text };
}
