/**
 * tenantGuard.ts — pure tenant-isolation and auth-guard helpers.
 *
 * All functions throw typed errors that Convex mutations/actions can catch
 * and convert to ConvexError.  Keeping the logic here (rather than inline)
 * means the isolation policy is unit-testable without a Convex runtime.
 */

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED" as const;
  constructor(message = "Not authenticated.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class NotFoundError extends Error {
  readonly code = "NOT_FOUND" as const;
  constructor(message = "Resource not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * Asserts the requesting userId is non-null (i.e. user is authenticated).
 * Throws UnauthorizedError otherwise.
 *
 * Usage in mutations:
 *   const userId = await getAuthUserId(ctx);
 *   requireAuth(userId);
 */
export function requireAuth(userId: string | null): asserts userId is string {
  if (userId === null) throw new UnauthorizedError();
}

/**
 * Asserts the resource belongs to the requesting user.
 * Throws NotFoundError — deliberately not 403, so the existence of another
 * user's resource is not revealed to the caller.
 */
export function requireOwnership(
  resourceOwnerId: string,
  requesterId: string,
): void {
  if (resourceOwnerId !== requesterId) {
    throw new NotFoundError("Resource not found.");
  }
}

/**
 * Returns true when the given JWT expiry timestamp (seconds since epoch)
 * has already passed.
 */
export function isTokenExpired(
  expiresAtSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  return nowSeconds >= expiresAtSeconds;
}
