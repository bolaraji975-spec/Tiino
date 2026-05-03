import { describe, it, expect } from "vitest";
import { computeSnapshotDiff } from "../../convex/sponsors/refresh";

describe("computeSnapshotDiff", () => {
  // --- First snapshot (no previous) ---

  it("returns undefined for both fields when there is no previous snapshot", () => {
    const result = computeSnapshotDiff(130_000, undefined, "ok");
    expect(result.addedSinceLast).toBeUndefined();
    expect(result.removedSinceLast).toBeUndefined();
  });

  // --- Growth between snapshots ---

  it("reports addedSinceLast when active count increases", () => {
    const result = computeSnapshotDiff(131_000, 130_000, "ok");
    expect(result.addedSinceLast).toBe(1_000);
    expect(result.removedSinceLast).toBe(0);
  });

  it("reports removedSinceLast when active count decreases", () => {
    const result = computeSnapshotDiff(128_000, 130_000, "ok");
    expect(result.addedSinceLast).toBe(0);
    expect(result.removedSinceLast).toBe(2_000);
  });

  it("reports zero for both fields when active count is unchanged", () => {
    const result = computeSnapshotDiff(130_000, 130_000, "ok");
    expect(result.addedSinceLast).toBe(0);
    expect(result.removedSinceLast).toBe(0);
  });

  // --- Error status ---

  it("returns undefined for both fields when current status is error", () => {
    const result = computeSnapshotDiff(0, 130_000, "error");
    expect(result.addedSinceLast).toBeUndefined();
    expect(result.removedSinceLast).toBeUndefined();
  });

  it("returns undefined for both fields when status is error and no previous", () => {
    const result = computeSnapshotDiff(0, undefined, "error");
    expect(result.addedSinceLast).toBeUndefined();
    expect(result.removedSinceLast).toBeUndefined();
  });

  // --- Edge values ---

  it("never returns negative values (clamps to 0)", () => {
    // Should not happen in practice, but the function must be defensive
    const up = computeSnapshotDiff(100, 100, "ok");
    expect(up.addedSinceLast).toBeGreaterThanOrEqual(0);
    expect(up.removedSinceLast).toBeGreaterThanOrEqual(0);
  });

  it("handles a large one-week drop correctly (>20% threshold used in ticket 010)", () => {
    // 130,000 → 100,000 is a 23% drop — the kind that should trigger an alert
    const result = computeSnapshotDiff(100_000, 130_000, "ok");
    expect(result.removedSinceLast).toBe(30_000);
    expect(result.addedSinceLast).toBe(0);

    const dropPercent =
      (result.removedSinceLast! / 130_000) * 100;
    expect(dropPercent).toBeCloseTo(23.08, 1);
  });

  it("handles a first-ever snapshot with a non-trivial count", () => {
    // Simulates the very first register load — no diff is meaningful
    const result = computeSnapshotDiff(129_847, undefined, "ok");
    expect(result.addedSinceLast).toBeUndefined();
    expect(result.removedSinceLast).toBeUndefined();
  });
});
