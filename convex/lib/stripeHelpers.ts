/**
 * stripeHelpers.ts — pure Stripe webhook helpers.
 *
 * Extracted from the webhook handler so they can be unit-tested without an
 * HTTP context. Uses the Web Crypto API (globalThis.crypto.subtle) so the
 * file is compatible with both Convex's V8 runtime and Node.js 18+.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STRIPE_TOLERANCE_SECONDS = 300; // 5 minutes — Stripe's default

// ---------------------------------------------------------------------------
// Signature helpers
// ---------------------------------------------------------------------------

/**
 * Compute the expected Stripe webhook v1 HMAC-SHA256 signature.
 * Stripe constructs the signed payload as: `${timestamp}.${rawBody}`.
 */
export async function computeStripeSignature(
  rawBody: string,
  secret: string,
  timestamp: number,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const payload = `${timestamp}.${rawBody}`;
  const sigBuffer = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );
  return Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify a Stripe `Stripe-Signature` header value.
 *
 * Returns true only when:
 *   1. The header is present and contains both `t=` and `v1=`.
 *   2. The HMAC-SHA256 matches (constant-time comparison).
 *   3. The timestamp is within STRIPE_TOLERANCE_SECONDS of `nowSeconds`.
 *
 * Returns false (not throws) on any malformed input so the caller can
 * return HTTP 400 cleanly.
 */
export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!signatureHeader) return false;

  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const k = part.slice(0, eqIdx);
    const v = part.slice(eqIdx + 1);
    if (k && v) parts[k] = v;
  }

  const ts = parseInt(parts["t"] ?? "", 10);
  const v1 = parts["v1"] ?? "";
  if (!ts || !v1) return false;

  // Reject stale or future-dated webhooks
  if (Math.abs(nowSeconds - ts) > STRIPE_TOLERANCE_SECONDS) return false;

  const expected = await computeStripeSignature(rawBody, secret, ts);

  // Constant-time comparison to prevent timing attacks
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

/**
 * Returns true if `eventId` appears in the list of already-processed IDs.
 * The caller should store processed IDs in the `webhookEvents` table and
 * pass the list here before processing any event.
 */
export function isDuplicateEvent(
  processedIds: string[],
  eventId: string,
): boolean {
  return processedIds.includes(eventId);
}

// ---------------------------------------------------------------------------
// Credit delta
// ---------------------------------------------------------------------------

/**
 * Returns the net payPerCvCredits change for a given Stripe event type +
 * product metadata combination.
 *
 *   checkout.session.completed + pay_per_cv  → +1  (credit purchased)
 *   charge.refunded             + pay_per_cv  → -1  (credit refunded)
 *   anything else                             →  0  (no credit change)
 */
export function payPerCvCreditDelta(
  eventType: string,
  product: string | undefined,
): number {
  if (product !== "pay_per_cv") return 0;
  if (eventType === "checkout.session.completed") return 1;
  if (eventType === "charge.refunded") return -1;
  return 0;
}
