/**
 * ingest.ts — "use node" action
 *
 * Fetches jobs from a source adapter, normalises them, detects sponsorship
 * signals, then hands batches to the _upsertBatch internal mutation in
 * ingestMutations.ts for DB writes.
 *
 * Split from ingestMutations.ts because mutations cannot run in Node.js;
 * only actions can use "use node".
 */

"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

import { fetchReedExplicit, fetchReedBroad } from "./sources/reed";
import { fetchAdzunaExplicit, fetchAdzunaBroad } from "./sources/adzuna";
import { fetchNhsJobs } from "./sources/nhs";
import { fetchCivilServiceJobs } from "./sources/civilservice";
import { fetchJobsAc } from "./sources/jobsac";
import { normaliseJob } from "../lib/normaliseJob";
import { detectSponsorshipSignal } from "../lib/detectSponsorshipSignal";
import { normaliseName } from "../lib/normaliseName";

const BATCH_SIZE = 50;

export const ingestFromSource = action({
  args: {
    source: v.union(
      v.literal("reed"),
      v.literal("adzuna"),
      v.literal("nhs"),
      v.literal("civil_service"),
      v.literal("jobs_ac"),
    ),
    mode: v.union(v.literal("explicit"), v.literal("broad")),
  },
  handler: async (ctx, { source, mode }): Promise<{
    fetched: number;
    upserted: number;
    skipped: number;
  }> => {
    // --- 1. Fetch ---
    let rawJobs;

    if (source === "reed") {
      const key = process.env.REED_API_KEY;
      if (!key) throw new ConvexError({ code: "MISSING_ENV", message: "REED_API_KEY not set" });
      rawJobs = mode === "explicit"
        ? await fetchReedExplicit(key)
        : await fetchReedBroad(key);
    } else if (source === "adzuna") {
      const appId = process.env.ADZUNA_APP_ID;
      const appKey = process.env.ADZUNA_API_KEY;
      if (!appId || !appKey) throw new ConvexError({ code: "MISSING_ENV", message: "ADZUNA credentials not set" });
      rawJobs = mode === "explicit"
        ? await fetchAdzunaExplicit(appId, appKey)
        : await fetchAdzunaBroad(appId, appKey);
    } else if (source === "nhs") {
      rawJobs = await fetchNhsJobs();
    } else if (source === "civil_service") {
      rawJobs = await fetchCivilServiceJobs();
    } else {
      rawJobs = await fetchJobsAc();
    }

    // --- 2. Normalise + detect signals ---
    const payloads = rawJobs.map((raw) => {
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
        isAgency: job.isAgency,
        signalExplicit: signal.explicit,
        signalNegative: signal.negative,
      };
    });

    // --- 3. Batch upsert via mutations ---
    let upserted = 0;
    let skipped = 0;

    for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
      const batch = payloads.slice(i, i + BATCH_SIZE);
      const result = await ctx.runMutation(
        internal.jobs.ingestMutations._upsertBatch,
        { jobs: batch },
      );
      upserted += result.upserted;
      skipped += result.skipped;
    }

    return { fetched: rawJobs.length, upserted, skipped };
  },
});
