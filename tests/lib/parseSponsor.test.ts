import { describe, it, expect } from "vitest";
import {
  parseSponsorRow,
  isSkilledWorkerRoute,
  extractRatingTier,
} from "../../convex/lib/parseSponsorRow";
import { parseSponsorCsv, parseCsvLine } from "../../convex/lib/parseSponsorCsv";

const FETCH_TS = 1700000000000;

// Minimal valid row from the Home Office register
const VALID_ROW: Record<string, string> = {
  "Organisation Name": "Acme Consulting Ltd",
  "Town/City": "London",
  County: "Greater London",
  "Type & Rating": "Worker (A-rated)",
  Route: "Skilled Worker",
};

describe("parseSponsorRow", () => {
  it("parses a valid row", () => {
    const result = parseSponsorRow(VALID_ROW, FETCH_TS);
    expect(result.ok).toBe(true);
    expect(result.record?.legalName).toBe("Acme Consulting Ltd");
    expect(result.record?.normalisedName).toBe("acme consulting limited");
    expect(result.record?.town).toBe("London");
    expect(result.record?.county).toBe("Greater London");
    expect(result.record?.rating).toBe("Worker (A-rated)");
    expect(result.record?.route).toBe("Skilled Worker");
    expect(result.record?.fetchedAt).toBe(FETCH_TS);
  });

  it("returns error when Organisation Name is missing", () => {
    const row = { ...VALID_ROW, "Organisation Name": "" };
    const result = parseSponsorRow(row, FETCH_TS);
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("returns error when Route is missing", () => {
    const row = { ...VALID_ROW, Route: "" };
    const result = parseSponsorRow(row, FETCH_TS);
    expect(result.ok).toBe(false);
  });

  it("handles optional town/county fields", () => {
    const row = { ...VALID_ROW, "Town/City": "", County: "" };
    const result = parseSponsorRow(row, FETCH_TS);
    expect(result.ok).toBe(true);
    expect(result.record?.town).toBeUndefined();
    expect(result.record?.county).toBeUndefined();
  });

  it("uses 'Unknown' when rating is absent", () => {
    const row = { ...VALID_ROW, "Type & Rating": "" };
    const result = parseSponsorRow(row, FETCH_TS);
    expect(result.ok).toBe(true);
    expect(result.record?.rating).toBe("Unknown");
  });
});

describe("isSkilledWorkerRoute", () => {
  it("returns true for Skilled Worker", () => {
    expect(isSkilledWorkerRoute("Skilled Worker")).toBe(true);
  });

  it("returns true for Worker (A rating)", () => {
    expect(isSkilledWorkerRoute("Worker (A rating)")).toBe(true);
  });

  it("returns true for Intra-Company Transfer", () => {
    expect(isSkilledWorkerRoute("Intra-Company Transfer")).toBe(true);
  });

  it("returns false for Student route", () => {
    expect(isSkilledWorkerRoute("Student")).toBe(false);
  });

  it("returns false for Temporary Worker", () => {
    expect(isSkilledWorkerRoute("Temporary Worker")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isSkilledWorkerRoute("SKILLED WORKER")).toBe(true);
  });
});

describe("extractRatingTier", () => {
  it("extracts A from A-rated string", () => {
    expect(extractRatingTier("Worker (A-rated)")).toBe("A");
  });

  it("extracts B from B-rated string", () => {
    expect(extractRatingTier("Worker (B-rated)")).toBe("B");
  });

  it("returns unknown for unrecognised rating", () => {
    expect(extractRatingTier("Some Other Rating")).toBe("unknown");
  });

  it("returns unknown for empty string", () => {
    expect(extractRatingTier("")).toBe("unknown");
  });
});

describe("parseCsvLine", () => {
  it("parses simple comma-separated line", () => {
    expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted fields with commas", () => {
    expect(parseCsvLine('"London, City",UK,Worker')).toEqual([
      "London, City",
      "UK",
      "Worker",
    ]);
  });

  it("handles escaped quotes inside quoted fields", () => {
    expect(parseCsvLine('"He said ""hello""",value')).toEqual([
      'He said "hello"',
      "value",
    ]);
  });

  it("handles empty fields", () => {
    expect(parseCsvLine("a,,c")).toEqual(["a", "", "c"]);
  });
});

describe("parseSponsorCsv", () => {
  it("parses a minimal valid CSV", () => {
    const csv = [
      "Organisation Name,Town/City,County,Type & Rating,Route",
      "Acme Ltd,London,Greater London,Worker (A-rated),Skilled Worker",
      "Beta Corp,Manchester,Lancashire,Worker (A-rated),Skilled Worker",
    ].join("\n");

    const result = parseSponsorCsv(csv, FETCH_TS);
    expect(result.records).toHaveLength(2);
    expect(result.records[0].legalName).toBe("Acme Ltd");
    expect(result.records[1].legalName).toBe("Beta Corp");
  });

  it("filters out non-Skilled Worker routes", () => {
    const csv = [
      "Organisation Name,Town/City,County,Type & Rating,Route",
      "Acme Ltd,London,,Worker (A-rated),Skilled Worker",
      "Student Uni,Oxford,,Student,Student",
    ].join("\n");

    const result = parseSponsorCsv(csv, FETCH_TS);
    expect(result.records).toHaveLength(1);
    expect(result.nonSkilledWorkerRows).toBe(1);
  });

  it("strips UTF-8 BOM", () => {
    const csv =
      "\uFEFFOrganisation Name,Town/City,County,Type & Rating,Route\n" +
      "BOM Company Ltd,London,,Worker (A-rated),Skilled Worker";

    const result = parseSponsorCsv(csv, FETCH_TS);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].legalName).toBe("BOM Company Ltd");
  });

  it("handles empty CSV", () => {
    const result = parseSponsorCsv("", FETCH_TS);
    expect(result.records).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it("skips blank lines without error", () => {
    const csv = [
      "Organisation Name,Town/City,County,Type & Rating,Route",
      "Acme Ltd,London,,Worker (A-rated),Skilled Worker",
      "",
      "",
      "Beta Corp,Manchester,,Worker (A-rated),Skilled Worker",
    ].join("\n");

    const result = parseSponsorCsv(csv, FETCH_TS);
    expect(result.records).toHaveLength(2);
    expect(result.skippedRows).toBe(2);
  });

  it("reports totalRows including filtered and skipped", () => {
    const csv = [
      "Organisation Name,Town/City,County,Type & Rating,Route",
      "Acme Ltd,London,,Worker (A-rated),Skilled Worker",
      "Student Uni,Oxford,,Student,Student",
      "",
    ].join("\n");

    const result = parseSponsorCsv(csv, FETCH_TS);
    expect(result.totalRows).toBe(3); // excludes header
  });
});