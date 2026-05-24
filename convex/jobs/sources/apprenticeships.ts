/**
 * UK Apprenticeships API adapter
 *
 * Endpoint: https://api.apprenticeships.education.gov.uk/vacancies/vacancy
 * Auth: requires Ocp-Apim-Subscription-Key header (employer/provider subscription)
 *       → set via `npx convex env set APPRENTICESHIPS_API_KEY <key>`
 *       → key obtained from an employer's apprenticeship service account:
 *         Adverts → Recruitment APIs
 * Format: JSON
 *
 * We run two fetches:
 *   1. Recent nationwide vacancies (PostedInLastNumberOfDays=7, Sort=AgeDesc)
 *   2. Vacancies matching "visa sponsorship" keyword
 *
 * Returns an empty array (no error thrown) when the key is not set, so the
 * daily cron never crashes.
 *
 * Apprenticeship employers must have employer accounts on the service, so
 * they are almost always legitimate businesses. isPublicSector varies but
 * we default to false since the register mixes private and public employers.
 */

import type { RawJob } from "../types";

const BASE_URL = "https://api.apprenticeships.education.gov.uk/vacancies/vacancy";

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

type ApprenticeshipAddress = {
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  town?: string;
  postcode?: string;
};

type ApprenticeshipWage = {
  wageAdditionalInformation?: string;
  weeklyWage?: number;
  wageType?: string;
  wageUnit?: string;
};

type ApprenticeshipVacancy = {
  id: number | string;
  title: string;
  employerName: string;
  address?: ApprenticeshipAddress;
  wage?: ApprenticeshipWage;
  description?: string;
  shortDescription?: string;
  vacancyUrl?: string;
  postedDate?: string; // ISO date string
  closingDate?: string;
  numberOfPositions?: number;
  trainingProvider?: string;
  apprenticeshipLevel?: string;
  course?: { title?: string };
};

type ApprenticeshipResponse = {
  vacancies?: ApprenticeshipVacancy[];
  total?: number;
  totalMatchedVacancies?: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildLocation(address?: ApprenticeshipAddress): string {
  if (!address) return "United Kingdom";
  const parts = [address.addressLine1, address.town]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "United Kingdom";
}

/**
 * Convert weekly wage to annual equivalent.
 * Apprenticeship wages are typically stated per week.
 */
function weeklyToAnnual(weekly: number): number {
  return Math.round(weekly * 52);
}

function parseSalary(wage?: ApprenticeshipWage): { min?: number; max?: number } {
  if (!wage) return {};

  // Prefer the numeric weekly wage if present
  if (wage.weeklyWage && wage.weeklyWage > 0) {
    const annual = weeklyToAnnual(wage.weeklyWage);
    return { min: annual };
  }

  // Fall back to parsing the text field
  const text = wage.wageAdditionalInformation ?? "";
  const nums = [...text.matchAll(/£([\d,]+(?:\.\d+)?)/g)]
    .map((m) => parseFloat(m[1].replace(/,/g, "")))
    .filter((n) => !isNaN(n) && n > 0);

  if (nums.length === 0) return {};
  if (nums.length === 1) return { min: Math.round(nums[0]) };
  return { min: Math.round(Math.min(...nums)), max: Math.round(Math.max(...nums)) };
}

function parsePostedAt(dateStr?: string): number {
  if (!dateStr) return Date.now();
  const ts = Date.parse(dateStr);
  return isNaN(ts) ? Date.now() : ts;
}

function vacancyToRawJob(v: ApprenticeshipVacancy): RawJob {
  const salary = parseSalary(v.wage);
  const description = [
    v.description ?? v.shortDescription ?? "",
    v.course?.title ? `Course: ${v.course.title}` : "",
    v.trainingProvider ? `Training provider: ${v.trainingProvider}` : "",
    v.apprenticeshipLevel ? `Level: ${v.apprenticeshipLevel}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    externalId: String(v.id),
    source: "apprenticeships",
    title: v.title ?? "Apprenticeship",
    company: v.employerName ?? "Unknown employer",
    location: buildLocation(v.address),
    description,
    ...(salary.min !== undefined ? { salaryMin: salary.min } : {}),
    ...(salary.max !== undefined ? { salaryMax: salary.max } : {}),
    salaryPeriod: "year",
    postedAt: parsePostedAt(v.postedDate),
    applyUrl:
      v.vacancyUrl ??
      `https://www.findapprenticeship.service.gov.uk/apprenticeship/${v.id}`,
    isAgency: false,
    explicit: false,
  };
}

async function fetchPage(
  params: Record<string, string>,
  apiKey: string,
): Promise<ApprenticeshipVacancy[]> {
  const url = new URL(BASE_URL);
  for (const [k, val] of Object.entries(params)) {
    url.searchParams.set(k, val);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Ocp-Apim-Subscription-Key": apiKey,
    },
  });

  if (!res.ok) {
    // Non-fatal — log and return empty rather than failing the whole ingestion
    console.error(`Apprenticeships API fetch failed (HTTP ${res.status}): ${url.toString()}`);
    return [];
  }

  const data = (await res.json()) as ApprenticeshipResponse;
  return data.vacancies ?? [];
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export async function fetchApprenticeships(apiKey: string): Promise<RawJob[]> {
  if (!apiKey) {
    console.error(
      "APPRENTICESHIPS_API_KEY not set — skipping apprenticeships ingestion. " +
      "Set it with: npx convex env set APPRENTICESHIPS_API_KEY <key>",
    );
    return [];
  }

  const [recent, sponsored] = await Promise.all([
    // Recent nationwide vacancies posted in the last 7 days
    fetchPage(
      {
        NationWideOnly: "false",
        Sort: "AgeDesc",
        PageSize: "100",
        PostedInLastNumberOfDays: "7",
      },
      apiKey,
    ),
    // Explicit visa sponsorship keyword search
    fetchPage(
      {
        Keywords: "visa sponsorship",
        PageSize: "100",
      },
      apiKey,
    ),
  ]);

  // Deduplicate by vacancy ID
  const seen = new Set<string>();
  const all: RawJob[] = [];
  for (const vacancy of [...recent, ...sponsored]) {
    const id = String(vacancy.id);
    if (seen.has(id)) continue;
    seen.add(id);
    all.push(vacancyToRawJob(vacancy));
  }

  return all;
}
