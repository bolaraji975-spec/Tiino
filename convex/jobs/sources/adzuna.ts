/**
 * Adzuna API adapter
 *
 * Docs: https://developer.adzuna.com/
 * Auth: app_id + app_key query params
 * Base: https://api.adzuna.com/v1/api/jobs/gb/search/{page}
 *
 * Two search modes:
 *   explicit — keyword "visa sponsorship"
 *   broad    — role-based search across UK
 */

import type { RawJob } from "../types";

const BASE_URL = "https://api.adzuna.com/v1/api/jobs/gb/search";
const RESULTS_PER_PAGE = 50;
const RESULTS_CAP = 250;

// ---------------------------------------------------------------------------
// API types (partial)
// ---------------------------------------------------------------------------

type AdzunaJob = {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string; area?: string[] };
  description: string;
  salary_min: number | null;
  salary_max: number | null;
  created: string;
  redirect_url: string;
  contract_time?: string | null;
  category?: { label?: string };
};

type AdzunaSearchResponse = {
  results: AdzunaJob[];
  count: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function locationCity(job: AdzunaJob): string | undefined {
  // area is typically ["UK", "South East", "London", "City of London"]
  const area = job.location.area;
  if (area && area.length >= 3) return area[area.length - 1];
  return undefined;
}

function isAgency(job: AdzunaJob): boolean {
  const name = job.company.display_name.toLowerCase();
  return /recruitment|staffing|consulting|resourcing|talent|search|manpower|hays|reed|adecco|randstad|michael\s+page|robert\s+half/i.test(name);
}

async function fetchPage(
  appId: string,
  appKey: string,
  what: string,
  page: number,
): Promise<AdzunaSearchResponse> {
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what,
    where: "UK",
    results_per_page: String(RESULTS_PER_PAGE),
    content_type: "application/json",
    full_time: "1",
  });

  const res = await fetch(`${BASE_URL}/${page}?${params}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Adzuna API error (HTTP ${res.status}): ${await res.text().catch(() => "")}`);
  }

  return res.json() as Promise<AdzunaSearchResponse>;
}

function toRawJob(job: AdzunaJob): RawJob {
  return {
    externalId: job.id,
    source: "adzuna",
    title: job.title.trim(),
    company: job.company.display_name.trim(),
    location: job.location.display_name.trim(),
    description: job.description,
    salaryMin: job.salary_min ?? undefined,
    salaryMax: job.salary_max ?? undefined,
    salaryCurrency: "GBP",
    salaryPeriod: "year",
    postedAt: new Date(job.created).getTime(),
    applyUrl: job.redirect_url,
    isAgency: isAgency(job),
  };
}

// ---------------------------------------------------------------------------
// Public adapter functions
// ---------------------------------------------------------------------------

export async function fetchAdzunaExplicit(
  appId: string,
  appKey: string,
): Promise<RawJob[]> {
  return fetchAdzuna(appId, appKey, "visa sponsorship");
}

export async function fetchAdzunaBroad(
  appId: string,
  appKey: string,
  keywords = "software engineer developer analyst",
): Promise<RawJob[]> {
  return fetchAdzuna(appId, appKey, keywords);
}

async function fetchAdzuna(
  appId: string,
  appKey: string,
  what: string,
): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  let page = 1;

  while (jobs.length < RESULTS_CAP) {
    const data = await fetchPage(appId, appKey, what, page);
    if (data.results.length === 0) break;

    for (const job of data.results) {
      jobs.push(toRawJob(job));
    }

    page++;
    if (jobs.length >= data.count) break;
  }

  return jobs;
}
