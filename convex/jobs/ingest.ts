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
import { fetchFindAJob } from "./sources/findajob";
import { normaliseJob } from "../lib/normaliseJob";
import { detectSponsorshipSignal } from "../lib/detectSponsorshipSignal";
import { normaliseName } from "../lib/normaliseName";

const BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Claude Haiku — extract essential criteria from public sector JDs
// ---------------------------------------------------------------------------

async function extractCriteria(description: string, apiKey: string): Promise<string[]> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Extract the essential criteria or person specification requirements from this job description as a JSON array of strings. Return only the JSON array, nothing else.\n\n${description}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    // Non-fatal — log and return empty rather than failing the whole batch
    console.error(`Claude Haiku criteria extraction failed: ${response.status}`);
    return [];
  }

  const data = await response.json() as {
    content: Array<{ type: string; text: string }>;
  };
  const text = data.content?.[0]?.text ?? "[]";

  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return (parsed as unknown[])
        .filter((item): item is string => typeof item === "string")
        .slice(0, 20); // guard against runaway arrays
    }
  } catch {
    // Malformed JSON — skip silently
  }
  return [];
}

export const ingestFromSource = action({
  args: {
    source: v.union(
      v.literal("reed"),
      v.literal("adzuna"),
      v.literal("nhs"),
      v.literal("civil_service"),
      v.literal("jobs_ac"),
      v.literal("find_a_job"),
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
    } else if (source === "find_a_job") {
      rawJobs = await fetchFindAJob();
    } else {
      rawJobs = await fetchJobsAc();
    }

    // --- 2. Normalise + detect signals ---
    const normalised = rawJobs.map((raw) => {
      const job = normaliseJob(raw);
      const signal = detectSponsorshipSignal(raw.description);
      const signalExplicitOverride = raw.explicit === true;
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
        isPublicSector: job.isPublicSector,
        signalExplicit: signalExplicitOverride || signal.explicit,
        signalNegative: signal.negative,
      };
    });

    // --- 2b. Identify new (not-yet-in-DB) jobs before criteria extraction ---
    // This avoids burning Anthropic quota on jobs that will be deduped away.
    const knownHashes = await ctx.runQuery(
      internal.jobs.ingestMutations._getExistingHashes,
      { hashes: normalised.map((j) => j.dedupeHash) },
    );
    const knownSet = new Set(knownHashes);

    // --- 2c. Extract criteria for NEW public sector jobs via Claude Haiku ---
    // Process one at a time with a 500 ms gap to stay within free-tier limits.
    // Existing jobs keep extractedCriteria: undefined (already stored in DB).
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const payloads: (typeof normalised[number] & { extractedCriteria?: string[] })[] = [];
    for (const job of normalised) {
      if (job.isPublicSector && anthropicKey && !knownSet.has(job.dedupeHash)) {
        const criteria = await extractCriteria(job.description, anthropicKey);
        payloads.push({ ...job, extractedCriteria: criteria.length > 0 ? criteria : undefined });
        // Small delay to respect Anthropic free-tier rate limits (~2 req/s)
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        payloads.push({ ...job, extractedCriteria: undefined });
      }
    }

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
