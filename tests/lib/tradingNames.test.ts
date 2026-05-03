import { describe, it, expect } from "vitest";
import { normaliseName } from "../../convex/lib/normaliseName";
import { matchCompanyToSponsor } from "../../convex/lib/matchCompanyToSponsor";
import { TRADING_NAME_SEEDS } from "../../convex/sponsors/seedTradingNames";
import type { SponsorRow, TradingNameRow } from "../../convex/lib/matchCompanyToSponsor";

/**
 * Build a trading map and a sponsor map from the seed constants so that
 * matchCompanyToSponsor can resolve trading names without touching the DB.
 */
function buildMaps(legalNames: string[]): {
  sponsorMap: Map<string, SponsorRow>;
  tradingMap: Map<string, TradingNameRow>;
} {
  // Sponsor map: one active entry per distinct legal name
  const sponsorMap = new Map<string, SponsorRow>();
  for (const legalName of legalNames) {
    const norm = normaliseName(legalName);
    sponsorMap.set(norm, {
      normalisedName: norm,
      legalName,
      rating: "Worker (A rating)",
      isActive: true,
    });
  }

  // Trading map: all seed entries whose legalName is in the provided set
  const tradingMap = new Map<string, TradingNameRow>();
  for (const seed of TRADING_NAME_SEEDS) {
    const normTrading = normaliseName(seed.tradingName);
    const normLegal = normaliseName(seed.legalName);
    if (sponsorMap.has(normLegal)) {
      tradingMap.set(normTrading, {
        normalisedTrading: normTrading,
        normalisedLegal: normLegal,
        legalName: seed.legalName,
      });
    }
  }

  return { sponsorMap, tradingMap };
}

describe("TRADING_NAME_SEEDS", () => {
  it("contains at least 50 entries", () => {
    expect(TRADING_NAME_SEEDS.length).toBeGreaterThanOrEqual(50);
  });

  it("every entry has a non-empty tradingName and legalName", () => {
    for (const seed of TRADING_NAME_SEEDS) {
      expect(seed.tradingName.trim()).not.toBe("");
      expect(seed.legalName.trim()).not.toBe("");
    }
  });

  it("every entry normalises to a non-empty string on both sides", () => {
    for (const seed of TRADING_NAME_SEEDS) {
      expect(normaliseName(seed.tradingName)).not.toBe("");
      expect(normaliseName(seed.legalName)).not.toBe("");
    }
  });
});

describe("matchCompanyToSponsor via trading map — 5 well-known names", () => {
  const fixtures: Array<{ input: string; legalName: string }> = [
    { input: "M&S", legalName: "Marks And Spencer PLC" },
    { input: "Google", legalName: "Google UK Limited" },
    { input: "BT", legalName: "British Telecommunications PLC" },
    { input: "Lloyds Bank", legalName: "Lloyds Bank PLC" },
    { input: "Deliveroo", legalName: "Roofoods Limited" },
  ];

  const legalNames = fixtures.map((f) => f.legalName);
  const { sponsorMap, tradingMap } = buildMaps(legalNames);

  for (const { input, legalName } of fixtures) {
    it(`"${input}" resolves to "${legalName}"`, () => {
      const result = matchCompanyToSponsor(input, sponsorMap, tradingMap);
      expect(result.matched).toBe(true);
      expect(result.confidence).toBe("trading_name");
      expect(result.matchedLegalName).toBe(legalName);
      expect(result.scoreContribution).toBe(40);
    });
  }
});

describe("edge cases", () => {
  it("unknown trading name returns no match", () => {
    const { sponsorMap, tradingMap } = buildMaps(["Marks And Spencer PLC"]);
    const result = matchCompanyToSponsor("UnknownCorp XYZ", sponsorMap, tradingMap);
    expect(result.matched).toBe(false);
    expect(result.confidence).toBe("none");
  });

  it("trading name pointing to inactive sponsor returns no match", () => {
    const sponsorMap = new Map<string, SponsorRow>([
      [
        normaliseName("Roofoods Limited"),
        {
          normalisedName: normaliseName("Roofoods Limited"),
          legalName: "Roofoods Limited",
          rating: "Worker (A rating)",
          isActive: false, // inactive
        },
      ],
    ]);
    const tradingMap = new Map<string, TradingNameRow>([
      [
        normaliseName("Deliveroo"),
        {
          normalisedTrading: normaliseName("Deliveroo"),
          normalisedLegal: normaliseName("Roofoods Limited"),
          legalName: "Roofoods Limited",
        },
      ],
    ]);
    const result = matchCompanyToSponsor("Deliveroo", sponsorMap, tradingMap);
    expect(result.matched).toBe(false);
  });
});
