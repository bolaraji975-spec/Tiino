/**
 * validatePassword.ts — pure password-requirements checker.
 *
 * Used by convex/auth.ts (Password provider) and the security test suite.
 * Kept as a standalone module so it can be imported in both "use node" and
 * standard Convex contexts.
 */

/**
 * Throws with a descriptive message if the password does not meet the
 * minimum security requirements enforced at sign-up and password reset.
 *
 * Requirements:
 *   – At least 8 characters
 *   – At least one digit or special character
 */
export function validatePasswordRequirements(password: string): void {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  if (!/[0-9!@#$%^&*()\-_=+[\]{};':"\\|,.<>?/`~]/.test(password)) {
    throw new Error(
      "Password must include at least one number or special character.",
    );
  }
}

/**
 * Generic authentication error message.
 * Always return this — never differentiate between "wrong password" and
 * "user not found" to prevent account enumeration.
 */
export const GENERIC_AUTH_ERROR = "Invalid email or password.";
