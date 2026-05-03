import { describe, it, expect } from "vitest";
import { shouldAlertOnDrop } from "../../convex/lib/alerts";

describe("shouldAlertOnDrop", () => {
  // --- The DOD scenario: 25% drop must trigger an alert ---

  it("fires on a 25% drop (130k → 97.5k)", () => {
    expect(shouldAlertOnDrop(130_000, 97_500)).toBe(true);
  });

  // --- Boundary: threshold is strictly greater-than 20%, not >=  ---

  it("does not fire on exactly 20% drop", () => {
    // 130,000 × 0.80 = 104,000 → exactly 20% drop
    expect(shouldAlertOnDrop(130_000, 104_000)).toBe(false);
  });

  it("fires on a drop just above 20%", () => {
    // 103,999 / 130,000 = 20.0008% drop
    expect(shouldAlertOnDrop(130_000, 103_999)).toBe(true);
  });

  // --- Normal weekly variance: should not alert ---

  it("does not fire on a 1% drop", () => {
    expect(shouldAlertOnDrop(130_000, 128_700)).toBe(false);
  });

  it("does not fire when count is unchanged", () => {
    expect(shouldAlertOnDrop(130_000, 130_000)).toBe(false);
  });

  it("does not fire when count increases", () => {
    expect(shouldAlertOnDrop(130_000, 131_500)).toBe(false);
  });

  // --- Edge cases ---

  it("does not fire when previousActiveCount is 0 (avoids division by zero)", () => {
    expect(shouldAlertOnDrop(0, 0)).toBe(false);
  });

  it("does not fire when previousActiveCount is 0 and currentActiveCount is also 0", () => {
    expect(shouldAlertOnDrop(0, 100)).toBe(false);
  });

  it("fires on a total wipeout (100% drop)", () => {
    expect(shouldAlertOnDrop(130_000, 0)).toBe(true);
  });

  // --- Custom threshold ---

  it("respects a custom 10% threshold — fires at 11% drop", () => {
    // 130,000 → 115,700 = ~11.0% drop
    expect(shouldAlertOnDrop(130_000, 115_700, 0.10)).toBe(true);
  });

  it("respects a custom 10% threshold — does not fire at 9% drop", () => {
    // 130,000 → 118,300 = ~9.0% drop
    expect(shouldAlertOnDrop(130_000, 118_300, 0.10)).toBe(false);
  });

  it("respects a custom 50% threshold — does not fire at 25% drop", () => {
    expect(shouldAlertOnDrop(130_000, 97_500, 0.50)).toBe(false);
  });
});
