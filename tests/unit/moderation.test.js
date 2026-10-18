import { describe, it, expect } from "vitest";
import { moderateText, containsBlockedLanguage, MAX_LENGTHS } from "../../functions/moderation.js";

describe("containsBlockedLanguage", () => {
  it.each([
    "fuck this",
    "FUUUUCK",
    "you're a b1tch",
    "f u c k",
    "f.u.c.k",
    "n i g g e r",
    "n1gg3r",
    "what a faggot",
    "kys",
    "go kill yourself",
    "send nudes",
    "fucking annoying",
  ])("blocks %j", (text) => {
    expect(containsBlockedLanguage(text)).toBe(true);
  });

  it.each([
    "summa cum laude, class of 2027",
    "pass the class assignment",
    "I'm from Niger originally",
    "shiitake mushrooms at the cafeteria",
    "the flame retardant lab in STEM",
    "spades tonight at the Yard?",
    "Grape Wednesday at the Lions Den",
    "Dawson-Hicks Hall study group",
    "go Golden Lions!",
    "assistant coach meeting",
    "hello",
  ])("allows %j", (text) => {
    expect(containsBlockedLanguage(text)).toBe(false);
  });
});

describe("moderateText", () => {
  it("trims and collapses whitespace", () => {
    expect(moderateText("  hey   yard  ")).toEqual({ ok: true, text: "hey yard" });
  });

  it("rejects empty text", () => {
    expect(moderateText("   ").ok).toBe(false);
  });

  it("enforces max length", () => {
    expect(moderateText("a".repeat(MAX_LENGTHS.chat + 1), { maxLength: MAX_LENGTHS.chat }).ok).toBe(false);
    expect(moderateText("a".repeat(MAX_LENGTHS.chat), { maxLength: MAX_LENGTHS.chat }).ok).toBe(true);
  });

  it.each(["check https://evil.example", "www.scam.com", "free stuff at giveaway.xyz"])("blocks link %j", (t) => {
    expect(moderateText(t)).toMatchObject({ ok: false, reason: expect.stringMatching(/links/i) });
  });

  it.each(["call me 870-555-1234", "text 8705551234", "hit me at someone@gmail.com"])("blocks personal info %j", (t) => {
    expect(moderateText(t)).toMatchObject({ ok: false, reason: expect.stringMatching(/personal info/i) });
  });

  it("rejects non-strings", () => {
    expect(moderateText(42).ok).toBe(false);
  });
});
