"use node";
/**
 * ingestAts.ts
 *
 * Action that ingests jobs from all active UKVI sponsors that have a
 * careersUrl set in the sponsors table.
 *
 * Flow:
 * 1. Page through sponsors with careersUrl (getSponsorCareersUrlsPage)
 * 2. For each page, process sponsors in parallel batches of CONCURRENCY
 * 3. fetchAtsJobs() → normalise → dedupe → upsert
 *
 * Run manually:
 *   npx convex run jobs/ingestAts:ingestFromAts '{}'
 *
 * Scheduled:
 *   Cron in convex/crons.ts (nightly, ~5 AM UTC)
 */

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { fetchAtsJobs } from "./sources/ats";
import { normaliseJob } from "../lib/normaliseJob";
import { detectSponsorshipSignal } from "../lib/detectSponsorshipSignal";
import { normaliseName } from "../lib/normaliseName";

/** How many companies to fetch in parallel per iteration */
const CONCURRENCY = 10;
/** How many jobs to write per mutation call */
const BATCH_SIZE = 50;

export const ingestFromAts = action({
  args: {},
  handler: async (ctx): Promise<{
    sponsorsChecked: number;
    fetched: number;
    upserted: number;
    skipped: number;
  }> => {
    let cursor: string | null = null;
    let isDone = false;

    let sponsorsChecked = 0;
    let fetched = 0;
    let upserted = 0;
    let skipped = 0;

    while (!isDone) {
      // --- 1. Fetch next page of sponsors with careersUrl ---
      const page: {
        items: { name: string; careersUrl: string }[];
        cursor: string | null;
        isDone: boolean;
      } = await ctx.runQuery(
        internal.sponsors.getCareersUrls.getSponsorCareersUrlsPage,
        { cursor },
      );
      cursor = page.cursor;
      isDone = page.isDone;

      const sponsors = page.items;
      if (sponsors.length === 0) continue;

      // --- 2. Process sponsors in batches of CONCURRENCY ---
      for (let i = 0; i < sponsors.length; i += CONCURRENCY) {
        const batch = sponsors.slice(i, i + CONCURRENCY);

        const rawJobsArrays = await Promise.all(
          batch.map(({ name, careersUrl }) =>
            fetchAtsJobs(name, careersUrl).catch(() => []),
          ),
        );

        const rawJobs = rawJobsArrays.flat();
        sponsorsChecked += batch.length;
        fetched += rawJobs.length;

        if (rawJobs.length === 0) continue;

        // --- 3. Normalise ---
        const normalised = rawJobs.map((raw) => {
          const job = normaliseJob(raw);
          const signal = detectSponsorshipSignal(raw.description);
          const companyNorm = normaliseName(raw.company);
          return {
            sourceId: job.sourceId,
            dedupeHash: job.dedupeHash,
            title: job.title,
            company: job.company,
            companyNormalised: companyNorm,
            location: job.location,
            locationCity: job.locationCity ?? null,
            salaryMin: job.salaryMin ?? null,
            salaryMax: job.salaryMax ?? null,
            description: job.description,
            postedAt: job.postedAt,
            isAgency: false, // all ATS jobs come directly from the employer
            isPublicSector: false, // ATS sources are not public sector
            signalExplicit: true, // confirmed UKVI sponsor, treat as explicit
            signalNegative: signal.negative,
            extractedCriteria: undefined as string[] | undefined,
          };
        });

        // --- 4. Batch upsert ---
        for (let j = 0; j < normalised.length; j += BATCH_SIZE) {
          const slice = normalised.slice(j, j + BATCH_SIZE);
          const result = await ctx.runMutation(
            internal.jobs.ingestMutations._upsertBatch,
            { jobs: slice },
          );
          upserted += result.upserted;
          skipped += result.skipped;
        }
      }
    }

    console.log(
      `ATS ingest complete: checked=${sponsorsChecked} fetched=${fetched} upserted=${upserted} skipped=${skipped}`,
    );

    return { sponsorsChecked, fetched, upserted, skipped };
  },
});
