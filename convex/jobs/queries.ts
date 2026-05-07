/**
 * queries.ts — public Convex queries for the jobs table.
 */

import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { matchesRoleVariation } from "../lib/matchRoleVariation";

// Max jobs returned in one call — guards against accidental very large limits.
const HARD_LIMIT = 100;

// ---------------------------------------------------------------------------
// listForUser
// ---------------------------------------------------------------------------

/**
 * Returns up to `limit` active jobs (default 20, max 100) filtered by:
 *   1. The user's role variations (exact + adjacent) from their profile
 *   2. Optional caller-supplied filters (all combined with AND):
 *      - band        : sponsorship band ("high" | "medium" | "low" | "very_low")
 *                      When omitted, "very_low" jobs are hidden by default.
 *      - location    : case-insensitive substring match on job.location
 *      - salaryMin   : job.salaryMin must be >= this value (jobs with no salary are included)
 *      - postedWithin: recency cutoff ("24h" | "7d" | "30d")
 *      - source      : "nhs" | "civil_service" | "jobs_ac" | "private"
 *                      "private" means isPublicSector === false
 *
 * Results are ranked: sponsorshipScore desc → postedAt desc.
 *
 * Scalability note: collect() loads all active jobs into memory before
 * filtering/sorting. Replace with a search index at scale.
 */
export const listForUser = query({
  args: {
    limit: v.optional(v.number()),
    band: v.optional(
      v.union(
        v.literal("high"),
        v.literal("medium"),
        v.literal("low"),
        v.literal("very_low"),
      ),
    ),
    location: v.optional(v.string()),
    salaryMin: v.optional(v.number()),
    postedWithin: v.optional(
      v.union(v.literal("24h"), v.literal("7d"), v.literal("30d")),
    ),
    source: v.optional(
      v.union(
        v.literal("nhs"),
        v.literal("civil_service"),
        v.literal("jobs_ac"),
        v.literal("private"),
      ),
    ),
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

    // ── 1. Role variation filter ───────────────────────────────────────────
    let filtered = allActive.filter((j) =>
      matchesRoleVariation(j.title, variations),
    );

    // ── 2. Band filter ────────────────────────────────────────────────────
    if (args.band) {
      filtered = filtered.filter((j) => j.sponsorshipBand === args.band);
    } else {
      // Default: hide very_low
      filtered = filtered.filter((j) => j.sponsorshipBand !== "very_low");
    }

    // ── 3. Location filter (case-insensitive substring) ───────────────────
    if (args.location) {
      const loc = args.location.toLowerCase().trim();
      if (loc) {
        filtered = filtered.filter((j) =>
          j.location.toLowerCase().includes(loc),
        );
      }
    }

    // ── 4. Salary filter ──────────────────────────────────────────────────
    // Jobs with no salary listed are included (unknown ≠ below threshold).
    if (args.salaryMin !== undefined && args.salaryMin > 0) {
      const threshold = args.salaryMin;
      filtered = filtered.filter(
        (j) => j.salaryMin === undefined || j.salaryMin >= threshold,
      );
    }

    // ── 5. Posted-within filter ───────────────────────────────────────────
    if (args.postedWithin) {
      const ms = {
        "24h": 86_400_000,
        "7d": 604_800_000,
        "30d": 2_592_000_000,
      }[args.postedWithin];
      const cutoff = Date.now() - ms;
      filtered = filtered.filter((j) => j.postedAt >= cutoff);
    }

    // ── 6. Source filter ──────────────────────────────────────────────────
    if (args.source) {
      if (args.source === "private") {
        filtered = filtered.filter((j) => !j.isPublicSector);
      } else {
        const src = args.source;
        filtered = filtered.filter((j) =>
          j.sourceIds.some((s) => s.source === src),
        );
      }
    }

    // ── Sort: score desc → postedAt desc ─────────────────────────────────
    filtered.sort((a, b) => {
      if (b.sponsorshipScore !== a.sponsorshipScore) {
        return b.sponsorshipScore - a.sponsorshipScore;
      }
      return b.postedAt - a.postedAt;
    });

    const limit = Math.min(args.limit ?? 20, HARD_LIMIT);

    return {
      jobs: filtered.slice(0, limit),
      totalCount: filtered.length,
      hasMore: limit < filtered.length,
      isPro,
    };
  },
});
