/**
 * getCareersUrls.ts
 *
 * Internal queries that return active sponsors that have a careersUrl set.
 * Used by the ATS ingestion action to know which companies to fetch jobs from.
 *
 * WHY PAGINATED:
 * The sponsors table has ~130 k rows. Convex's document-read limit is 32 000
 * per function call, so a single .collect() over all active sponsors fails.
 * Instead we expose a paginated query that the action calls in a loop —
 * each call reads ≤2 000 documents (well within the limit).
 *
 * Returns [] until sponsors are enriched with careers URLs via:
 *   - convex/sponsors/atsSeed.ts (one-time seed for known UK tech sponsors)
 *   - convex/sponsors/enrichCareersUrls.ts (Google Search enrichment, P2)
 */

import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Paginated query — fetches one page of active sponsors at a time and
 * filters to those with a careersUrl set.
 *
 * Usage in an action:
 *   let cursor: string | null = null;
 *   do {
 *     const { items, cursor: next, isDone } = await ctx.runQuery(
 *       internal.sponsors.getCareersUrls.getSponsorCareersUrlsPage,
 *       { cursor },
 *     );
 *     // process items...
 *     cursor = next;
 *     if (isDone) break;
 *   } while (true);
 */
export const getSponsorCareersUrlsPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (
    ctx,
    { cursor },
  ): Promise<{
    items: { name: string; careersUrl: string }[];
    cursor: string | null;
    isDone: boolean;
  }> => {
    const { page, isDone, continueCursor } = await ctx.db
      .query("sponsors")
      .withIndex("byActive", (q) => q.eq("isActive", true))
      .paginate({ cursor, numItems: 2000 });

    const items = page
      .filter((s) => typeof s.careersUrl === "string" && s.careersUrl.length > 0)
      .map((s) => ({ name: s.legalName, careersUrl: s.careersUrl as string }));

    return { items, cursor: continueCursor, isDone };
  },
});
