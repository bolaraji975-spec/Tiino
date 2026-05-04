/**
 * users.ts
 *
 * Queries and mutations for the users table.
 */

import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ---------------------------------------------------------------------------
// getCurrentUser
// ---------------------------------------------------------------------------

/**
 * Returns the authenticated user's document, or null if not signed in.
 * Used by the onboarding page and feed to check profile completeness.
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db.get(userId);
  },
});

// ---------------------------------------------------------------------------
// updateProfile
// ---------------------------------------------------------------------------

/**
 * Sets onboarding fields on the users row.
 * Called once after first login; safe to call again (updates in place).
 *
 * Server-side validation mirrors client-side:
 *   - visaStatus must be one of the four allowed values (enforced by v.union)
 *   - location must be a non-empty string after trimming
 *   - if both salaryMin and salaryMax are supplied, min must be ≤ max
 */
export const updateProfile = mutation({
  args: {
    visaStatus: v.union(
      v.literal("graduate"),
      v.literal("skilled_worker"),
      v.literal("student"),
      v.literal("other"),
    ),
    location: v.string(),
    salaryMin: v.optional(v.number()),
    salaryMax: v.optional(v.number()),
    rightToWork: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated." });
    }

    if (args.location.trim() === "") {
      throw new ConvexError({ code: "VALIDATION", message: "Location is required." });
    }

    if (
      args.salaryMin !== undefined &&
      args.salaryMax !== undefined &&
      args.salaryMin > args.salaryMax
    ) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Minimum salary cannot exceed maximum salary.",
      });
    }

    await ctx.db.patch(userId, {
      visaStatus: args.visaStatus,
      location: args.location.trim(),
      salaryMin: args.salaryMin,
      salaryMax: args.salaryMax,
      rightToWork: args.rightToWork,
    });
  },
});
