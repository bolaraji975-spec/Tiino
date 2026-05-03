/**
 * refresh.ts
 *
 * Weekly action that fetches the Home Office sponsor register CSV,
 * upserts all records into the `sponsors` table, deactivates employers
 * no longer on the register, and records a sponsorSnapshots row.
 *
 * Run manually:  npx convex run sponsors/refresh:refreshSponsorRegister '{}'
 * Scheduled:     weekly cron in convex/crons.ts (Monday 02:00 UTC)
 */

import { action, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { parseSponsorCsv } from "../lib/parseSponsorCsv";

const REGISTER_PAGE_URL =
  "https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers";

/** Records per internal mutation call — stays within Convex read/write limits. */
const BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// CSV URL discovery
// ---------------------------------------------------------------------------

/**
 * Scrape the gov.uk register page to find the latest CSV download URL.
 * gov.uk attachments appear as full https://assets.publishing.service.gov.uk/…
 * URLs or relative /government/uploads/… paths in the page HTML.
 */
async function discoverCsvUrl(): Promise<string> {
  const res = await fetch(REGISTER_PAGE_URL);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch register page (HTTP ${res.status}): ${REGISTER_PAGE_URL}`,
    );
  }
  const html = await res.text();

  const patterns = [
    /href="(https:\/\/assets\.publishing\.service\.gov\.uk\/[^"]*\.csv)"/i,
    /href="(\/government\/uploads\/[^"]*\.csv)"/i,
    /href="(\/media\/[^"]*\.csv)"/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const url = match[1]!;
      return url.startsWith("http") ? url : `https://www.gov.uk${url}`;
    }
  }

  throw new Error(
    "Could not find CSV download link on Home Office register page. " +
      "The page layout may have changed — update the URL patterns in refresh.ts.",
  );
}

// ---------------------------------------------------------------------------
// Public action
// ---------------------------------------------------------------------------

export const refreshSponsorRegister = action({
  args: {},
  handler: async (ctx): Promise<{
    totalRows: number;
    activeCount: number;
    deactivated: number;
  }> => {
    const fetchedAt = Date.now();
    let csvUrl = "";

    // --- 1. Discover CSV URL ---
    try {
      csvUrl = await discoverCsvUrl();
    } catch (err) {
      await ctx.runMutation(internal.sponsors.refresh._recordSnapshot, {
        fetchedAt,
        csvUrl: REGISTER_PAGE_URL,
        totalRows: 0,
        activeCount: 0,
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    // --- 2. Download CSV ---
    let csvText: string;
    try {
      const csvRes = await fetch(csvUrl);
      if (!csvRes.ok) {
        throw new Error(`CSV download failed (HTTP ${csvRes.status}): ${csvUrl}`);
      }
      csvText = await csvRes.text();
    } catch (err) {
      await ctx.runMutation(internal.sponsors.refresh._recordSnapshot, {
        fetchedAt,
        csvUrl,
        totalRows: 0,
        activeCount: 0,
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    // --- 3. Parse CSV ---
    const { records, totalRows } = parseSponsorCsv(csvText, fetchedAt);

    // --- 4. Upsert all records in batches ---
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      await ctx.runMutation(internal.sponsors.refresh._upsertBatch, {
        records: batch.map((r) => ({
          legalName: r.legalName,
          normalisedName: r.normalisedName,
          town: r.town ?? null,
          county: r.county ?? null,
          rating: r.rating,
          route: r.route,
          fetchedAt,
        })),
      });
    }

    // --- 5. Deactivate sponsors absent from this run ---
    let deactivated = 0;
    let hasMore = true;
    while (hasMore) {
      const count = await ctx.runMutation(
        internal.sponsors.refresh._deactivateStaleBatch,
        { fetchedAt },
      );
      deactivated += count;
      hasMore = count > 0;
    }

    // --- 6. Record snapshot ---
    await ctx.runMutation(internal.sponsors.refresh._recordSnapshot, {
      fetchedAt,
      csvUrl,
      totalRows,
      activeCount: records.length,
      status: "ok",
    });

    return { totalRows, activeCount: records.length, deactivated };
  },
});

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
    const stale = await ctx.db
      .query("sponsors")
      .withIndex("byActive", (q) => q.eq("isActive", true))
      .filter((q) => q.lt(q.field("fetchedAt"), fetchedAt))
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
 *
 * @param currentActiveCount  - Active-sponsor count from the current run
 * @param previousActiveCount - Active-sponsor count from the last snapshot, or undefined
 * @param currentStatus       - "ok" | "error"
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
  handler: async (ctx, args) => {
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
  },
});
