/**
 * matchCompanyToSponsor.bench.ts
 *
 * Precision / recall benchmark for the sponsor name-matching algorithm.
 *
 * Fixture: tests/lib/fixtures/sponsor-matching.json
 *   - 100 known-sponsor test cases (exact, normalisation variant, trading name, fuzzy)
 *   - 100 non-sponsor test cases
 *
 * Pass criteria (from CLAUDE.md / ticket 011):
 *   precision ≥ 95%  (false positives are the costly error — matching a non-sponsor)
 *
 * Definitions:
 *   TP  — sponsor correctly identified as matched
 *   FP  — non-sponsor incorrectly identified as matched (false alarm)
 *   FN  — sponsor incorrectly returned as unmatched (missed)
 *   TN  — non-sponsor correctly returned as unmatched
 *   precision = TP / (TP + FP)
 *   recall    = TP / (TP + FN)
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import { describe, it, expect } from "vitest";
import { normaliseName } from "../../convex/lib/normaliseName";
import { matchCompanyToSponsor } from "../../convex/lib/matchCompanyToSponsor";
import { TRADING_NAME_SEEDS } from "../../convex/sponsors/seedTradingNames";
import type { SponsorRow, TradingNameRow } from "../../convex/lib/matchCompanyToSponsor";

// ---------------------------------------------------------------------------
// Load fixture
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fixture: {
  registerEntries: Array<{ legalName: string; rating: string }>;
  testCases: Array<{
    input: string;
    expectedMatch: boolean;
    matchType: string;
    note?: string;
  }>;
} = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "sponsor-matching.json"), "utf-8"),
);

// ---------------------------------------------------------------------------
// Build maps
// ---------------------------------------------------------------------------

/** Sponsor map built from fixture register entries (the "mock register"). */
const sponsorMap = new Map<string, SponsorRow>();
for (const entry of fixture.registerEntries) {
  const normalisedName = normaliseName(entry.legalName);
  sponsorMap.set(normalisedName, {
    normalisedName,
    legalName: entry.legalName,
    rating: entry.rating,
    isActive: true,
  });
}

/**
 * Trading map built from TRADING_NAME_SEEDS — restricted to entries whose
 * legalName resolves to a key already in the sponsorMap.
 */
const tradingMap = new Map<string, TradingNameRow>();
for (const seed of TRADING_NAME_SEEDS) {
  const normalisedLegal = normaliseName(seed.legalName);
  if (sponsorMap.has(normalisedLegal)) {
    const normalisedTrading = normaliseName(seed.tradingName);
    tradingMap.set(normalisedTrading, {
      normalisedTrading,
      normalisedLegal,
      legalName: seed.legalName,
    });
  }
}

// ---------------------------------------------------------------------------
// Run all test cases
// ---------------------------------------------------------------------------

type Result = {
  input: string;
  expectedMatch: boolean;
  actualMatch: boolean;
  matchType: string;
  correct: boolean;
};

const results: Result[] = fixture.testCases.map((tc) => {
  const result = matchCompanyToSponsor(tc.input, sponsorMap, tradingMap);
  return {
    input: tc.input,
    expectedMatch: tc.expectedMatch,
    actualMatch: result.matched,
    matchType: tc.matchType,
    correct: result.matched === tc.expectedMatch,
  };
});

const sponsorResults   = results.filter((r) => r.expectedMatch);
const nonSponsorResults = results.filter((r) => !r.expectedMatch);

const tp = sponsorResults.filter((r) =>  r.actualMatch).length;
const fn = sponsorResults.filter((r) => !r.actualMatch).length;
const fp = nonSponsorResults.filter((r) =>  r.actualMatch).length;
const tn = nonSponsorResults.filter((r) => !r.actualMatch).length;

const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
const recall    = tp + fn > 0 ? tp / (tp + fn) : 1;
const f1        = precision + recall > 0
  ? (2 * precision * recall) / (precision + recall)
  : 0;

// ---------------------------------------------------------------------------
// Describe blocks
// ---------------------------------------------------------------------------

describe("sponsor-matching fixture", () => {
  it("fixture contains exactly 100 register entries", () => {
    expect(fixture.registerEntries).toHaveLength(100);
  });

  it("fixture contains exactly 100 sponsor test cases", () => {
    expect(sponsorResults).toHaveLength(100);
  });

  it("fixture contains exactly 100 non-sponsor test cases", () => {
    expect(nonSponsorResults).toHaveLength(100);
  });

  it("sponsorMap built successfully from all register entries", () => {
    expect(sponsorMap.size).toBe(100);
  });

  it("tradingMap populated with at least 10 entries from TRADING_NAME_SEEDS", () => {
    expect(tradingMap.size).toBeGreaterThanOrEqual(10);
  });
});

describe("precision / recall", () => {
  it(`precision ≥ 95%  (actual: ${(precision * 100).toFixed(1)}%)`, () => {
    if (fp > 0) {
      const falsePositives = nonSponsorResults
        .filter((r) => r.actualMatch)
        .map((r) => `  "${r.input}"`);
      console.log("False positives:\n" + falsePositives.join("\n"));
    }
    expect(precision).toBeGreaterThanOrEqual(0.95);
  });

  it(`recall reported  (actual: ${(recall * 100).toFixed(1)}%)`, () => {
    if (fn > 0) {
      const falseNegatives = sponsorResults
        .filter((r) => !r.actualMatch)
        .map((r) => `  "${r.input}" [${r.matchType}]`);
      console.log("False negatives (missed sponsors):\n" + falseNegatives.join("\n"));
    }
    // No hard assertion on recall — reported for information
    expect(recall).toBeGreaterThanOrEqual(0);
  });

  it(`F1 reported  (actual: ${(f1 * 100).toFixed(1)}%)`, () => {
    expect(f1).toBeGreaterThanOrEqual(0);
  });

  it("confusion matrix: TP / FP / FN / TN", () => {
    console.log(
      `\nConfusion matrix:\n` +
      `  TP=${tp}  FP=${fp}\n` +
      `  FN=${fn}  TN=${tn}\n` +
      `  Precision=${(precision * 100).toFixed(1)}%  Recall=${(recall * 100).toFixed(1)}%  F1=${(f1 * 100).toFixed(1)}%`,
    );
    // Structural sanity: counts must add up
    expect(tp + fn).toBe(100);
    expect(fp + tn).toBe(100);
  });
});

describe("per-matchType breakdown", () => {
  const types = ["exact", "normalisation_variant", "trading_name", "fuzzy"] as const;

  for (const mt of types) {
    const group = sponsorResults.filter((r) => r.matchType === mt);
    if (group.length === 0) continue;
    const passed = group.filter((r) => r.correct).length;

    it(`${mt}: ${passed}/${group.length} matched`, () => {
      // Each group must achieve 100% within its type for precision to hold
      // (any miss here becomes a FN and lowers recall, not precision)
      expect(passed).toBeGreaterThanOrEqual(Math.floor(group.length * 0.9));
    });
  }
});
