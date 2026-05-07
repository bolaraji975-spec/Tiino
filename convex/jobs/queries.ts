/**
 * queries.ts — public Convex queries for the jobs table.
 */

import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { matchesRoleVariation } from "../lib/matchRoleVariation";

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// listForUser
// ---------------------------------------------------------------------------

/**
 * Returns a page of active jobs filtered by the user's role variations
 * (exact + adjacent titles from their profile), ranked by sponsorshipScore
 * descending then postedAt descending.
 *
 * When the user has no profile yet every active job is returned (unfiltered).
 *
 * Scalability note: collect() loads all active jobs into memory before
 * filtering/sorting. Acceptable for MVP; replace with a search index at scale.
 */
export const listForUser = query({
  args: {
    page: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { jobs: [], totalCount: 0, hasMore: false, isPro: false };
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return { jobs: [], totalCount: 0, hasMore: false, isPro: false };
    }

    const isPro =
      user.plan === "pro_monthly" || user.plan === "pro_annual";

    // Load role variations from profile (if onboarding is complete)
    const profile = await ctx.db
      .query("profiles")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .first();

    const variations: string[] = profile?.roleVariations
      ? [
          ...profile.roleVariations.exact,
          ...profile.roleVariations.adjacent,
        ]
      : [];

    // Collect all active jobs (filtered + sorted in memory for MVP)
    const allActive = await ctx.db
      .query("jobs")
      .withIndex("byActive", (q) => q.eq("isActive", true))
      .collect();

    const filtered = allActive.filter((j) =>
      matchesRoleVariation(j.title, variations),
    );

    filtered.sort((a, b) => {
      if (b.sponsorshipScore !== a.sponsorshipScore) {
        return b.sponsorshipScore - a.sponsorshipScore;
      }
      return b.postedAt - a.postedAt;
    });

    const page = args.page ?? 0;
    const start = page * PAGE_SIZE;

    return {
      jobs: filtered.slice(start, start + PAGE_SIZE),
      totalCount: filtered.length,
      hasMore: start + PAGE_SIZE < filtered.length,
      isPro,
    };
  },
});
