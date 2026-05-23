/**
 * queries.ts — public Convex queries for the jobs table.
 */

import { v } from "convex/values";
import { query, internalQuery } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { matchesRoleVariation, matchesRoleVariationLoose } from "../lib/matchRoleVariation";

// ---------------------------------------------------------------------------
// getSavedJobIds
// ---------------------------------------------------------------------------

/**
 * Returns the IDs of all jobs the current user has saved (stage = "saved").
 * Used by the feed to render per-card save toggles without a per-card query.
 * Returns an empty array if the user is not signed in.
 */
export const getSavedJobIds = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const applications = await ctx.db
      .query("applications")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("stage"), "saved"))
      .collect();

    return applications.map((a) => a.jobId);
  },
});

// ---------------------------------------------------------------------------
// getJobById
// ---------------------------------------------------------------------------

/**
 * Returns a single job by its Convex ID, enriched with:
 *   - sponsor record (if the job is linked to a UKVI sponsor)
 *   - isSaved: whether the current user has a "saved" application for this job
 *   - isPro: whether the current user is on a paid plan
 *
 * Returns null if the job is not found, inactive, or the user is not signed in.
 */
export const getJobById = query({
  args: { id: v.id("jobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const job = await ctx.db.get(args.id);
    if (!job || !job.isActive) return null;

    const isPro = user.plan === "pro_monthly" || user.plan === "pro_annual";

    // Fetch linked sponsor record (may be null if no match was found at ingest)
    const sponsor = job.sponsorId ? await ctx.db.get(job.sponsorId) : null;

    // Check saved status
    const application = await ctx.db
      .query("applications")
      .withIndex("byJob", (q) => q.eq("jobId", job._id))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    // Profile-derived flags for the detail panel
    const profile = await ctx.db
      .query("profiles")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .first();

    const hasCvUploaded = !!profile?.cvFileId;

    const variations: string[] = profile?.roleVariations
      ? [...profile.roleVariations.exact, ...profile.roleVariations.adjacent]
      : [];

    const matchesProfile =
      variations.length > 0
        ? matchesRoleVariation(job.title, variations)
        : false;

    return {
      job,
      sponsor,
      isPro,
      isSaved: application?.stage === "saved",
      applicationId: application?._id,
      hasCvUploaded,
      matchesProfile,
    };
  },
});

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

    // ── 1. Role variation filter (loose: ANY word from ANY variation) ─────
    // Uses loose matching so "Data Analyst" variation catches "Business Analyst"
    // jobs etc. The strict matchesRoleVariation is kept for the per-job
    // "Matches your profile" signal only.
    let filtered = allActive.filter((j) =>
      matchesRoleVariationLoose(j.title, variations),
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

    // ── Fallback: < 5 role matches → show all sponsored jobs ─────────────
    // When a user's role variations yield fewer than 5 results (e.g. niche
    // title, or newly set-up profile), expand to all non-very_low active jobs
    // so the feed never appears empty. Other active filters (band, location,
    // salary, postedWithin, source) are preserved — only the role filter is
    // relaxed.
    const FALLBACK_THRESHOLD = 5;
    if (variations.length > 0 && filtered.length < FALLBACK_THRESHOLD) {
      let fallback = allActive.filter((j) => j.sponsorshipBand !== "very_low");

      if (args.band) {
        fallback = fallback.filter((j) => j.sponsorshipBand === args.band);
      }
      if (args.location) {
        const loc = args.location.toLowerCase().trim();
        if (loc) fallback = fallback.filter((j) => j.location.toLowerCase().includes(loc));
      }
      if (args.salaryMin !== undefined && args.salaryMin > 0) {
        const threshold = args.salaryMin;
        fallback = fallback.filter(
          (j) => j.salaryMin === undefined || j.salaryMin >= threshold,
        );
      }
      if (args.postedWithin) {
        const ms = { "24h": 86_400_000, "7d": 604_800_000, "30d": 2_592_000_000 }[args.postedWithin];
        const cutoff = Date.now() - ms;
        fallback = fallback.filter((j) => j.postedAt >= cutoff);
      }
      if (args.source) {
        if (args.source === "private") {
          fallback = fallback.filter((j) => !j.isPublicSector);
        } else {
          const src = args.source;
          fallback = fallback.filter((j) => j.sourceIds.some((s) => s.source === src));
        }
      }

      fallback.sort((a, b) => {
        if (b.sponsorshipScore !== a.sponsorshipScore) return b.sponsorshipScore - a.sponsorshipScore;
        return b.postedAt - a.postedAt;
      });

      filtered = fallback;
    }

    const limit = Math.min(args.limit ?? 20, HARD_LIMIT);

    return {
      jobs: filtered.slice(0, limit),
      totalCount: filtered.length,
      hasMore: limit < filtered.length,
      isPro,
      hasCvUploaded: !!profile?.cvFileId,
      hasRoleVariations: variations.length > 0,
    };
  },
});

// ---------------------------------------------------------------------------
// _getJobForGenerate — internal: load a job by ID for the generate action
// ---------------------------------------------------------------------------

export const _getJobForGenerate = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => ctx.db.get(jobId),
});
