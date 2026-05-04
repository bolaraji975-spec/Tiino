import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseClaudeResponse } from "../../convex/profiles/parseCv";
import type { ParsedCvData } from "../../convex/profiles/parseCv";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_RESPONSE = JSON.parse(
  readFileSync(
    join(__dirname, "../../tickets/fixtures/cvs/sample-claude-response.json"),
    "utf-8",
  ),
) as ParsedCvData;

// ---------------------------------------------------------------------------
// Sample CV PDF exists on disk
// ---------------------------------------------------------------------------

describe("sample-cv.pdf fixture", () => {
  it("file exists and is a non-empty PDF", () => {
    const pdfPath = join(__dirname, "../../tickets/fixtures/cvs/sample-cv.pdf");
    const bytes = readFileSync(pdfPath);
    expect(bytes.length).toBeGreaterThan(0);
    // PDF magic bytes
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  });
});

// ---------------------------------------------------------------------------
// parseClaudeResponse — happy path
// ---------------------------------------------------------------------------

describe("parseClaudeResponse — happy path", () => {
  it("parses the full sample Claude response fixture", () => {
    const json = JSON.stringify(SAMPLE_RESPONSE);
    const result = parseClaudeResponse(json);

    expect(result.currentRoleTitle).toBe("Senior Software Engineer");
    expect(result.yearsExperience).toBe(7);
    expect(result.skills).toContain("TypeScript");
    expect(result.skills).toContain("React");
    expect(result.qualifications).toHaveLength(1);
    expect(result.qualifications[0]).toMatch(/Computer Science/);
    expect(result.industrySector).toBe("Financial Technology");
    expect(result.languages).toContain("English");
    expect(result.languages).toContain("Twi");
  });

  it("returns skills / qualifications / languages as arrays", () => {
    const result = parseClaudeResponse(JSON.stringify(SAMPLE_RESPONSE));
    expect(Array.isArray(result.skills)).toBe(true);
    expect(Array.isArray(result.qualifications)).toBe(true);
    expect(Array.isArray(result.languages)).toBe(true);
  });

  it("coerces yearsExperience given as a string", () => {
    const result = parseClaudeResponse(
      JSON.stringify({ ...SAMPLE_RESPONSE, yearsExperience: "5" }),
    );
    expect(result.yearsExperience).toBe(5);
    expect(typeof result.yearsExperience).toBe("number");
  });

  it("rounds fractional yearsExperience to nearest integer", () => {
    const result = parseClaudeResponse(
      JSON.stringify({ ...SAMPLE_RESPONSE, yearsExperience: 4.8 }),
    );
    expect(result.yearsExperience).toBe(5);
  });

  it("trims whitespace from currentRoleTitle", () => {
    const result = parseClaudeResponse(
      JSON.stringify({ ...SAMPLE_RESPONSE, currentRoleTitle: "  Lead Engineer  " }),
    );
    expect(result.currentRoleTitle).toBe("Lead Engineer");
  });

  it("filters non-string entries out of skills array", () => {
    const result = parseClaudeResponse(
      JSON.stringify({ ...SAMPLE_RESPONSE, skills: ["Python", 42, null, "Go"] }),
    );
    expect(result.skills).toEqual(["Python", "Go"]);
  });
});

// ---------------------------------------------------------------------------
// parseClaudeResponse — partial / missing fields
// ---------------------------------------------------------------------------

