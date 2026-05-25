"use node";
/**
 * refresh.ts
 *
 * Weekly action that fetches the Home Office sponsor register CSV,
 * upserts all records into the `sponsors` table, deactivates employers
 * no longer on the register, and records a sponsorSnapshots row.
 *
 * Run manually:  npx convex run sponsors/refresh:refreshSponsorRegister '{}'
 * Scheduled:     weekly cron in convex/crons.ts (Monday 02:00 UTC)
 *
 * Note: "use node" is required here because the gov.uk CSV is several MB —
 * the V8 runtime has a ~512 KB response body limit which causes fetch to fail.
 * Mutations are split into refreshMutations.ts (mutations can't run in Node.js).
 */

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { parseSponsorCsv } from "../lib/parseSponsorCsv";
import {
  shouldAlertOnDrop,
  sendRefreshFailureAlert,
  sendDropAlert,
} from "../lib/alerts";

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
      console.log(`Discovered CSV URL: ${csvUrl}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.error(`Step 1 failed: ${errorMessage}`);
      await ctx.runMutation(internal.sponsors.refreshMutations._recordSnapshot, {
        fetchedAt,
        csvUrl: REGISTER_PAGE_URL,
        totalRows: 0,
        activeCount: 0,
        status: "error",
        errorMessage,
      });
      await sendRefreshFailureAlert(errorMessage);
      throw new Error(`Step 1 (discover CSV URL) failed: ${errorMessage}`);
    }

    // --- 2. Download CSV ---
    let csvText: string;
    try {
      console.log(`Downloading CSV from: ${csvUrl}`);
      const csvRes = await fetch(csvUrl);
      if (!csvRes.ok) {
        throw new Error(`CSV download failed (HTTP ${csvRes.status}): ${csvUrl}`);
      }
      csvText = await csvRes.text();
      console.log(`Downloaded CSV: ${csvText.length} chars`);
    } catch (err) {
      const errorMessage = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.error(`Step 2 failed: ${errorMessage}`);
      await ctx.runMutation(internal.sponsors.refreshMutations._recordSnapshot, {
        fetchedAt,
        csvUrl,
        totalRows: 0,
        activeCount: 0,
        status: "error",
        errorMessage,
      });
      await sendRefreshFailureAlert(errorMessage);
      throw new Error(`Step 2 (download CSV) failed: ${errorMessage}`);
    }

    // --- 3. Parse CSV ---
    let records: ReturnType<typeof parseSponsorCsv>["records"];
    let totalRows: number;
    try {
      const parsed = parseSponsorCsv(csvText, fetchedAt);
      records = parsed.records;
      totalRows = parsed.totalRows;
      console.log(`Parsed CSV: ${totalRows} total rows, ${records.length} Skilled Worker sponsors`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.sponsors.refreshMutations._recordSnapshot, {
        fetchedAt,
        csvUrl,
        totalRows: 0,
        activeCount: 0,
        status: "error",
        errorMessage: `CSV parse failed: ${errorMessage}`,
      });
      throw new Error(`CSV parse failed: ${errorMessage}`);
    }

    // --- 4. Upsert all records in batches ---
    try {
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        await ctx.runMutation(internal.sponsors.refreshMutations._upsertBatch, {
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
        if (i % 10000 === 0) {
          console.log(`Upserted ${i}/${records.length} sponsors`);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      throw new Error(`Upsert batch failed: ${errorMessage}`);
    }

    // --- 5. Deactivate sponsors absent from this run ---
    let deactivated = 0;
    let hasMore = true;
    try {
      while (hasMore) {
        const count = await ctx.runMutation(
          internal.sponsors.refreshMutations._deactivateStaleBatch,
          { fetchedAt },
        );
        deactivated += count;
        hasMore = count > 0;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      throw new Error(`Deactivate stale failed: ${errorMessage}`);
    }

    // --- 6. Record snapshot and check for drop alert ---
    const { previousActiveCount } = await ctx.runMutation(
      internal.sponsors.refreshMutations._recordSnapshot,
      {
        fetchedAt,
        csvUrl,
        totalRows,
        activeCount: records.length,
        status: "ok",
      },
    );

    if (
      previousActiveCount !== undefined &&
      shouldAlertOnDrop(previousActiveCount, records.length)
    ) {
      await sendDropAlert(previousActiveCount, records.length);
    }

    return { totalRows, activeCount: records.length, deactivated };
  },
});
