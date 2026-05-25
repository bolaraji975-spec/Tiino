/**
 * getCareersUrls.ts
 *
 * Internal query that returns all active sponsors that have a careersUrl set.
 * Used by the ATS ingestion action to know which companies to fetch jobs from.
 *
 * Returns [] until sponsors are enriched with careers URLs via:
 *   - convex/sponsors/enrichCareersUrls.ts (Google Search enrichment), or
 *   - convex/sponsors/atsSeed.ts (one-time seed for known UK tech sponsors)
 */

import { internalQuery } from "../_generated/server";

export const getSponsorCareersUrls = internalQuery({
  args: {},
  handler: async (ctx): Promise<{ name: string; careersUrl: string }[]> => {
    const sponsors = await ctx.db
      .query("sponsors")
      .withIndex("byActive", (q) => q.eq("isActive", true))
      .collect();

    return sponsors
      .filter((s) => typeof s.careersUrl === "string" && s.careersUrl.length > 0)
      .map((s) => ({
        name: s.legalName,
        careersUrl: s.careersUrl as string,
      }));
  },
});
