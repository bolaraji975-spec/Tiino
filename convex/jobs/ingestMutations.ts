/**
 * ingestMutations.ts — V8 runtime internal mutations
 *
 * Contains the _upsertBatch internal mutation called by ingest.ts action.
 * Must be in a separate file because mutations cannot run in Node.js ("use node").
 *
 * Scoring model (from CLAUDE.md):
 *   +40  A-rated sponsor on register
 *   +25  B-rated sponsor (40 base − 15 B-rating penalty)
 *   +20  JD explicit positive signal
 *   −50  JD negative signal
 *   −20  Salary below £41,700 Skilled Worker threshold
 *   Clamped 0–100.
 */

import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

const SKILLED_WORKER_SALARY_THRESHOLD = 41_700;

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

function computeScore(
  sponsorRating: string | null,
  signalExplicit: boolean,
  signalNegative: boolean,
  salaryMin: number | null,
  salaryMax: number | null,
): number {
  let score = 0;

  if (sponsorRating) {
    const r = sponsorRating.toLowerCase();
    if (r.includes("a-rat") || r.includes("a rating")) {
      score += 40;
    } else if (r.includes("b-rat") || r.includes("b rating")) {
      score += 25;
    }
  }

  if (signalExplicit) score += 20;
  if (signalNegative) score -= 50;

  const salaryRef = salaryMin ?? salaryMax;
  if (salaryRef !== null && salaryRef < SKILLED_WORKER_SALARY_THRESHOLD) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

function scoreToBand(score: number): "high" | "medium" | "low" | "very_low" {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  if (score >= 25) return "low";
  return "very_low";
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

const jobInputValidator = v.object({
  sourceId: v.object({
    source: v.union(
      v.literal("reed"),
      v.literal("adzuna"),
      v.literal("nhs"),
      v.literal("civil_service"),
      v.literal("jobs_ac"),
      v.literal("find_a_job"),
      v.literal("greenhouse"),
      v.literal("lever"),
      v.literal("workable"),
      v.literal("smartrecruiters"),
      v.literal("recruitee"),
      v.literal("ashby"),
      v.literal("breezy"),
    ),
    externalId: v.string(),
    applyUrl: v.string(),
  }),
  dedupeHash: v.string(),
  title: v.string(),
  company: v.string(),
  companyNormalised: v.string(),
  location: v.string(),
  locationCity: v.union(v.string(), v.null()),
  salaryMin: v.union(v.number(), v.null()),
  salaryMax: v.union(v.number(), v.null()),
  description: v.string(),
  postedAt: v.number(),
  isAgency: v.boolean(),
  isPublicSector: v.boolean(),
  extractedCriteria: v.optional(v.array(v.string())),
  signalExplicit: v.boolean(),
  signalNegative: v.boolean(),
});

// ---------------------------------------------------------------------------
// Internal mutation
// ---------------------------------------------------------------------------

/**
 * Returns the subset of the supplied dedupe hashes that already exist in the DB.
 * Used by ingest.ts to skip Claude criteria extraction for known-duplicate jobs.
 */
export const _getExistingHashes = internalQuery({
  args: { hashes: v.array(v.string()) },
  handler: async (ctx, { hashes }): Promise<string[]> => {
    const found: string[] = [];
    for (const hash of hashes) {
      const exists = await ctx.db
        .query("jobs")
        .withIndex("byDedupeHash", (q) => q.eq("dedupeHash", hash))
        .first();
      if (exists) found.push(hash);
    }
    return found;
  },
});

export const _upsertBatch = internalMutation({
  args: { jobs: v.array(jobInputValidator) },
  handler: async (ctx, { jobs }): Promise<{ upserted: number; skipped: number }> => {
    let upserted = 0;
    let skipped = 0;

    for (const job of jobs) {
      // Dedup by hash
      const existing = await ctx.db
        .query("jobs")
        .withIndex("byDedupeHash", (q) => q.eq("dedupeHash", job.dedupeHash))
        .first();

      if (existing) {
        // Merge new source ID if not already tracked
        const hasSource = existing.sourceIds.some(
          (s) => s.source === job.sourceId.source && s.externalId === job.sourceId.externalId,
        );
        if (!hasSource) {
          await ctx.db.patch(existing._id, {
            sourceIds: [...existing.sourceIds, job.sourceId],
          });
        }
        skipped++;
        continue;
      }

      // Sponsor lookup — direct index
      let sponsorId: Id<"sponsors"> | undefined;
      let sponsorRating: string | null = null;

      const sponsor = await ctx.db
        .query("sponsors")
        .withIndex("byNormalisedName", (q) =>
          q.eq("normalisedName", job.companyNormalised),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (sponsor) {
        sponsorId = sponsor._id;
        sponsorRating = sponsor.rating;
      } else {
        // Try via trading names
        const tradingEntry = await ctx.db
          .query("tradingNames")
          .withIndex("byNormalisedTrading", (q) =>
            q.eq("normalisedTrading", job.companyNormalised),
          )
          .first();

        if (tradingEntry) {
          const legalSponsor = await ctx.db
            .query("sponsors")
            .withIndex("byNormalisedName", (q) =>
              q.eq("normalisedName", tradingEntry.normalisedLegal),
            )
            .filter((q) => q.eq(q.field("isActive"), true))
            .first();

          if (legalSponsor) {
            sponsorId = legalSponsor._id;
            sponsorRating = legalSponsor.rating;
          }
        }
      }

      // Compute score and band
      const score = computeScore(
        sponsorRating,
        job.signalExplicit,
        job.signalNegative,
        job.salaryMin,
        job.salaryMax,
      );
      const band = scoreToBand(score);

      const scoreBreakdown = [
        {
          signal: "sponsor_register",
          weight: sponsorRating
            ? sponsorRating.toLowerCase().includes("a-rat") || sponsorRating.toLowerCase().includes("a rating") ? 40 : 25
            : 0,
          matched: !!sponsorId,
        },
        { signal: "explicit_jd_signal", weight: 20, matched: job.signalExplicit },
        { signal: "negative_jd_signal", weight: -50, matched: job.signalNegative },
        {
          signal: "salary_threshold",
          weight: -20,
          matched: (job.salaryMin ?? job.salaryMax ?? Infinity) < SKILLED_WORKER_SALARY_THRESHOLD,
        },
      ];

      await ctx.db.insert("jobs", {
        sourceIds: [job.sourceId],
        dedupeHash: job.dedupeHash,
        title: job.title,
        company: job.company,
        companyNormalised: job.companyNormalised,
        location: job.location,
        ...(job.locationCity !== null ? { locationCity: job.locationCity } : {}),
        ...(job.salaryMin !== null ? { salaryMin: job.salaryMin } : {}),
        ...(job.salaryMax !== null ? { salaryMax: job.salaryMax } : {}),
        description: job.description,
        postedAt: job.postedAt,
        isAgency: job.isAgency,
        isPublicSector: job.isPublicSector,
        ...(job.extractedCriteria !== undefined ? { extractedCriteria: job.extractedCriteria } : {}),
        sponsorshipScore: score,
        sponsorshipBand: band,
        scoreBreakdown,
        ...(sponsorId ? { sponsorId } : {}),
        ...(job.signalExplicit ? { explicit: true } : {}),
        isActive: true,
      });

      upserted++;
    }

    return { upserted, skipped };
  },
});
