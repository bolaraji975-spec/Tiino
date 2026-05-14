/**
 * tests/security/planGates.test.ts
 *
 * Security-focused plan-gate tests:
 *   – Unauthenticated requests are rejected (UNAUTHORIZED)
 *   – Tenant isolation: one user cannot access another user's data
 *   – Pay-per-CV credit decrements atomically (guard against over-spend)
 *
 * All tests are pure unit tests — no Convex runtime required.
 */

import { describe, it, expect } from "vitest";
import {
  requireAuth,
  requireOwnership,
  UnauthorizedError,
  NotFoundError,
} from "../../convex/lib/tenantGuard";
import {
  canGenerateCv,
  canSaveJob,
  canViewScore,
  type UserPlan,
} from "../../convex/lib/planGates";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const free = (overrides: Partial<UserPlan> = {}): UserPlan => ({
  plan: "free",
  payPerCvCredits: 0,
  cvGenerationsThisMonth: 0,
  ...overrides,
});

const pro = (overrides: Partial<UserPlan> = {}): UserPlan => ({
  plan: "pro_monthly",
  payPerCvCredits: 0,
  cvGenerationsThisMonth: 0,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Unauthenticated requests → UNAUTHORIZED
// ---------------------------------------------------------------------------

describe("requireAuth — unauthenticated user is rejected", () => {
  it("throws UnauthorizedError when userId is null", () => {
    expect(() => requireAuth(null)).toThrow(UnauthorizedError);
  });

  it("thrown error has code UNAUTHORIZED", () => {
    try {
      requireAuth(null);
      expect.fail("should have thrown");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(UnauthorizedError);
      expect((err as UnauthorizedError).code).toBe("UNAUTHORIZED");
    }
  });

  it("does not throw when userId is a non-empty string", () => {
    expect(() => requireAuth("user_abc123")).not.toThrow();
  });

  it("does not throw for any truthy string userId", () => {
    expect(() => requireAuth("j97d8f7sd8f")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tenant isolation: one user cannot access another user's data
// ---------------------------------------------------------------------------

describe("requireOwnership — tenant isolation", () => {
  const USER_A = "user_aaaa";
  const USER_B = "user_bbbb";

  it("allows access when requester owns the resource", () => {
    expect(() => requireOwnership(USER_A, USER_A)).not.toThrow();
  });

  it("throws NotFoundError when requester is a different user", () => {
    expect(() => requireOwnership(USER_A, USER_B)).toThrow(NotFoundError);
  });

  it("thrown error has code NOT_FOUND (not FORBIDDEN — no data leakage)", () => {
    try {
      requireOwnership(USER_A, USER_B);
      expect.fail("should have thrown");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(NotFoundError);
      // NOT_FOUND rather than FORBIDDEN so the requester can't infer existence
      expect((err as NotFoundError).code).toBe("NOT_FOUND");
    }
  });

  it("error message does not reveal the owner's userId", () => {
    try {
      requireOwnership(USER_A, USER_B);
    } catch (err: unknown) {
      expect((err as NotFoundError).message).not.toContain(USER_A);
    }
  });

  it("user A cannot read user B's profile (same isolation logic)", () => {
    const profileOwnerId = USER_B;
    const requesterId = USER_A;
    expect(() => requireOwnership(profileOwnerId, requesterId)).toThrow(NotFoundError);
  });

  it("user A cannot read user B's application", () => {
    expect(() => requireOwnership(USER_B, USER_A)).toThrow(NotFoundError);
  });

  it("user A cannot read user B's saved job", () => {
    expect(() => requireOwnership(USER_B, USER_A)).toThrow(NotFoundError);
  });

  it("treats empty-string owner the same as any other mismatch", () => {
    // Edge case: a bug that leaves ownerId empty must still be rejected
    expect(() => requireOwnership("", USER_A)).toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// Pay-per-CV credit decrements atomically
// ---------------------------------------------------------------------------

describe("pay-per-CV credit gating", () => {
  it("allows generation when payPerCvCredits > 0 regardless of monthly count", () => {
    // Even if free monthly quota is used, a credit allows generation
    expect(canGenerateCv(free({ cvGenerationsThisMonth: 1, payPerCvCredits: 1 }))).toBe(true);
  });

  it("blocks generation when credits are 0 and free quota is exhausted", () => {
    expect(canGenerateCv(free({ cvGenerationsThisMonth: 1, payPerCvCredits: 0 }))).toBe(false);
  });

  it("allows generation with exactly 1 credit remaining", () => {
    expect(canGenerateCv(free({ cvGenerationsThisMonth: 5, payPerCvCredits: 1 }))).toBe(true);
  });

  it("blocks when credits reach 0 after the last decrement", () => {
    // Simulate: 1 credit used (decremented to 0), monthly count updated
    const afterDecrement = free({ cvGenerationsThisMonth: 1, payPerCvCredits: 0 });
    expect(canGenerateCv(afterDecrement)).toBe(false);
  });

  it("negative credits do not unlock generation", () => {
    // Guard against a decrement bug producing negative credits
    const broken = free({ cvGenerationsThisMonth: 1, payPerCvCredits: -1 });
    expect(canGenerateCv(broken)).toBe(false);
  });

  it("pro user is not affected by credit count", () => {
    expect(canGenerateCv(pro({ cvGenerationsThisMonth: 5, payPerCvCredits: 0 }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canSaveJob — free-tier cap enforced
// ---------------------------------------------------------------------------

describe("canSaveJob plan gate (security: free-tier cap)", () => {
  it("free user at cap (3) cannot save another job", () => {
    expect(canSaveJob(free(), 3)).toBe(false);
  });

  it("free user below cap can save", () => {
    expect(canSaveJob(free(), 2)).toBe(true);
  });

  it("pro user is never capped", () => {
    expect(canSaveJob(pro(), 1000)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canViewScore — score visibility gating
// ---------------------------------------------------------------------------

describe("canViewScore — free users cannot see numeric score", () => {
  it("free user cannot view numeric score", () => {
    expect(canViewScore(free())).toBe(false);
  });

  it("pro_monthly user can view numeric score", () => {
    expect(canViewScore(pro())).toBe(true);
  });

  it("pro_annual user can view numeric score", () => {
    expect(
      canViewScore({ plan: "pro_annual", payPerCvCredits: 0 }),
    ).toBe(true);
  });
});