describe("parseClaudeResponse — partial / missing fields", () => {
  it("returns empty arrays when skills / qualifications / languages are missing", () => {
    const result = parseClaudeResponse(
      JSON.stringify({ currentRoleTitle: "Analyst" }),
    );
    expect(result.skills).toEqual([]);
    expect(result.qualifications).toEqual([]);
    expect(result.languages).toEqual([]);
  });

  it("returns undefined for optional string fields when absent", () => {
    const result = parseClaudeResponse(JSON.stringify({ skills: ["SQL"] }));
    expect(result.currentRoleTitle).toBeUndefined();
    expect(result.industrySector).toBeUndefined();
    expect(result.yearsExperience).toBeUndefined();
  });

  it("returns undefined for currentRoleTitle when empty string", () => {
    const result = parseClaudeResponse(
      JSON.stringify({ currentRoleTitle: "   ", skills: [] }),
    );
    expect(result.currentRoleTitle).toBeUndefined();
  });

  it("ignores negative yearsExperience", () => {
    const result = parseClaudeResponse(
      JSON.stringify({ yearsExperience: -1, skills: [] }),
    );
    expect(result.yearsExperience).toBeUndefined();
  });

  it("ignores non-finite yearsExperience", () => {
    const result = parseClaudeResponse(
      JSON.stringify({ yearsExperience: null, skills: [] }),
    );
    expect(result.yearsExperience).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseClaudeResponse — malformed / unexpected input
// ---------------------------------------------------------------------------

describe("parseClaudeResponse — malformed input", () => {
  it("returns safe defaults for invalid JSON", () => {
    const result = parseClaudeResponse("not json at all");
    expect(result).toEqual({ skills: [], qualifications: [], languages: [] });
  });

  it("returns safe defaults for empty string", () => {
    const result = parseClaudeResponse("");
    expect(result).toEqual({ skills: [], qualifications: [], languages: [] });
  });

  it("returns safe defaults when Claude returns a JSON array instead of object", () => {
    const result = parseClaudeResponse('["item1", "item2"]');
    expect(result).toEqual({ skills: [], qualifications: [], languages: [] });
  });

  it("returns safe defaults when Claude returns a JSON string literal", () => {
    const result = parseClaudeResponse('"just a string"');
    expect(result).toEqual({ skills: [], qualifications: [], languages: [] });
  });

  it("returns safe defaults when Claude returns null", () => {
    const result = parseClaudeResponse("null");
    expect(result).toEqual({ skills: [], qualifications: [], languages: [] });
  });

  it("returns safe defaults when Claude returns JSON with completely wrong keys", () => {
    const result = parseClaudeResponse(JSON.stringify({ name: "Alice", age: 30 }));
    expect(result.skills).toEqual([]);
    expect(result.currentRoleTitle).toBeUndefined();
  });

  it("handles markdown-wrapped JSON by failing gracefully (raw action wraps this)", () => {
    // Claude sometimes wraps output in ```json … ```. parseClaudeResponse
    // doesn't strip it — that's fine, the action's prompt says "no markdown".
    // Verify it returns safe defaults rather than throwing.
    const result = parseClaudeResponse("```json\n{}\n```");
    expect(result).toEqual({ skills: [], qualifications: [], languages: [] });
  });

  it("returns safe defaults for JSON number", () => {
    const result = parseClaudeResponse("42");
    expect(result).toEqual({ skills: [], qualifications: [], languages: [] });
  });
});

// ---------------------------------------------------------------------------
// parseClaudeResponse — real-world CV output shape
// ---------------------------------------------------------------------------

describe("parseClaudeResponse — realistic response shapes", () => {
  it("handles a minimal one-job CV response", () => {
    const response = JSON.stringify({
      currentRoleTitle: "Junior Developer",
      yearsExperience: 1,
      skills: ["JavaScript", "HTML", "CSS"],
      qualifications: ["BSc Computer Science"],
      industrySector: "Software Engineering",
      languages: ["English"],
    });
    const result = parseClaudeResponse(response);
    expect(result.currentRoleTitle).toBe("Junior Developer");
    expect(result.yearsExperience).toBe(1);
    expect(result.skills).toHaveLength(3);
    expect(result.qualifications).toHaveLength(1);
    expect(result.industrySector).toBe("Software Engineering");
    expect(result.languages).toHaveLength(1);
  });

  it("handles a multi-lingual candidate correctly", () => {
    const response = JSON.stringify({
      skills: ["Java", "Spring Boot"],
      qualifications: [],
      languages: ["English", "Mandarin", "Cantonese", "Spanish"],
    });
    const result = parseClaudeResponse(response);
    expect(result.languages).toHaveLength(4);
    expect(result.languages).toContain("Mandarin");
  });

  it("handles empty arrays for all list fields", () => {
    const response = JSON.stringify({
      currentRoleTitle: "Graduate",
      yearsExperience: 0,
      skills: [],
      qualifications: [],
      industrySector: "Unknown",
      languages: [],
    });
    const result = parseClaudeResponse(response);
    expect(result.skills).toHaveLength(0);
    expect(result.yearsExperience).toBe(0);
  });
});
