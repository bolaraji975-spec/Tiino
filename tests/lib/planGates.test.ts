import { describe, it, expect } from "vitest";
import {
  canGenerateCv,
  cvBlockReason,
  canSaveJob,
  canViewScore,
  canAccessDigest,
  type UserPlan,
} from "../../convex/lib/planGates";

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
// canGenerateCv
// ---------------------------------------------------------------------------

describe("canGenerateCv", () => {
  it("free with 0 generations: allowed", () => {
    expect(canGenerateCv(free())).toBe(true);
  });

  it("free with 1 generation: blocked", () => {
    expect(canGenerateCv(free({ cvGenerationsThisMonth: 1 }))).toBe(false);
  });

  it("free with 0 generations but has pay-per-cv credit: allowed", () => {
    expect(canGenerateCv(free({ payPerCvCredits: 1 }))).toBe(true);
  });

  it("free with 1 generation but has pay-per-cv credit: allowed via credit", () => {
    expect(canGenerateCv(free({ cvGenerationsThisMonth: 1, payPerCvCredits: 1 }))).toBe(true);
  });

  it("pro with 0 generations: allowed", () => {
    expect(canGenerateCv(pro())).toBe(true);
  });

  it("pro with 19 generations: allowed", () => {
    expect(canGenerateCv(pro({ cvGenerationsThisMonth: 19 }))).toBe(true);
  });

  it("pro with 20 generations: blocked", () => {
    expect(canGenerateCv(pro({ cvGenerationsThisMonth: 20 }))).toBe(false);
  });

  it("pro_annual plan is treated as pro", () => {
    expect(canGenerateCv({ plan: "pro_annual", payPerCvCredits: 0, cvGenerationsThisMonth: 19 })).toBe(true);
    expect(canGenerateCv({ plan: "pro_annual", payPerCvCredits: 0, cvGenerationsThisMonth: 20 })).toBe(false);
  });

  it("missing cvGenerationsThisMonth defaults to 0", () => {
    expect(canGenerateCv({ plan: "free", payPerCvCredits: 0 })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cvBlockReason
// ---------------------------------------------------------------------------

describe("cvBlockReason", () => {
  it("returns null when allowed", () => {
    expect(cvBlockReason(free())).toBeNull();
  });

  it("returns free-plan message when free limit hit", () => {
    const reason = cvBlockReason(free({ cvGenerationsThisMonth: 1 }));
    expect(reason).not.toBeNull();
    expect(reason).toMatch(/free/i);
  });

  it("returns pro limit message when pro limit hit", () => {
    const reason = cvBlockReason(pro({ cvGenerationsThisMonth: 20 }));
    expect(reason).not.toBeNull();
    expect(reason).toMatch(/20/);
  });
});

// ---------------------------------------------------------------------------
// canSaveJob
// ---------------------------------------------------------------------------

describe("canSaveJob", () => {
  it("free with 0 saves: allowed", () => {
    expect(canSaveJob(free(), 0)).toBe(true);
  });

  it("free with 2 saves: allowed", () => {
    expect(canSaveJob(free(), 2)).toBe(true);
  });

  it("free with 3 saves: blocked", () => {
    expect(canSaveJob(free(), 3)).toBe(false);
  });

  it("pro with 100 saves: allowed", () => {
    expect(canSaveJob(pro(), 100)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canViewScore
// ---------------------------------------------------------------------------

describe("canViewScore", () => {
  it("free: false", () => expect(canViewScore(free())).toBe(false));
  it("pro_monthly: true", () => expect(canViewScore(pro())).toBe(true));
  it("pro_annual: true", () => expect(canViewScore({ plan: "pro_annual", payPerCvCredits: 0 })).toBe(true));
});

// ---------------------------------------------------------------------------
// canAccessDigest
// ---------------------------------------------------------------------------

describe("canAccessDigest", () => {
  it("free: false", () => expect(canAccessDigest(free())).toBe(false));
  it("pro: true", () => expect(canAccessDigest(pro())).toBe(true));
});
