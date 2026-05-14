/**
 * authRateLimit.ts — pure auth rate-limit helpers.
 *
 * Implements a sliding-window counter per identifier (email address).
 * In production Convex Auth persists rate-limit state in the authRateLimits
 * table. These pure helpers are extracted for unit-testability.
 *
 * Policy: ≥ MAX_FAILED_ATTEMPTS failures within LOCKOUT_WINDOW_MS → locked out.
 * Window resets automatically once LOCKOUT_WINDOW_MS elapses.
 */

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export type AttemptRecord = {
  identifier: string;
  count: number;
  windowStart: number;
};

/**
 * Returns true if this identifier should currently be denied access.
 * A missing or expired record is never locked out.
 */
export function isLockedOut(
  record: Pick<AttemptRecord, "count" | "windowStart"> | undefined,
  now = Date.now(),
): boolean {
  if (!record) return false;
  // Window expires once elapsed time reaches LOCKOUT_WINDOW_MS
  if (now - record.windowStart >= LOCKOUT_WINDOW_MS) return false;
  return record.count >= MAX_FAILED_ATTEMPTS;
}

/**
 * Returns an updated AttemptRecord after one failed authentication attempt.
 * Starts a fresh window if the previous window has expired.
 */
export function recordFailedAttempt(
  existing: AttemptRecord | undefined,
  identifier: string,
  now = Date.now(),
): AttemptRecord {
  if (!existing || now - existing.windowStart >= LOCKOUT_WINDOW_MS) {
    return { identifier, count: 1, windowStart: now };
  }
  return { ...existing, count: existing.count + 1 };
}

/**
 * Returns true if the counter has reached the lockout threshold after
 * recording the current attempt — i.e. "this attempt triggers lockout".
 */
export function attemptTriggersLockout(
  existing: AttemptRecord | undefined,
  identifier: string,
  now = Date.now(),
): boolean {
  const updated = recordFailedAttempt(existing, identifier, now);
  return updated.count >= MAX_FAILED_ATTEMPTS;
}
