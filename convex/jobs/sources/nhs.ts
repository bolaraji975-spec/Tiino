/**
 * NHS Jobs public API adapter
 *
 * Endpoint: https://jobs.nhs.uk/api/v1/search
 * Auth: none (public API)
 * Docs: https://jobs.nhs.uk/employer/api-documentation
 *
 * All NHS employers are public-sector bodies. None are recruitment agencies.
 * The NHS is a licensed Skilled Worker sponsor — sponsor matching happens
 * via the register, not here.
 */

import type { RawJob } from "../types";

const BASE_URL = "https://jobs.nhs.uk/api/v1/search";
const PAGE_SIZE = 100;
const RESULTS_CAP = 500;

// ---------------------------------------------------------------------------
// API types (partial)
// ---------------------------------------------------------------------------

type NhsLocation = {
  town?: string;
  county?: string;
  region?: string;
};

type NhsPayScheme = {
  minimum?: number;
  maximum?: number;
  payBand?: string;
};

type NhsVacancy = {
  vacancyId: string;
  jobTitle: string;
  employer: { name: string };
  location: NhsLocation;
  payScheme?: NhsPayScheme;
  closingDate?: string;
  publicationDate?: string;
  shortDescription?: string;
  url?: string;
};

type NhsSearchResponse = {
  data?: NhsVacancy[];
  totalResults?: number;
  // some endpoints use "vacancies" key
  vacancies?: NhsVacancy[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildLocation(loc: NhsLocation): string {
  const parts = [loc.town, loc.county, loc.region].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "United Kingdom";
}

function parseNhsSalary(scheme?: NhsPayScheme): { min?: number; max?: number } {
  if (!scheme) return {};
  return {
    min: scheme.minimum ?? undefined,
    max: scheme.maximum ?? undefined,
  };
}

function vacancyUrl(vacancy: NhsVacancy): string {
  if (vacancy.url) return vacancy.url;
  return `https://jobs.nhs.uk/candidate/jobadvert/${vacancy.vacancyId}`;
}

function toRawJob(v: NhsVacancy): RawJob {
  const salary = parseNhsSalary(v.payScheme);
  const postedAt = v.publicationDate
    ? new Date(v.publicationDate).getTime()
    : Date.now();

  return {
    externalId: v.vacancyId,
    source: "nhs",
    title: v.jobTitle.trim(),
    company: v.employer.name.trim(),
    location: buildLocation(v.location),
    description: v.shortDescription ?? "",
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryCurrency: "GBP",
    salaryPeriod: "year",
    postedAt,
    applyUrl: vacancyUrl(v),
    isAgency: false,
  };
}

// ---------------------------------------------------------------------------
// Public adapter function
// ---------------------------------------------------------------------------

export async function fetchNhsJobs(keyword = ""): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  let page = 1;

  while (jobs.length < RESULTS_CAP) {
    const params = new URLSearchParams({
      keyword,
      location: "",
      distance: "national",
      page: String(page),
      sort: "publicationDateDesc",
      size: String(PAGE_SIZE),
    });

    const res = await fetch(`${BASE_URL}?${params}`, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`NHS Jobs API error (HTTP ${res.status})`);
    }

    const data = (await res.json()) as NhsSearchResponse;
    const vacancies = data.data ?? data.vacancies ?? [];

    if (vacancies.length === 0) break;

    for (const v of vacancies) {
      jobs.push(toRawJob(v));
    }

    const total = data.totalResults ?? 0;
    page++;
    if (jobs.length >= total) break;
  }

  return jobs;
}
