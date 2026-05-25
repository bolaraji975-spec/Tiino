"use node";

/**
 * normaliseJob.ts
 *
 * Converts a RawJob from any source adapter into a CanonicalJob ready for
 * DB upsert. Responsibilities:
 *   - Title / company / location normalisation
 *   - Salary period normalisation (convert monthly/hourly → annual)
 *   - City extraction from location string
 *   - dedupeHash = SHA-256(titleNorm|companyNorm|locationNorm|weekOf)
 *
 * Uses Node.js `crypto` — only call from "use node" actions or test contexts.
 */

import { createHash } from "crypto";
import type { RawJob, CanonicalJob, JobSource } from "../jobs/types";
import { normaliseName } from "./normaliseName";

const PUBLIC_SECTOR_SOURCES: JobSource[] = ["nhs", "civil_service", "jobs_ac"];

// ---------------------------------------------------------------------------
// UK / non-UK location detection
// ---------------------------------------------------------------------------

const UK_INDICATORS = [
  "uk", "united kingdom", "england", "scotland", "wales",
  "london", "manchester", "birmingham", "leeds", "bristol",
  "edinburgh", "glasgow", "sheffield", "liverpool", "cambridge",
  "oxford", "nottingham", "newcastle", "cardiff",
];

const NON_UK_COUNTRIES = [
  "portugal", "spain", "france", "germany", "netherlands",
  "ireland", "poland", "romania", "india", "usa", "united states",
  "canada", "australia", "remote",
];

/**
 * Returns false if the location clearly refers to a non-UK country and
 * contains no UK indicator. Returns true (active) in all other cases —
 * including when the location is ambiguous or empty.
 */
function isUkLocation(location: string): boolean {
  const loc = location.toLowerCase();
  const hasUkIndicator = UK_INDICATORS.some((ind) => loc.includes(ind));
  if (hasUkIndicator) return true;
  const hasNonUk = NON_UK_COUNTRIES.some((country) => {
    // Use word-boundary-like check: surrounded by non-alpha or string edges
    const idx = loc.indexOf(country);
    if (idx === -1) return false;
    const before = idx === 0 ? true : !/[a-z]/.test(loc[idx - 1]);
    const after = idx + country.length >= loc.length ? true : !/[a-z]/.test(loc[idx + country.length]);
    return before && after;
  });
  return !hasNonUk;
}

// ---------------------------------------------------------------------------
// Salary normalisation
// ---------------------------------------------------------------------------

const MONTH_TO_YEAR = 12;
const DAY_TO_YEAR = 260;   // 5-day working week × 52
const HOUR_TO_YEAR = 2080; // 40h × 52

function annualise(amount: number, period: RawJob["salaryPeriod"]): number {
  switch (period) {
    case "month": return Math.round(amount * MONTH_TO_YEAR);
    case "day":   return Math.round(amount * DAY_TO_YEAR);
    case "hour":  return Math.round(amount * HOUR_TO_YEAR);
    default:      return Math.round(amount); // "year" or undefined
  }
}

// ---------------------------------------------------------------------------
// Location helpers
// ---------------------------------------------------------------------------

/** Extract city name from a location string.
 *  "London, Greater London, United Kingdom" → "London"
 *  "Manchester, England, UK"               → "Manchester"
 */
function extractCity(location: string): string | undefined {
  const parts = location.split(/[,/|]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  const first = parts[0];
  // Reject generic region-only values
  const generic = /^(united\s+kingdom|england|scotland|wales|uk|gb|remote|national|nationwide)$/i;
  if (generic.test(first)) return undefined;
  return first;
}

/** Rough location normalisation — keeps it readable but consistent. */
function normaliseLocation(raw: string): string {
  return raw
    .replace(/,\s*United Kingdom$/i, "")
    .replace(/,\s*England$/i, "")
    .replace(/,\s*UK$/i, "")
    .replace(/,\s*GB$/i, "")
    .trim() || "United Kingdom";
}

// ---------------------------------------------------------------------------
// Week-of computation (ISO week start = Monday)
// ---------------------------------------------------------------------------

function weekOf(timestamp: number): string {
  const d = new Date(timestamp);
  const dow = d.getUTCDay(); // 0 = Sun
  const daysToMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - daysToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// ---------------------------------------------------------------------------
// Title normalisation (lighter than company — preserve readability)
// ---------------------------------------------------------------------------

function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Agency detection (fallback when adapter doesn't set isAgency)
// ---------------------------------------------------------------------------

const AGENCY_KEYWORDS =
  /\b(?:recruitment|recruiter|staffing|resourcing|talent\s+acquisition|search\s+consultancy|headhunt|manpower|hays|adecco|randstad|michael\s+page|robert\s+half|reed\s+specialist|kelly\s+services|brookson)\b/i;

function detectAgency(company: string): boolean {
  return AGENCY_KEYWORDS.test(company);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function normaliseJob(raw: RawJob): CanonicalJob {
  const titleNorm = normaliseTitle(raw.title);
  const companyNorm = normaliseName(raw.company);
  const locationNorm = normaliseLocation(raw.location).toLowerCase();
  const week = weekOf(raw.postedAt);

  const dedupeHash = createHash("sha256")
    .update(`${titleNorm}|${companyNorm}|${locationNorm}|${week}`)
    .digest("hex");

  const salaryMin =
    raw.salaryMin !== undefined
      ? annualise(raw.salaryMin, raw.salaryPeriod)
      : undefined;
  const salaryMax =
    raw.salaryMax !== undefined
      ? annualise(raw.salaryMax, raw.salaryPeriod)
      : undefined;

  const location = normaliseLocation(raw.location);
  const locationCity = extractCity(location);

  const isAgency =
    raw.isAgency !== undefined ? raw.isAgency : detectAgency(raw.company);

  const isActive = isUkLocation(raw.location);

  return {
    sourceId: {
      source: raw.source,
      externalId: raw.externalId,
      applyUrl: raw.applyUrl,
    },
    dedupeHash,
    title: raw.title.trim(),
    company: raw.company.trim(),
    companyNormalised: companyNorm,
    location,
    locationCity,
    salaryMin,
    salaryMax,
    description: raw.description,
    postedAt: raw.postedAt,
    isAgency,
    isPublicSector: PUBLIC_SECTOR_SOURCES.includes(raw.source),
    isActive,
  };
}
