import { describe, it, expect } from "vitest";
import { matchesRoleVariation, matchesRoleVariationLoose } from "../../convex/lib/matchRoleVariation";

describe("matchesRoleVariation", () => {
  // ── Empty variations (no profile yet) ─────────────────────────────────────

  it("returns true for any title when variations is empty", () => {
    expect(matchesRoleVariation("Platform Engineer", [])).toBe(true);
    expect(matchesRoleVariation("Anything at all", [])).toBe(true);
  });

  // ── Exact match ───────────────────────────────────────────────────────────

  it("matches identical titles (case-insensitive)", () => {
    expect(matchesRoleVariation("Software Engineer", ["Software Engineer"])).toBe(true);
    expect(matchesRoleVariation("software engineer", ["Software Engineer"])).toBe(true);
    expect(matchesRoleVariation("SOFTWARE ENGINEER", ["software engineer"])).toBe(true);
  });

  // ── Variation tokens ⊆ title tokens ──────────────────────────────────────

  it("matches when variation tokens are a subset of title tokens", () => {
    // "Software Engineer" ⊆ "Senior Software Engineer"
    expect(matchesRoleVariation("Senior Software Engineer", ["Software Engineer"])).toBe(true);
    // "Backend Developer" ⊆ "Senior Backend Developer"
    expect(matchesRoleVariation("Senior Backend Developer", ["Backend Developer"])).toBe(true);
    // "Product Manager" ⊆ "Technical Product Manager"
    expect(matchesRoleVariation("Technical Product Manager", ["Product Manager"])).toBe(true);
  });

  // ── Title tokens ⊆ variation tokens ──────────────────────────────────────

  it("matches when title tokens are a subset of variation tokens", () => {
    // "Software Engineer" title ⊆ "Senior Software Engineer" variation
    expect(matchesRoleVariation("Software Engineer", ["Senior Software Engineer"])).toBe(true);
    expect(matchesRoleVariation("Product Manager", ["Principal Product Manager"])).toBe(true);
  });

  // ── No match ─────────────────────────────────────────────────────────────

  it("does not match unrelated titles", () => {
    expect(matchesRoleVariation("Platform Engineer", ["Software Engineer"])).toBe(false);
    expect(matchesRoleVariation("Marketing Manager", ["Software Engineer"])).toBe(false);
    expect(matchesRoleVariation("Data Scientist", ["Product Manager"])).toBe(false);
  });

  it("does not cross-match on shared single tokens like 'engineer'", () => {
    // "Platform Engineer" should not match "Software Engineer" — they share
    // "engineer" but "software" is not in the title
    expect(matchesRoleVariation("Platform Engineer", ["Software Engineer"])).toBe(false);
    expect(matchesRoleVariation("DevOps Engineer", ["Software Engineer"])).toBe(false);
  });

  // ── Multiple variations ───────────────────────────────────────────────────

  it("returns true if any variation matches", () => {
    const variations = ["Software Engineer", "Backend Engineer", "Full Stack Developer"];
    expect(matchesRoleVariation("Senior Backend Engineer", variations)).toBe(true);
    expect(matchesRoleVariation("Full Stack Developer", variations)).toBe(true);
    expect(matchesRoleVariation("Data Scientist", variations)).toBe(false);
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it("handles empty job title", () => {
    expect(matchesRoleVariation("", ["Software Engineer"])).toBe(false);
  });

  it("handles empty string in variations array", () => {
    // Empty string tokenises to [], no match
    expect(matchesRoleVariation("Software Engineer", [""])).toBe(false);
  });

  it("handles hyphenated and special character titles", () => {
    // "full-stack" tokenises the same as "full stack"
    expect(matchesRoleVariation("Full-Stack Developer", ["Full Stack Developer"])).toBe(true);
    expect(matchesRoleVariation("C# Developer", ["C Developer"])).toBe(true);
  });

  it("handles numeric tokens in titles", () => {
    expect(matchesRoleVariation("SWE II", ["SWE II"])).toBe(true);
    expect(matchesRoleVariation("SWE III", ["SWE II"])).toBe(false);
  });
});

// ── matchesRoleVariationLoose ──────────────────────────────────────────────────

describe("matchesRoleVariationLoose", () => {
  it("returns true for any title when variations is empty", () => {
    expect(matchesRoleVariationLoose("Platform Engineer", [])).toBe(true);
  });

  it("matches when any variation word appears in the title", () => {
    // "engineer" is in both
    expect(matchesRoleVariationLoose("Platform Engineer", ["Software Engineer"])).toBe(true);
    // "analyst" is shared
    expect(matchesRoleVariationLoose("Business Analyst", ["Data Analyst"])).toBe(true);
    // "developer" is shared
    expect(matchesRoleVariationLoose("iOS Developer", ["Frontend Developer"])).toBe(true);
  });

  it("does not match when no variation word appears in the title", () => {
    expect(matchesRoleVariationLoose("Marketing Manager", ["Software Engineer"])).toBe(false);
    expect(matchesRoleVariationLoose("Sales Director", ["Data Scientist"])).toBe(false);
  });

  it("ignores stop words", () => {
    // "for" and "the" are stop words — should not cause a match
    expect(matchesRoleVariationLoose("A Role For The Team", ["Software Engineer"])).toBe(false);
  });

  it("returns true when any of multiple variations contributes a matching word", () => {
    const variations = ["Data Analyst", "Product Manager"];
    expect(matchesRoleVariationLoose("Senior Analyst", variations)).toBe(true);
    expect(matchesRoleVariationLoose("Product Designer", variations)).toBe(true);
    expect(matchesRoleVariationLoose("Sales Executive", variations)).toBe(false);
  });

  it("returns true for empty variations", () => {
    expect(matchesRoleVariationLoose("", [])).toBe(true);
  });

  it("returns false for empty job title with non-empty variations", () => {
    expect(matchesRoleVariationLoose("", ["Software Engineer"])).toBe(false);
  });
});
