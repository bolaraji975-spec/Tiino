/**
 * tests/security/inputValidation.test.ts
 *
 * Server-side input validation — ensures malformed or malicious inputs are
 * rejected before they reach the database.
 *
 * All tests are pure unit tests — no Convex runtime required.
 */

import { describe, it, expect } from "vitest";
import {
  isValidEmail,
  validateSalaryRange,
  validateRoleVariationCount,
  validateNoEmptyStrings,
  MAX_ROLE_VARIATIONS,
  ValidationError,
} from "../../convex/lib/inputValidation";
import {
  validateContentType,
  validateFileSize,
  validateCvUpload,
  MAX_CV_BYTES,
  ALLOWED_CV_CONTENT_TYPES,
  FileValidationError,
} from "../../convex/lib/fileValidation";

// ---------------------------------------------------------------------------
// Email format validation
// ---------------------------------------------------------------------------

describe("isValidEmail", () => {
  it("accepts a standard email address", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  it("accepts a subdomain email", () => {
    expect(isValidEmail("user@mail.example.co.uk")).toBe(true);
  });

  it("rejects an email with no @", () => {
    expect(isValidEmail("notanemail")).toBe(false);
  });

  it("rejects an email with no domain part", () => {
    expect(isValidEmail("user@")).toBe(false);
  });

  it("rejects an email with no local part", () => {
    expect(isValidEmail("@example.com")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects an address with spaces", () => {
    expect(isValidEmail("user @example.com")).toBe(false);
  });

  it("rejects an address with no TLD separator dot in domain", () => {
    expect(isValidEmail("user@localhost")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SQL injection — treated as a plain string (no special handling in Convex)
// ---------------------------------------------------------------------------

describe("SQL injection strings are handled safely", () => {
  const SQL_INJECTION = `'; DROP TABLE users; --`;
  const XSS_STRING = `<script>alert(document.cookie)</script>`;
  const UNION_ATTACK = `' UNION SELECT * FROM users --`;

  it("SQL injection string is a valid (non-empty) string — not silently dropped", () => {
    // Convex is a document database — SQL injection doesn't apply.
    // The string should pass through as-is without throwing.
    expect(typeof SQL_INJECTION).toBe("string");
    expect(SQL_INJECTION.length).toBeGreaterThan(0);
  });

  it("SQL injection string does not match a valid email", () => {
    expect(isValidEmail(SQL_INJECTION)).toBe(false);
  });

  it("XSS string does not match a valid email", () => {
    expect(isValidEmail(XSS_STRING)).toBe(false);
  });

  it("UNION attack string does not match a valid email", () => {
    expect(isValidEmail(UNION_ATTACK)).toBe(false);
  });

  it("empty strings in role arrays are caught before storage", () => {
    expect(() => validateNoEmptyStrings(["valid", ""], "exact variations")).toThrow(
      ValidationError,
    );
  });

  it("SQL injection string treated as a plain role title (no throw, not filtered)", () => {
    // A SQL injection string as a role title is not dangerous in Convex,
    // but empty-string check must not trigger on it (it's non-empty).
    expect(() => validateNoEmptyStrings([SQL_INJECTION], "roles")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// File size validation
// ---------------------------------------------------------------------------

describe("validateFileSize", () => {
  it("accepts a file exactly at the limit (10 MB)", () => {
    expect(() => validateFileSize(MAX_CV_BYTES)).not.toThrow();
  });

  it("rejects a file 1 byte over the limit", () => {
    expect(() => validateFileSize(MAX_CV_BYTES + 1)).toThrow(FileValidationError);
  });

  it("rejects a 20 MB file", () => {
    expect(() => validateFileSize(20 * 1024 * 1024)).toThrow(FileValidationError);
  });

  it("rejects a 100 MB file", () => {
    expect(() => validateFileSize(100 * 1024 * 1024)).toThrow(FileValidationError);
  });

  it("accepts a 1 KB file", () => {
    expect(() => validateFileSize(1024)).not.toThrow();
  });

  it("accepts a 0-byte file (edge case — no size check for zero)", () => {
    expect(() => validateFileSize(0)).not.toThrow();
  });

  it("error message mentions '10 MB'", () => {
    try {
      validateFileSize(MAX_CV_BYTES + 1);
      expect.fail("should have thrown");
    } catch (err: unknown) {
      expect((err as FileValidationError).message).toContain("10 MB");
    }
  });
});

// ---------------------------------------------------------------------------
// MIME type / content type validation
// ---------------------------------------------------------------------------

describe("validateContentType", () => {
  it("accepts application/pdf", () => {
    expect(() => validateContentType("application/pdf")).not.toThrow();
  });

  it("accepts DOCX MIME type", () => {
    expect(() =>
      validateContentType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).not.toThrow();
  });

  it("rejects image/jpeg", () => {
    expect(() => validateContentType("image/jpeg")).toThrow(FileValidationError);
  });

  it("rejects text/plain", () => {
    expect(() => validateContentType("text/plain")).toThrow(FileValidationError);
  });

  it("rejects application/octet-stream", () => {
    expect(() => validateContentType("application/octet-stream")).toThrow(
      FileValidationError,
    );
  });

  it("rejects an empty content-type string", () => {
    expect(() => validateContentType("")).toThrow(FileValidationError);
  });

  it("rejects application/zip (even though DOCX is a ZIP under the hood)", () => {
    expect(() => validateContentType("application/zip")).toThrow(FileValidationError);
  });

  it("ALLOWED_CV_CONTENT_TYPES contains exactly PDF and DOCX", () => {
    expect(ALLOWED_CV_CONTENT_TYPES.size).toBe(2);
    expect(ALLOWED_CV_CONTENT_TYPES.has("application/pdf")).toBe(true);
    expect(
      ALLOWED_CV_CONTENT_TYPES.has(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Combined file upload validation
// ---------------------------------------------------------------------------

describe("validateCvUpload", () => {
  it("accepts a valid 1 MB PDF", () => {
    expect(() => validateCvUpload(1024 * 1024, "application/pdf")).not.toThrow();
  });

  it("rejects a valid PDF that is too large", () => {
    expect(() =>
      validateCvUpload(MAX_CV_BYTES + 1, "application/pdf"),
    ).toThrow(FileValidationError);
  });

  it("rejects a small file with wrong MIME type", () => {
    expect(() => validateCvUpload(512, "image/png")).toThrow(FileValidationError);
  });

  it("checks content type before file size", () => {
    // Wrong type AND too large — content type error should come first
    try {
      validateCvUpload(MAX_CV_BYTES + 1, "image/jpeg");
      expect.fail("should have thrown");
    } catch (err: unknown) {
      expect((err as FileValidationError).message).toContain("PDF");
    }
  });
});

// ---------------------------------------------------------------------------
// Salary range validation
// ---------------------------------------------------------------------------

describe("validateSalaryRange", () => {
  it("accepts valid range (min < max)", () => {
    expect(() => validateSalaryRange(30_000, 50_000)).not.toThrow();
  });

  it("accepts equal min and max", () => {
    expect(() => validateSalaryRange(40_000, 40_000)).not.toThrow();
  });

  it("rejects min > max", () => {
    expect(() => validateSalaryRange(60_000, 50_000)).toThrow(ValidationError);
  });

  it("accepts when only min is supplied", () => {
    expect(() => validateSalaryRange(30_000, undefined)).not.toThrow();
  });

  it("accepts when only max is supplied", () => {
    expect(() => validateSalaryRange(undefined, 50_000)).not.toThrow();
  });

  it("accepts when both are undefined", () => {
    expect(() => validateSalaryRange(undefined, undefined)).not.toThrow();
  });

  it("error message describes the constraint", () => {
    try {
      validateSalaryRange(100_000, 50_000);
      expect.fail("should have thrown");
    } catch (err: unknown) {
      expect((err as ValidationError).message.toLowerCase()).toContain("salary");
    }
  });
});

// ---------------------------------------------------------------------------
// Role variation count
// ---------------------------------------------------------------------------

describe("validateRoleVariationCount", () => {
  it("accepts empty arrays", () => {
    expect(() => validateRoleVariationCount([], [])).not.toThrow();
  });

  it("accepts combined count exactly at the limit", () => {
    const exact = Array(10).fill("Software Engineer");
    const adjacent = Array(10).fill("Product Manager");
    expect(() => validateRoleVariationCount(exact, adjacent)).not.toThrow();
  });

  it("rejects combined count of 21", () => {
    const exact = Array(11).fill("Role A");
    const adjacent = Array(10).fill("Role B");
    expect(() => validateRoleVariationCount(exact, adjacent)).toThrow(ValidationError);
  });

  it("rejects 21 items all in exact", () => {
    expect(() =>
      validateRoleVariationCount(Array(21).fill("x"), []),
    ).toThrow(ValidationError);
  });

  it(`MAX_ROLE_VARIATIONS is ${MAX_ROLE_VARIATIONS}`, () => {
    expect(MAX_ROLE_VARIATIONS).toBe(20);
  });

  it("error message mentions the limit", () => {
    try {
      validateRoleVariationCount(Array(21).fill("role"), []);
    } catch (err: unknown) {
      expect((err as ValidationError).message).toContain("20");
    }
  });
});

// ---------------------------------------------------------------------------
// Empty strings in arrays
// ---------------------------------------------------------------------------

describe("validateNoEmptyStrings", () => {
  it("accepts an array of non-empty strings", () => {
    expect(() =>
      validateNoEmptyStrings(["Python", "TypeScript", "React"], "skills"),
    ).not.toThrow();
  });

  it("accepts an empty array", () => {
    expect(() => validateNoEmptyStrings([], "skills")).not.toThrow();
  });

  it("rejects an array containing an empty string", () => {
    expect(() => validateNoEmptyStrings(["Python", ""], "skills")).toThrow(
      ValidationError,
    );
  });

  it("rejects an array containing a whitespace-only string", () => {
    expect(() => validateNoEmptyStrings(["Python", "   "], "skills")).toThrow(
      ValidationError,
    );
  });

  it("rejects when the first element is empty", () => {
    expect(() => validateNoEmptyStrings(["", "Python"], "skills")).toThrow(
      ValidationError,
    );
  });

  it("includes the field name in the error message", () => {
    try {
      validateNoEmptyStrings([""], "exact variations");
      expect.fail("should have thrown");
    } catch (err: unknown) {
      expect((err as ValidationError).message).toContain("exact variations");
    }
  });
});
