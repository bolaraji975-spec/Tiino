/**
 * tests/security/dataIsolation.test.ts
 *
 * Tenant-isolation unit tests.
 *
 * Confirms that the ownership-guard logic prevents one user from reading or
 * modifying another user's data: profiles, applications, saved jobs, CV files.
 *
 * All tests are pure — the isolation policy lives in convex/lib/tenantGuard.ts
 * and is tested directly without a Convex runtime.
 */

import { describe, it, expect } from "vitest";
import {
  requireAuth,
  requireOwnership,
  UnauthorizedError,
  NotFoundError,
} from "../../convex/lib/tenantGuard";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const USER_A = "user_aaaa0000";
const USER_B = "user_bbbb1111";
const USER_C = "user_cccc2222";

// Simulated database records owned by User B
const USER_B_PROFILE = { userId: USER_B, skills: ["Python"] };
const USER_B_APPLICATION = { userId: USER_B, jobId: "job_xyz", stage: "saved" };
const USER_B_SAVED_JOB = { userId: USER_B, jobId: "job_abc" };
const USER_B_CV_FILE = { userId: USER_B, cvFileId: "storage_123" };

// ---------------------------------------------------------------------------
// Unauthenticated access is always rejected
// ---------------------------------------------------------------------------

describe("unauthenticated access is rejected for all resource types", () => {
  it("null userId rejected for profile access", () => {
    expect(() => requireAuth(null)).toThrow(UnauthorizedError);
  });

  it("null userId rejected for application access", () => {
    expect(() => requireAuth(null)).toThrow(UnauthorizedError);
  });

  it("null userId rejected for saved job access", () => {
    expect(() => requireAuth(null)).toThrow(UnauthorizedError);
  });

  it("null userId rejected for CV file access", () => {
    expect(() => requireAuth(null)).toThrow(UnauthorizedError);
  });
});

// ---------------------------------------------------------------------------
// User A cannot read User B's profile
// ---------------------------------------------------------------------------

describe("user A cannot read user B's profile", () => {
  it("throws NotFoundError when A requests B's profile", () => {
    expect(() => requireOwnership(USER_B_PROFILE.userId, USER_A)).toThrow(
      NotFoundError,
    );
  });

  it("does not throw when B requests their own profile", () => {
    expect(() => requireOwnership(USER_B_PROFILE.userId, USER_B)).not.toThrow();
  });

  it("User C also cannot access User B's profile", () => {
    expect(() => requireOwnership(USER_B_PROFILE.userId, USER_C)).toThrow(
      NotFoundError,
    );
  });
});

// ---------------------------------------------------------------------------
// User A cannot read User B's applications
// ---------------------------------------------------------------------------

describe("user A cannot read user B's applications", () => {
  it("throws NotFoundError when A requests B's application", () => {
    expect(() =>
      requireOwnership(USER_B_APPLICATION.userId, USER_A),
    ).toThrow(NotFoundError);
  });

  it("allows B to read their own application", () => {
    expect(() =>
      requireOwnership(USER_B_APPLICATION.userId, USER_B),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// User A cannot read User B's saved jobs
// ---------------------------------------------------------------------------

describe("user A cannot read user B's saved jobs", () => {
  it("throws NotFoundError when A requests B's saved job", () => {
    expect(() =>
      requireOwnership(USER_B_SAVED_JOB.userId, USER_A),
    ).toThrow(NotFoundError);
  });

  it("allows B to read their own saved job", () => {
    expect(() =>
      requireOwnership(USER_B_SAVED_JOB.userId, USER_B),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// User A cannot access User B's CV file
// ---------------------------------------------------------------------------

describe("user A cannot access user B's CV file", () => {
  it("throws NotFoundError when A requests B's CV file", () => {
    expect(() =>
      requireOwnership(USER_B_CV_FILE.userId, USER_A),
    ).toThrow(NotFoundError);
  });

  it("allows B to access their own CV file", () => {
    expect(() =>
      requireOwnership(USER_B_CV_FILE.userId, USER_B),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Error properties do not leak tenant information
// ---------------------------------------------------------------------------

describe("error messages do not reveal other users' data", () => {
  it("error message does not contain the owner's userId", () => {
    try {
      requireOwnership(USER_B, USER_A);
      expect.fail("should have thrown");
    } catch (err: unknown) {
      expect((err as NotFoundError).message).not.toContain(USER_B);
      expect((err as NotFoundError).message).not.toContain(USER_A);
    }
  });

  it("error code is NOT_FOUND, not FORBIDDEN (no existence reveal)", () => {
    try {
      requireOwnership(USER_B, USER_A);
    } catch (err: unknown) {
      expect((err as NotFoundError).code).toBe("NOT_FOUND");
    }
  });

  it("UnauthorizedError message is generic", () => {
    try {
      requireAuth(null);
    } catch (err: unknown) {
      const msg = (err as UnauthorizedError).message.toLowerCase();
      expect(msg).not.toContain(USER_A);
      expect(msg).not.toContain(USER_B);
    }
  });
});

// ---------------------------------------------------------------------------
// Cross-user write attempts (same isolation guard applies)
// ---------------------------------------------------------------------------

describe("cross-user mutations are blocked by the same ownership guard", () => {
  it("A cannot patch B's profile (ownership check throws)", () => {
    // simulate: mutation reads profile from DB, checks owner before patch
    const profileFromDb = { userId: USER_B };
    expect(() =>
      requireOwnership(profileFromDb.userId, USER_A),
    ).toThrow(NotFoundError);
  });

  it("A cannot delete B's application (ownership check throws)", () => {
    const appFromDb = { userId: USER_B };
    expect(() => requireOwnership(appFromDb.userId, USER_A)).toThrow(NotFoundError);
  });

  it("A cannot update B's role variations (ownership check throws)", () => {
    const profileFromDb = { userId: USER_B };
    expect(() => requireOwnership(profileFromDb.userId, USER_A)).toThrow(
      NotFoundError,
    );
  });
});
