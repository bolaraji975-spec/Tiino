/**
 * Reed API adapter
 *
 * Docs: https://www.reed.co.uk/developers/jobseeker
 * Auth: HTTP Basic — API key as username, empty password
 * Base: https://www.reed.co.uk/api/1.0/
 *
 * Two search modes:
 *   explicit — keyword "visa sponsorship" to surface self-declared listings
 *   broad    — role-based search across UK (all jobs, sponsor-match done later)
 *
 * Reed returns up to 100 results per request; we paginate to RESULTS_CAP.
 */

import type { RawJob } from "../types";

const BASE_URL = "https://www.reed.co.uk/api/1.0";
const RESULTS_PER_PAGE = 100;
const RESULTS_CAP = 500; // max jobs fetched per run to stay within action limits

// ---------------------------------------------------------------------------
// API types (partial — only fields we use)
// ---------------------------------------------------------------------------

type ReedJob = {
  jobId: number;
  employerName: string;
  jobTitle: string;
  locationName: string;
  minimumSalary: number | null;
  maximumSalary: number | null;
  currency: string | null;
  date: string;
  expirationDate: string | null;
  jobDescription: string;
  jobUrl: string;
  recruitmentAgency: string | null;
};

type ReedSearchResponse = {
  results: ReedJob[];
  totalResults: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authHeader(apiKey: string): string {
  return "Basic " + Buffer.from(apiKey + ":").toString("base64");
}

async function fetchPage(
  apiKey: string,
  keywords: string,
  resultsToSkip: number,
): Promise<ReedSearchResponse> {
  const params = new URLSearchParams({
    keywords,
    locationName: "United Kingdom",
    distancefromlocation: "0",
    fulltime: "true",
    resultsToTake: String(RESULTS_PER_PAGE),
    resultsToSkip: String(resultsToSkip),
  });

  const res = await fetch(`${BASE_URL}/search?${params}`, {
    headers: {
      Authorization: authHeader(apiKey),
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Reed API error (HTTP ${res.status}): ${await res.text().catch(() => "")}`);
  }

  return res.json() as Promise<ReedSearchResponse>;
}

// Reed returns dates as "13/05/2026" (DD/MM/YYYY) or ISO strings.
// new Date("13/05/2026") is Invalid in V8 — parse explicitly.
function parseReedDate(dateStr: string | undefined): number {
  if (!dateStr) return Date.now();
  const iso = new Date(dateStr);
  if (!isNaN(iso.getTime())) return iso.getTime();
  const parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (parts) return new Date(`${parts[3]}-${parts[2]}-${parts[1]}`).getTime();
  return Date.now();
}

function toRawJob(job: ReedJob): RawJob {
  return {
    externalId: String(job.jobId),
    source: "reed",
    title: job.jobTitle.trim(),
    company: job.employerName.trim(),
    location: job.locationName.trim(),
    description: job.jobDescription,
    salaryMin: job.minimumSalary ?? undefined,
    salaryMax: job.maximumSalary ?? undefined,
    salaryCurrency: job.currency ?? "GBP",
    salaryPeriod: "year",
    postedAt: parseReedDate(job.date),
    applyUrl: job.jobUrl,
    isAgency: job.recruitmentAgency !== null && job.recruitmentAgency !== "",
  };
}

// ---------------------------------------------------------------------------
// Public adapter functions
// ---------------------------------------------------------------------------

/**
 * Explicit mode: search for sponsorship keywords — returns jobs where
 * employers have self-declared they can sponsor. Deduplicates across both
 * keyword searches by Reed job ID.
 */
export async function fetchReedExplicit(apiKey: string): Promise<RawJob[]> {
  const [visaJobs, cosJobs] = await Promise.all([
    fetchReed(apiKey, "visa sponsorship"),
    fetchReed(apiKey, "certificate of sponsorship"),
  ]);

  const seen = new Set<string>();
  const merged: RawJob[] = [];
  for (const job of [...visaJobs, ...cosJobs]) {
    if (!seen.has(job.externalId)) {
      seen.add(job.externalId);
      merged.push({ ...job, explicit: true });
    }
  }
  return merged;
}

/**
 * Broad mode: search by role keywords — returns a wider set of jobs
 * for sponsor-matching against the register.
 */
export async function fetchReedBroad(
  apiKey: string,
  roleKeywords = "software engineer developer analyst manager",
): Promise<RawJob[]> {
  return fetchReed(apiKey, roleKeywords);
}

async function fetchReed(apiKey: string, keywords: string): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  let skip = 0;

  while (jobs.length < RESULTS_CAP) {
    const page = await fetchPage(apiKey, keywords, skip);
    if (page.results.length === 0) break;

    for (const job of page.results) {
      jobs.push(toRawJob(job));
    }

    skip += RESULTS_PER_PAGE;
    if (skip >= page.totalResults) break;
  }

  return jobs;
}
