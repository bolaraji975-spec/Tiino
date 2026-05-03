import { describe, it, expect } from "vitest";
import {
  matchCompanyToSponsor,
  levenshtein,
  SponsorRow,
  TradingNameRow,
} from "../../convex/lib/matchCompanyToSponsor";

function buildSponsorMap(entries: Array<{ normalised: string; legal: string; rating?: string }>): Map<string, SponsorRow> {
  const map = new Map<string, SponsorRow>();
  for (const e of entries) {
    map.set(e.normalised, {
      normalisedName: e.normalised,
      legalName: e.legal,
      rating: e.rating ?? "Worker (A rating)",
      isActive: true,
    });
  }
  return map;
}

function buildTradingMap(entries: Array<{ trading: string; legal: string; legalName: string }>): Map<string, TradingNameRow> {
  const map = new Map<string, TradingNameRow>();
  for (const e of entries) {
    map.set(e.trading, {
      normalisedTrading: e.trading,
      normalisedLegal: e.legal,
      legalName: e.legalName,
    });
  }
  return map;
}

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("amazon", "amazon")).toBe(0);
  });

  it("returns 1 for single insertion", () => {
    expect(levenshtein("amazon", "amazoon")).toBe(1);
  });

  it("returns 1 for single deletion", () => {
    expect(levenshtein("amazon", "amzon")).toBe(1);
  });

  it("returns 1 for single substitution", () => {
    expect(levenshtein("amazon", "amazin")).toBe(1);
  });

  it("returns early when strings differ too much in length", () => {
    expect(levenshtein("ab", "abcdefghij", 3)).toBeGreaterThan(3);
  });

  it("handles empty strings", () => {
    expect(levenshtein("", "")).toBe(0);
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
  });
});

describe("matchCompanyToSponsor — exact match", () => {
  const sponsorMap = buildSponsorMap([
    { normalised: "tesco plc", legal: "Tesco PLC" },
    { normalised: "amazon uk services limited", legal: "Amazon UK Services Ltd" },
    { normalised: "hsbc bank plc", legal: "HSBC Bank PLC" },
  ]);

  it("returns exact match for identical normalised names", () => {
    const result = matchCompanyToSponsor("Tesco PLC", sponsorMap);
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe("exact");
    expect(result.matchedLegalName).toBe("Tesco PLC");
    expect(result.scoreContribution).toBe(40);
  });

  it("matches despite different capitalisation", () => {
    const result = matchCompanyToSponsor("TESCO PLC", sponsorMap);
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe("exact");
  });

  it("matches despite Ltd vs Limited variation", () => {
    const result = matchCompanyToSponsor("Amazon UK Services Ltd", sponsorMap);
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe("exact");
  });

  it("matches register names with leading spaces", () => {
    const mapWithLeadingSpace = buildSponsorMap([
      { normalised: "a karim pharma limited", legal: "A KARIM PHARMA LTD" },
    ]);
    const result = matchCompanyToSponsor("A Karim Pharma Ltd", mapWithLeadingSpace);
    expect(result.matched).toBe(true);
  });

  it("returns no match for unknown company", () => {
    const result = matchCompanyToSponsor("Totally Unknown Corp", sponsorMap);
    expect(result.matched).toBe(false);
    expect(result.scoreContribution).toBe(0);
  });

  it("returns no match for empty string", () => {
    const result = matchCompanyToSponsor("", sponsorMap);
    expect(result.matched).toBe(false);
  });
});

describe("matchCompanyToSponsor — trading name match", () => {
  const sponsorMap = buildSponsorMap([
    { normalised: "marks and spencer plc", legal: "Marks & Spencer PLC" },
    { normalised: "a4 retail limited", legal: "A4 RETAIL LIMITED" },
  ]);

  const tradingMap = buildTradingMap([
    {
      trading: "m and s",
      legal: "marks and spencer plc",
      legalName: "Marks & Spencer PLC",
    },
    {
      trading: "braes of kirriemuir",
      legal: "a4 retail limited",
      legalName: "A4 RETAIL LIMITED",
    },
  ]);

  it("matches via trading name lookup", () => {
    const result = matchCompanyToSponsor("M and S", sponsorMap, tradingMap);
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe("trading_name");
    expect(result.matchedLegalName).toBe("Marks & Spencer PLC");
  });

  it("matches T/A trading name extracted from register", () => {
    const result = matchCompanyToSponsor("Braes of Kirriemuir", sponsorMap, tradingMap);
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe("trading_name");
    expect(result.matchedLegalName).toBe("A4 RETAIL LIMITED");
  });
});

describe("matchCompanyToSponsor — fuzzy match", () => {
  const sponsorMap = buildSponsorMap([
    { normalised: "pricewaterhousecoopers llp", legal: "PricewaterhouseCoopers LLP" },
    { normalised: "deloitte llp", legal: "Deloitte LLP" },
  ]);

  it("matches with minor typo (Levenshtein ≤ 3)", () => {
    const result = matchCompanyToSponsor("Deloite LLP", sponsorMap);
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe("fuzzy");
  });

  it("does not fuzzy match strings below 8-char threshold", () => {
    const shortMap = buildSponsorMap([
      { normalised: "ibm uk", legal: "IBM UK" },
    ]);
    const result = matchCompanyToSponsor("IBM", shortMap);
    expect(result.matched).toBe(false);
  });
});

describe("matchCompanyToSponsor — inactive sponsors", () => {
  it("does not match inactive sponsors", () => {
    const sponsorMap = new Map<string, SponsorRow>();
    sponsorMap.set("revoked company limited", {
      normalisedName: "revoked company limited",
      legalName: "Revoked Company Limited",
      rating: "Worker (A rating)",
      isActive: false,
    });

    const result = matchCompanyToSponsor("Revoked Company Limited", sponsorMap);
    expect(result.matched).toBe(false);
  });
});

describe("matchCompanyToSponsor — real-world names from register", () => {
  const realSponsors = buildSponsorMap([
    { normalised: "google uk limited", legal: "Google UK Limited" },
    { normalised: "microsoft limited", legal: "Microsoft Limited" },
    { normalised: "bbc studios limited", legal: "BBC Studios Limited" },
    { normalised: "jp morgan securities plc", legal: "JP Morgan Securities PLC" },
    { normalised: "a karim pharma limited", legal: "A KARIM PHARMA LTD" },
    { normalised: "a m electrical installations limited", legal: "A M ELECTRICAL INSTALLATIONS LIMITED" },
  ]);

  const cases: Array<[string, boolean]> = [
    ["Google UK Ltd", true],
    ["Microsoft Limited", true],
    ["BBC Studios Ltd", true],
    ["JP Morgan Securities PLC", true],
    ["A Karim Pharma Ltd", true],
    ["A M Electrical Installations Ltd", true],
    ["Random Startup Ltd", false],
    ["Fraudulent Company Ltd", false],
  ];

  for (const [input, shouldMatch] of cases) {
    it(`"${input}" → matched: ${shouldMatch}`, () => {
      const result = matchCompanyToSponsor(input, realSponsors);
      expect(result.matched).toBe(shouldMatch);
    });
  }
});