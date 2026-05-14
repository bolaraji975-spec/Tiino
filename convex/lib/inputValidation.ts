/**
 * inputValidation.ts — pure input validation helpers.
 *
 * These validators enforce server-side rules beyond what Convex's v.*
 * type validators can express. All functions throw plain Errors so they
 * can be unit-tested without a Convex runtime.
 */

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class ValidationError extends Error {
  readonly code = "VALIDATION" as const;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

/**
 * Returns true when the string matches a broadly correct email format.
 * Not RFC-5321 complete — just catches obvious garbage like missing @.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ---------------------------------------------------------------------------
// Salary range
// ---------------------------------------------------------------------------

/**
 * Throws ValidationError when both salaryMin and salaryMax are supplied and
 * salaryMin is strictly greater than salaryMax.
 */
export function validateSalaryRange(
  salaryMin: number | undefined,
  salaryMax: number | undefined,
): void {
  if (
    salaryMin !== undefined &&
    salaryMax !== undefined &&
    salaryMin > salaryMax
  ) {
    throw new ValidationError(
      "Minimum salary cannot exceed maximum salary.",
    );
  }
}

// ---------------------------------------------------------------------------
// Role variations
// ---------------------------------------------------------------------------

export const MAX_ROLE_VARIATIONS = 20;

/**
 * Throws ValidationError if the combined exact + adjacent array exceeds
 * MAX_ROLE_VARIATIONS items.
 */
export function validateRoleVariationCount(
  exact: string[],
  adjacent: string[],
): void {
  if (exact.length + adjacent.length > MAX_ROLE_VARIATIONS) {
    throw new ValidationError(
      `Role variations cannot exceed ${MAX_ROLE_VARIATIONS} items in total.`,
    );
  }
}

// ---------------------------------------------------------------------------
// String arrays
// ---------------------------------------------------------------------------

/**
 * Throws ValidationError if any element in the array is an empty or
 * whitespace-only string.
 */
export function validateNoEmptyStrings(
  items: string[],
  fieldName = "array",
): void {
  const hasEmpty = items.some((item) => item.trim() === "");
  if (hasEmpty) {
    throw new ValidationError(
      `${fieldName} must not contain empty strings.`,
    );
  }
}
