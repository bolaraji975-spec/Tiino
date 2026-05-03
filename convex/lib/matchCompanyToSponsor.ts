/**
 * matchCompanyToSponsor.ts
 *
 * Matches a job-feed company name against the sponsor register.
 * Returns a match result with confidence level and the matched sponsor ID.
 *
 * Match priority:
 * 1. Exact match on normalised name
 * 2. Trading name lookup (hand-curated + T/A extracted from register)
 * 3. Fuzzy match (Levenshtein ≤ 3 on strings ≥ 8 chars)
 * 4. Token-set ratio ≥ 92
 */

import { normaliseName, tokenSetRatio } from "./normaliseName";

export type MatchConfidence = "exact" | "trading_name" | "fuzzy" | "none";

export interface SponsorMatchResult {
  matched: boolean;
  confidence: MatchConfidence;
  normalisedInput: string;
  matchedLegalName?: string;
  matchedNormalisedName?: string;
  /** Score contribution: +40 for any match, 0 for none */
  scoreContribution: number;
}

export interface SponsorRow {
  normalisedName: string;
  legalName: string;
  rating: string;
  isActive: boolean;
}

export interface TradingNameRow {
  normalisedTrading: string;
  normalisedLegal: string;
  legalName: string;
}

/**
 * Levenshtein distance between two strings.
 * Returns early if distance exceeds maxDistance.
 */
export function levenshtein(a: string, b: string, maxDistance = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  const m = a.length;
  const n = b.length;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let minInRow = curr[0];

    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
      minInRow = Math.min(minInRow, curr[j]);
    }

    if (minInRow > maxDistance) return maxDistance + 1;
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/**
 * Match a job company name against the in-memory sponsor register.
 *
 * @param companyName - Raw company name from the job feed
 * @param sponsorMap  - Map from normalisedName → SponsorRow (full register)
 * @param tradingMap  - Map from normalisedTrading → TradingNameRow
 */
export function matchCompanyToSponsor(
  companyName: string,
  sponsorMap: Map<string, SponsorRow>,
  tradingMap: Map<string, TradingNameRow> = new Map(),
): SponsorMatchResult {
  const normalisedInput = normaliseName(companyName);

  const noMatch: SponsorMatchResult = {
    matched: false,
    confidence: "none",
    normalisedInput,
    scoreContribution: 0,
  };

  if (!normalisedInput) return noMatch;

  // 1. Exact match
  const exactSponsor = sponsorMap.get(normalisedInput);
  if (exactSponsor && exactSponsor.isActive) {
    return {
      matched: true,
      confidence: "exact",
      normalisedInput,
      matchedLegalName: exactSponsor.legalName,
      matchedNormalisedName: exactSponsor.normalisedName,
      scoreContribution: 40,
    };
  }

  // 2. Trading name lookup
  const tradingEntry = tradingMap.get(normalisedInput);
  if (tradingEntry) {
    const legalSponsor = sponsorMap.get(tradingEntry.normalisedLegal);
    if (legalSponsor && legalSponsor.isActive) {
      return {
        matched: true,
        confidence: "trading_name",
        normalisedInput,
        matchedLegalName: legalSponsor.legalName,
        matchedNormalisedName: legalSponsor.normalisedName,
        scoreContribution: 40,
      };
    }
  }

  // 3 & 4. Fuzzy match — only for strings ≥ 8 chars
  if (normalisedInput.length < 8) return noMatch;

  for (const [sponsorNorm, sponsor] of sponsorMap) {
    if (!sponsor.isActive) continue;
    if (sponsorNorm.length < 8) continue;

    const dist = levenshtein(normalisedInput, sponsorNorm, 3);
    if (dist <= 3) {
      return {
        matched: true,
        confidence: "fuzzy",
        normalisedInput,
        matchedLegalName: sponsor.legalName,
        matchedNormalisedName: sponsor.normalisedName,
        scoreContribution: 40,
      };
    }

    const ratio = tokenSetRatio(normalisedInput, sponsorNorm);
    if (ratio >= 92) {
      return {
        matched: true,
        confidence: "fuzzy",
        normalisedInput,
        matchedLegalName: sponsor.legalName,
        matchedNormalisedName: sponsor.normalisedName,
        scoreContribution: 40,
      };
    }
  }

  return noMatch;
}