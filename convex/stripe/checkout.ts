/**
 * stripe/checkout.ts — Stripe Checkout session creation.
 *
 * Three products:
 *   Pro Monthly  — £3.99/month  (STRIPE_PRO_MONTHLY_PRICE_ID)
 *   Pro Annual   — £35/year     (STRIPE_PRO_ANNUAL_PRICE_ID)
 *   Pay-per-CV   — £1.99 once   (STRIPE_PAY_PER_CV_PRICE_ID)
 */

import { ConvexError, v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

export type CheckoutProduct = "pro_monthly" | "pro_annual" | "pay_per_cv";

function getPriceId(product: CheckoutProduct): string {
  const env: Record<CheckoutProduct, string | undefined> = {
    pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    pro_annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
    pay_per_cv: process.env.STRIPE_PAY_PER_CV_PRICE_ID,
  };
  const id = env[product];
  if (!id) {
    throw new ConvexError({
      code: "CONFIGURATION_ERROR",
      message: `Missing env var for product "${product}".`,
    });
  }
  return id;
}

export const createCheckoutSession = action({
  args: {
    product: v.union(
      v.literal("pro_monthly"),
      v.literal("pro_annual"),
      v.literal("pay_per_cv"),
    ),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated." });
    }

    const user = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found." });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new ConvexError({
        code: "CONFIGURATION_ERROR",
        message: "STRIPE_SECRET_KEY is not set.",
      });
    }

    const priceId = getPriceId(args.product);
    const isSubscription = args.product !== "pay_per_cv";

    const params = new URLSearchParams({
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      mode: isSubscription ? "subscription" : "payment",
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      "metadata[userId]": userId,
      "metadata[product]": args.product,
      ...(user.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : user.email
          ? { customer_email: user.email }
          : {}),
    });

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ConvexError({ code: "STRIPE_ERROR", message: error });
    }

    const session = (await response.json()) as { url: string };
    return { url: session.url };
  },
});
