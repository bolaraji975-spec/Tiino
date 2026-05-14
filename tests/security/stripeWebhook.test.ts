/**
 * tests/security/stripeWebhook.test.ts
 *
 * Stripe webhook security:
 *   – Requests without a valid signature are rejected
 *   – Duplicate event IDs are detected (idempotency)
 *   – Pay-per-CV refund correctly decrements credits
 *
 * All tests are pure unit tests — no HTTP context, no Convex runtime.
 */

import { describe, it, expect } from "vitest";
import {
  verifyStripeSignature,
  computeStripeSignature,
  isDuplicateEvent,
  payPerCvCreditDelta,
  STRIPE_TOLERANCE_SECONDS,
} from "../../convex/lib/stripeHelpers";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const SECRET = "whsec_test_secret_key_for_unit_tests";
const NOW_SECONDS = 1_700_000_000;

async function makeSignatureHeader(
  rawBody: string,
  secret: string,
  timestamp: number,
): Promise<string> {
  const sig = await computeStripeSignature(rawBody, secret, timestamp);
  return `t=${timestamp},v1=${sig}`;
}

// ---------------------------------------------------------------------------
// verifyStripeSignature — valid signatures accepted
// ---------------------------------------------------------------------------

describe("verifyStripeSignature — valid signatures are accepted", () => {
  const BODY = JSON.stringify({ id: "evt_001", type: "checkout.session.completed" });

  it("accepts a correctly signed request", async () => {
    const header = await makeSignatureHeader(BODY, SECRET, NOW_SECONDS);
    expect(await verifyStripeSignature(BODY, header, SECRET, NOW_SECONDS)).toBe(true);
  });

  it("accepts a request 1 second old", async () => {
    const header = await makeSignatureHeader(BODY, SECRET, NOW_SECONDS - 1);
    expect(await verifyStripeSignature(BODY, header, SECRET, NOW_SECONDS)).toBe(true);
  });

  it("accepts a request at exactly the tolerance limit", async () => {
    const ts = NOW_SECONDS - STRIPE_TOLERANCE_SECONDS;
    const header = await makeSignatureHeader(BODY, SECRET, ts);
    expect(await verifyStripeSignature(BODY, header, SECRET, NOW_SECONDS)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// verifyStripeSignature — invalid / missing signatures rejected
// ---------------------------------------------------------------------------

describe("verifyStripeSignature — requests without valid signature are rejected", () => {
  const BODY = JSON.stringify({ id: "evt_002", type: "checkout.session.completed" });

  it("rejects a request with no signature header", async () => {
    expect(await verifyStripeSignature(BODY, "", SECRET, NOW_SECONDS)).toBe(false);
  });

  it("rejects a request with a tampered body", async () => {
    const header = await makeSignatureHeader(BODY, SECRET, NOW_SECONDS);
    const tamperedBody = BODY + " extra";
    expect(
      await verifyStripeSignature(tamperedBody, header, SECRET, NOW_SECONDS),
    ).toBe(false);
  });

  it("rejects a request signed with a different secret", async () => {
    const header = await makeSignatureHeader(BODY, "wrong_secret", NOW_SECONDS);
    expect(await verifyStripeSignature(BODY, header, SECRET, NOW_SECONDS)).toBe(false);
  });

  it("rejects a malformed signature header (no t=)", async () => {
    expect(
      await verifyStripeSignature(BODY, "v1=abc123", SECRET, NOW_SECONDS),
    ).toBe(false);
  });

  it("rejects a malformed signature header (no v1=)", async () => {
    expect(
      await verifyStripeSignature(BODY, `t=${NOW_SECONDS}`, SECRET, NOW_SECONDS),
    ).toBe(false);
  });

  it("rejects a stale request (1 second past tolerance)", async () => {
    const staleTimestamp = NOW_SECONDS - STRIPE_TOLERANCE_SECONDS - 1;
    const header = await makeSignatureHeader(BODY, SECRET, staleTimestamp);
    expect(await verifyStripeSignature(BODY, header, SECRET, NOW_SECONDS)).toBe(false);
  });

  it("rejects a future-dated request (1 second past tolerance in the future)", async () => {
    const futureTimestamp = NOW_SECONDS + STRIPE_TOLERANCE_SECONDS + 1;
    const header = await makeSignatureHeader(BODY, SECRET, futureTimestamp);
    expect(await verifyStripeSignature(BODY, header, SECRET, NOW_SECONDS)).toBe(false);
  });

  it("rejects an all-zeros v1 signature", async () => {
    const header = `t=${NOW_SECONDS},v1=${"0".repeat(64)}`;
    expect(await verifyStripeSignature(BODY, header, SECRET, NOW_SECONDS)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isDuplicateEvent — idempotency
// ---------------------------------------------------------------------------

describe("isDuplicateEvent — duplicate event IDs are detected", () => {
  it("returns false for a never-seen event ID", () => {
    expect(isDuplicateEvent([], "evt_new")).toBe(false);
  });

  it("returns false when the ID is not in the processed list", () => {
    expect(isDuplicateEvent(["evt_001", "evt_002"], "evt_003")).toBe(false);
  });

  it("returns true when the ID is already in the processed list", () => {
    expect(isDuplicateEvent(["evt_001", "evt_002", "evt_003"], "evt_002")).toBe(true);
  });

  it("returns true when the list contains only that one ID", () => {
    expect(isDuplicateEvent(["evt_only"], "evt_only")).toBe(true);
  });

  it("is case-sensitive (evt_ABC ≠ evt_abc)", () => {
    expect(isDuplicateEvent(["evt_ABC"], "evt_abc")).toBe(false);
  });

  it("duplicate event processed only once — second call detects it", () => {
    const processed: string[] = [];

    // First call: not a duplicate → process it
    expect(isDuplicateEvent(processed, "evt_dup")).toBe(false);
    processed.push("evt_dup");

    // Second call: duplicate → skip it
    expect(isDuplicateEvent(processed, "evt_dup")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// payPerCvCreditDelta — refund and purchase logic
// ---------------------------------------------------------------------------

describe("payPerCvCreditDelta", () => {
  it("purchase of pay_per_cv credit returns +1", () => {
    expect(payPerCvCreditDelta("checkout.session.completed", "pay_per_cv")).toBe(1);
  });

  it("refund of pay_per_cv credit returns -1", () => {
    expect(payPerCvCreditDelta("charge.refunded", "pay_per_cv")).toBe(-1);
  });

  it("subscription purchase returns 0 (not a credit event)", () => {
    expect(payPerCvCreditDelta("checkout.session.completed", "pro_monthly")).toBe(0);
  });

  it("subscription refund returns 0", () => {
    expect(payPerCvCreditDelta("charge.refunded", "pro_monthly")).toBe(0);
  });

  it("unrelated event type returns 0", () => {
    expect(payPerCvCreditDelta("customer.subscription.deleted", "pay_per_cv")).toBe(0);
  });

  it("returns 0 when product is undefined", () => {
    expect(payPerCvCreditDelta("charge.refunded", undefined)).toBe(0);
  });

  it("refund decrements credits (net balance after purchase + refund = 0)", () => {
    const purchased = payPerCvCreditDelta("checkout.session.completed", "pay_per_cv");
    const refunded = payPerCvCreditDelta("charge.refunded", "pay_per_cv");
    expect(purchased + refunded).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// STRIPE_TOLERANCE_SECONDS constant
// ---------------------------------------------------------------------------

describe("STRIPE_TOLERANCE_SECONDS", () => {
  it("is 300 seconds (5 minutes — Stripe default)", () => {
    expect(STRIPE_TOLERANCE_SECONDS).toBe(300);
  });
});
