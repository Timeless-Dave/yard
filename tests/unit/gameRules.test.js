import { describe, it, expect } from "vitest";
import { evaluateEarn, ACHIEVEMENT_IDS, DAILY_EARN_CAP, campusDay } from "../../functions/gameRules.js";

const WED = new Date(Date.UTC(2026, 0, 7, 18)); // noon Wed in Pine Bluff
const THU = new Date(Date.UTC(2026, 0, 8, 18));

describe("evaluateEarn", () => {
  it("server decides graded payouts from the grade, not the client", () => {
    expect(evaluateEarn({ source: "stepshow", grade: "S" }, {}, WED).amount).toBe(100);
    expect(evaluateEarn({ source: "stepshow", grade: "C" }, {}, WED).amount).toBe(15);
    expect(evaluateEarn({ source: "stepshow", grade: "Z" }, {}, WED).error).toMatch(/grade/);
  });

  it("rejects unknown sources — a client can't invent a payout", () => {
    expect(evaluateEarn({ source: "free_money" }, {}, WED).error).toMatch(/unknown/);
  });

  it("enforces per-source cooldowns", () => {
    const log = { day: campusDay(WED), earnedToday: 15, lastAt: { spades_win: WED.getTime() - 10_000 } };
    expect(evaluateEarn({ source: "spades_win" }, log, WED).error).toBe("cooldown");
    const later = new Date(WED.getTime() + 60_000);
    expect(evaluateEarn({ source: "spades_win" }, log, later).amount).toBe(15);
  });

  it("band cheer pays once per day, not once per click", () => {
    const log = { day: campusDay(WED), earnedToday: 10, lastDay: { band_cheer: campusDay(WED) } };
    expect(evaluateEarn({ source: "band_cheer" }, log, WED).error).toMatch(/today/);
    expect(evaluateEarn({ source: "band_cheer" }, log, THU).amount).toBe(10);
  });

  it("Lions Den pays only on Wednesdays, once", () => {
    expect(evaluateEarn({ source: "lions_den" }, {}, WED).amount).toBe(15);
    expect(evaluateEarn({ source: "lions_den" }, {}, THU).error).toMatch(/Wednesday/);
    const log = { day: campusDay(WED), earnedToday: 15, lastDay: { lions_den: campusDay(WED) } };
    expect(evaluateEarn({ source: "lions_den" }, log, WED).error).toMatch(/today/);
  });

  it("each achievement pays once, and only real achievements pay", () => {
    expect(evaluateEarn({ source: "achievement", achievementId: "voter" }, {}, WED).amount).toBe(25);
    expect(
      evaluateEarn({ source: "achievement", achievementId: "voter" }, { claimedAchievements: { voter: true } }, WED).error
    ).toMatch(/already/);
    expect(evaluateEarn({ source: "achievement", achievementId: "made_up" }, {}, WED).error).toMatch(/unknown/);
  });

  it("enforces the daily cap, and the cap resets the next campus day", () => {
    const log = { day: campusDay(WED), earnedToday: DAILY_EARN_CAP - 10 };
    expect(evaluateEarn({ source: "stepshow", grade: "S" }, log, WED).error).toMatch(/cap/);
    expect(evaluateEarn({ source: "stepshow", grade: "S" }, log, THU).amount).toBe(100);
  });
});

describe("achievement ids", () => {
  it("server list matches the client's achievement definitions exactly", async () => {
    // achievements.js pulls in Firebase at import; mock-free check by parsing ids.
    const { readFile } = await import("node:fs/promises");
    const src = await readFile(new URL("../../src/achievements.js", import.meta.url), "utf8");
    const clientIds = [...src.matchAll(/\{\s*id:\s*"([a-z_]+)"/g)].map((m) => m[1]);
    expect(clientIds.sort()).toEqual([...ACHIEVEMENT_IDS].sort());
  });
});
