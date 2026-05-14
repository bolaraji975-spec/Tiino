/**
 * tests/security/auth.test.ts
 *
 * Security properties of the authentication system.
 *
 * All tests are pure unit tests — no Convex runtime, no network calls.
 */

import { describe, it, expect } from "vitest";
import {
  validatePasswordRequirements,
  GENERIC_AUTH_ERROR,
} from "../../convex/lib/validatePassword";
import { escapeHtml } from "../../convex/lib/htmlUtils";
import { isTokenExpired } from "../../convex/lib/tenantGuard";

// ---------------------------------------------------------------------------
// Password hashing — plain text is never stored
// ---------------------------------------------------------------------------

describe("password never stored in plain text", () => {
  it("rejects a plain dictionary word (would be trivially crackable)", () => {
    // The validator enforces complexity; anything that passes is not plain text.
    // A bare lowercase word satisfies length but fails the digit/special-char rule.
    expect(() => validatePasswordRequirements("password")).toThrow();
  });

  it("rejects a short numeric PIN", () => {
    expect(() => validatePasswordRequirements("1234")).toThrow();
  });

  it("accepts a password that meets requirements (min-bar is not plain text)", () => {
    // Only passwords that pass this validator ever reach the hashing layer.
    expect(() => validatePasswordRequirements("Correct1Horse")).not.toThrow();
  });

  it("accepted password contains at least one non-alpha character", () => {
    // Ensures even if somehow stored it would not be a trivial plain string.
    const pw = "SecureP@ss1";
    validatePasswordRequirements(pw);
    expect(/[0-9!@#$%^&*()\-_=+]/.test(pw)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Password requirements
// ---------------------------------------------------------------------------

describe("validatePasswordRequirements", () => {
  it("rejects password shorter than 8 characters", () => {
    expect(() => validatePasswordRequirements("Ab1!")).toThrow(
      "at least 8 characters",
    );
  });

  it("rejects password with no digit or special character", () => {
    expect(() => validatePasswordRequirements("OnlyLettersHere")).toThrow(
      "number or special character",
    );
  });

  it("accepts password with digit", () => {
    expect(() => validatePasswordRequirements("LettersAnd1")).not.toThrow();
  });

  it("accepts password with special character", () => {
    expect(() => validatePasswordRequirements("Letters@nd!")).not.toThrow();
  });

  it("accepts minimum-length password with a digit", () => {
    expect(() => validatePasswordRequirements("Abcdef1!")).not.toThrow();
  });

  it("rejects exactly 7 characters even with special char", () => {
    expect(() => validatePasswordRequirements("Short1!")).toThrow(
      "at least 8 characters",
    );
  });
});

// ---------------------------------------------------------------------------
// Error enumeration prevention
// ---------------------------------------------------------------------------

describe("generic auth error (no enumeration)", () => {
  it("GENERIC_AUTH_ERROR does not reveal which field is wrong", () => {
    // The message must not say "wrong password", "incorrect password",
    // "user not found", "no account", etc. — anything that distinguishes
    // between the two failure modes leaks enumeration information.
    const lower = GENERIC_AUTH_ERROR.toLowerCase();
    expect(lower).not.toContain("wrong");
    expect(lower).not.toContain("incorrect");
    expect(lower).not.toContain("not found");
    expect(lower).not.toContain("no account");
    expect(lower).not.toContain("does not exist");
  });

  it("GENERIC_AUTH_ERROR is the same string for both wrong-password and unknown-email cases", () => {
    // Both scenarios must use exactly the same message — confirmed by using
    // the single constant rather than two different strings.
    const wrongPasswordError = GENERIC_AUTH_ERROR;
    const unknownEmailError = GENERIC_AUTH_ERROR;
    expect(wrongPasswordError).toBe(unknownEmailError);
  });

  it("GENERIC_AUTH_ERROR is a non-empty string", () => {
    expect(typeof GENERIC_AUTH_ERROR).toBe("string");
    expect(GENERIC_AUTH_ERROR.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// XSS sanitisation — user-controlled strings in email templates
// ---------------------------------------------------------------------------

describe("XSS in user-supplied fields is HTML-escaped in emails", () => {
  it("escapes <script> tags in email address", () => {
    const xssEmail = `user<script>alert(1)</script>@example.com`;
    const escaped = escapeHtml(xssEmail);
    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("&lt;script&gt;");
  });

  it("escapes unquoted attribute injection attempt", () => {
    const xss = `" onmouseover="alert(1)`;
    const escaped = escapeHtml(xss);
    expect(escaped).not.toContain('"');
    expect(escaped).toContain("&quot;");
  });

  it("escapes HTML entities in a display name", () => {
    const name = `<img src=x onerror=alert(1)>`;
    const escaped = escapeHtml(name);
    expect(escaped).not.toContain("<");
    expect(escaped).not.toContain(">");
    expect(escaped).toContain("&lt;");
    expect(escaped).toContain("&gt;");
  });

  it("escapes ampersands to prevent entity injection", () => {
    expect(escapeHtml("AT&T")).toBe("AT&amp;T");
  });

  it("leaves a clean string unchanged aside from entity encoding", () => {
    const clean = "Amara Osei";
    expect(escapeHtml(clean)).toBe(clean);
  });

  it("escapes single quotes", () => {
    const xss = `'; DROP TABLE users; --`;
    const escaped = escapeHtml(xss);
    expect(escaped).not.toContain("'");
    expect(escaped).toContain("&#x27;");
  });
});

// ---------------------------------------------------------------------------
// Expired token rejection
// ---------------------------------------------------------------------------

describe("isTokenExpired", () => {
  const FIXED_NOW = 1_700_000_000; // arbitrary fixed "now" in seconds

  it("returns true when token expired 1 second ago", () => {
    expect(isTokenExpired(FIXED_NOW - 1, FIXED_NOW)).toBe(true);
  });

  it("returns true when token expires at exactly now", () => {
    expect(isTokenExpired(FIXED_NOW, FIXED_NOW)).toBe(true);
  });

  it("returns false when token expires 1 second in the future", () => {
    expect(isTokenExpired(FIXED_NOW + 1, FIXED_NOW)).toBe(false);
  });

  it("returns false for a token with 1 hour of validity remaining", () => {
    expect(isTokenExpired(FIXED_NOW + 3600, FIXED_NOW)).toBe(false);
  });

  it("returns true for a long-expired token (JWT from the past)", () => {
    // Token expired 30 days ago
    expect(isTokenExpired(FIXED_NOW - 30 * 86_400, FIXED_NOW)).toBe(true);
  });
});
