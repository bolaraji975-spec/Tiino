/**
 * refreshMutations.ts
 *
 * Internal mutations called by the refreshSponsorRegister action in refresh.ts.
 * Split into a separate file because "use node" (required for the fetch action)
 * prevents mutations from being defined in the same module.
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/** Records per internal mutation call — stays within Convex read/write limits. */
const BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// Internal mutations
// ---------------------------------------------------------------------------

/**
 * Upsert a batch of sponsor records.
 * Matches on normalisedName — if found, patches in place; otherwise inserts.
 */
export const _upsertBatch = internalMutation({
  args: {
    records: v.array(
      v.object({
        legalName: v.string(),
        normalisedName: v.string(),
        town: v.union(v.string(), v.null()),
        county: v.union(v.string(), v.null()),
        rating: v.string(),
        route: v.string(),
        fetchedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, { records }) => {
    for (const record of records) {
      const existing = await ctx.db
        .query("sponsors")
        .withIndex("byNormalisedName", (q) =>
          q.eq("normalisedName", record.normalisedName),
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          legalName: record.legalName,
          town: record.town ?? undefined,
          county: record.county ?? undefined,
          rating: record.rating,
          route: record.route,
          isActive: true,
          fetchedAt: record.fetchedAt,
        });
      } else {
        await ctx.db.insert("sponsors", {
          legalName: record.legalName,
          normalisedName: record.normalisedName,
          town: record.town ?? undefined,
          county: record.county ?? undefined,
          rating: record.rating,
          route: record.route,
          isActive: true,
          fetchedAt: record.fetchedAt,
        });
      }
    }
  },
});

/**
 * Deactivate up to BATCH_SIZE active sponsors whose fetchedAt predates
 * the current run. Called in a loop from the action until it returns 0.
 */
export const _deactivateStaleBatch = internalMutation({
  args: { fetchedAt: v.number() },
  handler: async (ctx, { fetchedAt }): Promise<number> => {
    // Use the compound index so only docs that are BOTH active AND have an
    // old fetchedAt are read — avoids scanning all 130k+ active sponsors.
    const stale = await ctx.db
      .query("sponsors")
      .withIndex("byActiveFetched", (q) =>
        q.eq("isActive", true).lt("fetchedAt", fetchedAt),
      )
      .take(BATCH_SIZE);

    for (const sponsor of stale) {
      await ctx.db.patch(sponsor._id, { isActive: false });
    }

    return stale.length;
  },
});

// ---------------------------------------------------------------------------
// Snapshot diff helpers
// ---------------------------------------------------------------------------

/**
 * Compute the added/removed sponsor diff between two consecutive snapshots.
 *
 * Because we only store the aggregate `activeCount` per snapshot (not the full
 * set of normalised names), the diff is a net-delta split: if the active count
 * rose by N then addedSinceLast=N and removedSinceLast=0, and vice-versa.
 *
 * Returns `{ addedSinceLast: undefined, removedSinceLast: undefined }` when:
 * - there is no previous snapshot (first-ever run), or
 * - the current run has status "error" (counts are unreliable).
 */
export function computeSnapshotDiff(
  currentActiveCount: number,
  previousActiveCount: number | undefined,
  currentStatus: "ok" | "error",
): { addedSinceLast: number | undefined; removedSinceLast: number | undefined } {
  if (previousActiveCount === undefined || currentStatus === "error") {
    return { addedSinceLast: undefined, removedSinceLast: undefined };
  }
  return {
    addedSinceLast: Math.max(0, currentActiveCount - previousActiveCount),
    removedSinceLast: Math.max(0, previousActiveCount - currentActiveCount),
  };
}

/**
 * Insert a sponsorSnapshots row. Computes added/removed diffs against
 * the most recent previous snapshot when status is "ok".
 */
export const _recordSnapshot = internalMutation({
  args: {
    fetchedAt: v.number(),
    csvUrl: v.string(),
    totalRows: v.number(),
    activeCount: v.number(),
    status: v.union(v.literal("ok"), v.literal("error")),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ previousActiveCount: number | undefined }> => {
    const previous = await ctx.db
      .query("sponsorSnapshots")
      .withIndex("byFetchedAt")
      .order("desc")
      .first();

    const { addedSinceLast, removedSinceLast } = computeSnapshotDiff(
      args.activeCount,
      previous?.activeCount,
      args.status,
    );

    await ctx.db.insert("sponsorSnapshots", {
      fetchedAt: args.fetchedAt,
      csvUrl: args.csvUrl,
      totalRows: args.totalRows,
      activeCount: args.activeCount,
      addedSinceLast,
      removedSinceLast,
      status: args.status,
      errorMessage: args.errorMessage,
    });

    return { previousActiveCount: previous?.activeCount };
  },
});
