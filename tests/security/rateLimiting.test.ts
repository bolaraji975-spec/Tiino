/**
 * tests/security/rateLimiting.test.ts
 *
 * Rate-limit and alert-threshold logic.
 * All tests are pure unit tests — no Convex runtime, no network calls.
 */

import { describe, it, expect } from "vitest";
import { shouldAlertOnDrop } from "../../convex/lib/alerts";
import {
  isLockedOut,
  recordFailedAttempt,
  attemptTriggersLockout,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_WINDOW_MS,
  type AttemptRecord,
} from "../../convex/lib/authRateLimit";

// ---------------------------------------------------------------------------
// shouldAlertOnDrop — sponsor register drop threshold
// ---------------------------------------------------------------------------

describe("shouldAlertOnDrop", () => {
  it("fires on a drop exceeding 20%", () => {
    expect(shouldAlertOnDrop(100_000, 79_000)).toBe(true);
  });

  it("does not fire on exactly 20% drop (strictly greater-than)", () => {
    expect(shouldAlertOnDrop(100_000, 80_000)).toBe(false);
  });

  it("does not fire on a small drop", () => {
    expect(shouldAlertOnDrop(130_000, 128_000)).toBe(false);
  });

  it("does not fire when count is unchanged", () => {
    expect(shouldAlertOnDrop(50_000, 50_000)).toBe(false);
  });

  it("does not fire when previousCount is 0 (avoid division by zero)", () => {
    expect(shouldAlertOnDrop(0, 0)).toBe(false);
    expect(shouldAlertOnDrop(0, 100)).toBe(false);
  });

  it("fires on a total wipeout", () => {
    expect(shouldAlertOnDrop(130_000, 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isLockedOut
// ---------------------------------------------------------------------------

describe("isLockedOut", () => {
  const NOW = 1_700_000_000_000; // fixed ms timestamp

  it("returns false for undefined record (no attempts yet)", () => {
    expect(isLockedOut(undefined, NOW)).toBe(false);
  });

  it("returns false when count is below threshold", () => {
    const record = { count: MAX_FAILED_ATTEMPTS - 1, windowStart: NOW };
    expect(isLockedOut(record, NOW)).toBe(false);
  });

  it("returns true when count equals threshold within window", () => {
    const record = { count: MAX_FAILED_ATTEMPTS, windowStart: NOW };
    expect(isLockedOut(record, NOW)).toBe(true);
  });

  it("returns true when count exceeds threshold within window", () => {
    const record = { count: MAX_FAILED_ATTEMPTS + 3, windowStart: NOW };
    expect(isLockedOut(record, NOW)).toBe(true);
  });

  it("returns false when window has expired even with high count", () => {
    const expiredWindowStart = NOW - LOCKOUT_WINDOW_MS - 1;
    const record = { count: MAX_FAILED_ATTEMPTS + 99, windowStart: expiredWindowStart };
    expect(isLockedOut(record, NOW)).toBe(false);
  });

  it("returns false at exactly the window boundary (expired)", () => {
    const atBoundary = NOW - LOCKOUT_WINDOW_MS;
    const record = { count: MAX_FAILED_ATTEMPTS, windowStart: atBoundary };
    // Strictly greater-than window — exactly at boundary means expired
    expect(isLockedOut(record, NOW)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// recordFailedAttempt
// ---------------------------------------------------------------------------

describe("recordFailedAttempt", () => {
  const NOW = 1_700_000_000_000;
  const EMAIL = "user@example.com";

  it("starts a new record with count=1 for a first attempt", () => {
    const result = recordFailedAttempt(undefined, EMAIL, NOW);
    expect(result.count).toBe(1);
    expect(result.identifier).toBe(EMAIL);
    expect(result.windowStart).toBe(NOW);
  });

  it("increments count within the same window", () => {
    const existing: AttemptRecord = { identifier: EMAIL, count: 2, windowStart: NOW - 1000 };
    const result = recordFailedAttempt(existing, EMAIL, NOW);
    expect(result.count).toBe(3);
    expect(result.windowStart).toBe(NOW - 1000); // window unchanged
  });

  it("resets the window when previous window has expired", () => {
    const old: AttemptRecord = {
      identifier: EMAIL,
      count: 4,
      windowStart: NOW - LOCKOUT_WINDOW_MS - 1,
    };
    const result = recordFailedAttempt(old, EMAIL, NOW);
    expect(result.count).toBe(1); // reset
    expect(result.windowStart).toBe(NOW); // new window
  });

  it("does not mutate the existing record", () => {
    const existing: AttemptRecord = { identifier: EMAIL, count: 1, windowStart: NOW };
    recordFailedAttempt(existing, EMAIL, NOW);
    expect(existing.count).toBe(1); // unchanged
  });
});

// ---------------------------------------------------------------------------
// 5 failed attempts trigger lockout, independent per email
// ---------------------------------------------------------------------------

describe("5 failed attempts trigger lockout", () => {
  const NOW = 1_700_000_000_000;
  const EMAIL_A = "alice@example.com";
  const EMAIL_B = "bob@example.com";

  it(`locks out after exactly ${MAX_FAILED_ATTEMPTS} attempts`, () => {
    let record: AttemptRecord | undefined;
    for (let i = 1; i <= MAX_FAILED_ATTEMPTS; i++) {
      record = recordFailedAttempt(record, EMAIL_A, NOW + i);
    }
    expect(isLockedOut(record, NOW + MAX_FAILED_ATTEMPTS)).toBe(true);
  });

  it(`does not lock out after ${MAX_FAILED_ATTEMPTS - 1} attempts`, () => {
    let record: AttemptRecord | undefined;
    for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) {
      record = recordFailedAttempt(record, EMAIL_A, NOW + i);
    }
    expect(isLockedOut(record, NOW + MAX_FAILED_ATTEMPTS - 1)).toBe(false);
  });

  it("attemptTriggersLockout returns true on the Nth failure", () => {
    let record: AttemptRecord | undefined;
    for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) {
      record = recordFailedAttempt(record, EMAIL_A, NOW + i);
    }
    // This is the triggering attempt
    expect(attemptTriggersLockout(record, EMAIL_A, NOW + MAX_FAILED_ATTEMPTS)).toBe(true);
  });

  it("different emails have independent counters", () => {
    // Accumulate MAX_FAILED_ATTEMPTS failures for EMAIL_A
    let recordA: AttemptRecord | undefined;
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      recordA = recordFailedAttempt(recordA, EMAIL_A, NOW + i);
    }

    // EMAIL_B has only 1 attempt
    const recordB = recordFailedAttempt(undefined, EMAIL_B, NOW);

    expect(isLockedOut(recordA, NOW + MAX_FAILED_ATTEMPTS)).toBe(true);
    expect(isLockedOut(recordB, NOW + 1)).toBe(false);
  });

  it("lockout resets after window expires", () => {
    let record: AttemptRecord | undefined;
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      record = recordFailedAttempt(record, EMAIL_A, NOW + i);
    }
    // Still locked within the window
    expect(isLockedOut(record, NOW + LOCKOUT_WINDOW_MS - 1)).toBe(true);

    // Expired — first attempt in new window resets counter
    record = recordFailedAttempt(record, EMAIL_A, NOW + LOCKOUT_WINDOW_MS + 1);
    expect(record.count).toBe(1);
    expect(isLockedOut(record, NOW + LOCKOUT_WINDOW_MS + 1)).toBe(false);
  });
});
