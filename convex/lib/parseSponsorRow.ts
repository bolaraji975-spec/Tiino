/**
 * parseSponsorRow.ts
 *
 * Parses a single row from the Home Office sponsor register CSV into
 * a structured SponsorRecord ready for upserting into Convex.
 *
 * Validated against the real register format (April 2026):
 * - 5 columns: Organisation Name, Town/City, County, Type & Rating, Route
 * - Rating uses "Worker (A rating)" not "Worker (A-rated)"
 * - Many names have leading spaces
 * - Many names use T/A pattern: "LEGAL NAME T/A Trading Name"
 * - Routes include: Skilled Worker, Global Business Mobility: Senior or Specialist Worker, etc.
 */

import { normaliseName, extractTradingName } from "./normaliseName";

export interface SponsorRecord {
  legalName: string;
  normalisedName: string;
  tradingNameFromRegister?: string;  // extracted from T/A pattern in register
  town: string | undefined;
  county: string | undefined;
  rating: string;
  route: string;
  fetchedAt: number;
}

export interface ParseResult {
  ok: boolean;
  record?: SponsorRecord;
  error?: string;
}

const COL_ALIASES: Record<string, string[]> = {
  legalName: ["Organisation Name", "organisation name", "Organisation_Name"],
  town: ["Town/City", "town/city", "Town", "town"],
  county: ["County", "county"],
  rating: ["Type & Rating", "type & rating", "Type_Rating", "Rating"],
  route: ["Route", "route"],
};

function getCol(row: Record<string, string>, field: string): string {
  const aliases = COL_ALIASES[field] ?? [];
  for (const alias of aliases) {
    if (alias in row && row[alias] !== undefined) {
      return (row[alias] ?? "").trim();
    }
  }
  const lower = field.toLowerCase();
  for (const key of Object.keys(row)) {
    if (key.toLowerCase().includes(lower)) {
      return (row[key] ?? "").trim();
    }
  }
  return "";
}

/**
 * Parse a single CSV row into a SponsorRecord.
 *
 * @param row       - Object of column name → value (from papaparse header mode)
 * @param fetchedAt - Timestamp of the current refresh run
 */
export function parseSponsorRow(
  row: Record<string, string>,
  fetchedAt: number,
): ParseResult {
  let legalName = getCol(row, "legalName");

  if (!legalName) {
    return { ok: false, error: "Missing Organisation Name" };
  }

  // Extract T/A trading name before normalising
  const tradingNameFromRegister = extractTradingName(legalName) ?? undefined;

  // Strip T/A portion to get the true legal name
  const taIndex = legalName.search(/\s+T\/A\s+/i);
  if (taIndex !== -1) {
    legalName = legalName.slice(0, taIndex).trim();
  }

  const normalisedName = normaliseName(legalName);
  if (!normalisedName) {
    return { ok: false, error: `Could not normalise name: "${legalName}"` };
  }

  const rating = getCol(row, "rating");
  const route = getCol(row, "route");

  if (!route) {
    return { ok: false, error: `Missing Route for "${legalName}"` };
  }

  return {
    ok: true,
    record: {
      legalName,
      normalisedName,
      tradingNameFromRegister,
      town: getCol(row, "town") || undefined,
      county: getCol(row, "county") || undefined,
      rating: rating || "Unknown",
      route,
      fetchedAt,
    },
  };
}

/**
 * Returns true if the route should be included in SponsorTrack.
 *
 * Validated against real April 2026 register data:
 * - "Skilled Worker" — 119,060 rows (primary route)
 * - "Global Business Mobility: Senior or Specialist Worker" — 10,121 rows
 * - "Worker (A rating)" — 2,378 rows (legacy format)
 * - "Scale-up" — 87 rows
 * - "Intra-Company Transfer" variants
 *
 * Excluded: Student, Temporary Worker, Creative Worker, Charity Worker,
 * International Sportsperson, Religious Worker, etc.
 */
export function isSkilledWorkerRoute(route: string): boolean {
  const lower = route.toLowerCase().trim();
  return (
    lower === "skilled worker" ||
    lower === "worker (a rating)" ||
    lower === "worker (b rating)" ||
    lower.includes("intra-company") ||
    lower.includes("intra company") ||
    lower.includes("global business mobility: senior or specialist worker") ||
    lower.includes("scale-up")
  );
}

/**
 * Returns "A" | "B" | "unknown" for a rating string.
 *
 * Real register uses:
 * - "Worker (A rating)" — most entries
 * - "Temporary Worker (A rating)"
 * - "Worker (UK Expansion Worker: Provisional )"
 *
 * Legacy formats also supported:
 * - "Worker (A-rated)", "Worker (B-rated)"
 */
export function extractRatingTier(rating: string): "A" | "B" | "unknown" {
  if (
    rating.includes("A rating") ||
    rating.includes("A-rated") ||
    rating.includes("(A)")
  )
    return "A";
  if (
    rating.includes("B rating") ||
    rating.includes("B-rated") ||
    rating.includes("(B)")
  )
    return "B";
  return "unknown";
}