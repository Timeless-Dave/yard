import { describe, it, expect } from "vitest";
import { getActiveSeason, isHalloween, isPrettyWednesday } from "../../src/seasonal.js";

// Noon in Pine Bluff (UTC-6 in winter, UTC-5 in summer) expressed in UTC, so
// these hold no matter what timezone the test machine is in.
const campusNoon = (y, m, d) => new Date(Date.UTC(y, m, d, 17, 30));

describe("seasonal", () => {
  it("Pretty Wednesday is every Wednesday and only Wednesday, in campus time", () => {
    expect(isPrettyWednesday(campusNoon(2026, 0, 7))).toBe(true); // Wed
    expect(isPrettyWednesday(campusNoon(2026, 9, 21))).toBe(true); // Wed
    expect(isPrettyWednesday(campusNoon(2026, 9, 18))).toBe(false); // Sun
    expect(isPrettyWednesday(campusNoon(2026, 9, 22))).toBe(false); // Thu
  });

  it("uses campus time, not the player's: 1am Thursday UTC is still Wednesday night in Pine Bluff", () => {
    expect(isPrettyWednesday(new Date(Date.UTC(2026, 0, 8, 1, 0)))).toBe(true);
  });

  it("Halloween runs Oct 1 through Nov 2 inclusive", () => {
    expect(isHalloween(new Date(2026, 9, 1))).toBe(true);
    expect(isHalloween(new Date(2026, 10, 2))).toBe(true);
    expect(isHalloween(new Date(2026, 8, 30))).toBe(false);
    expect(isHalloween(new Date(2026, 10, 3))).toBe(false);
    expect(getActiveSeason(new Date(2026, 0, 7))).toBeNull();
  });
});
