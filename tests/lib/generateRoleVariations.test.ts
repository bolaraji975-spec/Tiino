import { describe, it, expect } from "vitest";
import { parseRoleVariationsResponse } from "../../convex/profiles/generateRoleVariations";
import type { RoleVariations } from "../../convex/profiles/generateRoleVariations";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function validResponse(overrides: Partial<RoleVariations> = {}): string {
  return JSON.stringify({
    exact: [
      "Software Engineer",
      "Software Developer",
      "Backend Engineer",
      "Full Stack Developer",
    ],
    adjacent: [
      "Senior Software Engineer",
      "Tech Lead",
      "Platform Engineer",
      "Solutions Architect",
    ],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("parseRoleVariationsResponse — happy path", () => {
  it("parses exact and adjacent arrays from valid response", () => {
    const result = parseRoleVariationsResponse(validResponse());
    expect(result.exact).toHaveLength(4);
    expect(result.adjacent).toHaveLength(4);
  });

  it("includes expected titles in exact array", () => {
    const result = parseRoleVariationsResponse(validResponse());
    expect(result.exact).toContain("Software Engineer");
    expect(result.exact).toContain("Backend Engineer");
  });

  it("includes expected titles in adjacent array", () => {
    const result = parseRoleVariationsResponse(validResponse());
    expect(result.adjacent).toContain("Tech Lead");
    expect(result.adjacent).toContain("Solutions Architect");
  });

  it("total variations are within 6–10 range for typical response", () => {
    const result = parseRoleVariationsResponse(validResponse());
    const total = result.exact.length + result.adjacent.length;
    expect(total).toBeGreaterThanOrEqual(6);
    expect(total).toBeLessThanOrEqual(10);
  });

  it("trims whitespace from each title", () => {
    const result = parseRoleVariationsResponse(
      JSON.stringify({
        exact: ["  Software Engineer  ", " Backend Engineer "],
        adjacent: [" Tech Lead "],
      }),
    );
    expect(result.exact).toContain("Software Engineer");
    expect(result.exact).toContain("Backend Engineer");
    expect(result.adjacent).toContain("Tech Lead");
  });

  it("accepts a response with only exact titles", () => {
    const result = parseRoleVariationsResponse(
      JSON.stringify({ exact: ["Developer", "Engineer"], adjacent: [] }),
    );
    expect(result.exact).toHaveLength(2);
    expect(result.adjacent).toHaveLength(0);
  });

  it("accepts a response with only adjacent titles", () => {
    const result = parseRoleVariationsResponse(
      JSON.stringify({ exact: [], adjacent: ["Product Manager", "Engineering Manager"] }),
    );
    expect(result.exact).toHaveLength(0);
    expect(result.adjacent).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Array length caps
// ---------------------------------------------------------------------------

describe("parseRoleVariationsResponse — array caps", () => {
  it("caps exact array at 10 entries", () => {
    const many = Array.from({ length: 15 }, (_, i) => `Title ${i}`);
    const result = parseRoleVariationsResponse(
      JSON.stringify({ exact: many, adjacent: [] }),
    );
    expect(result.exact).toHaveLength(10);
  });

  it("caps adjacent array at 10 entries", () => {
    const many = Array.from({ length: 12 }, (_, i) => `Adjacent ${i}`);
    const result = parseRoleVariationsResponse(
      JSON.stringify({ exact: [], adjacent: many }),
    );
    expect(result.adjacent).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// Type filtering
// ---------------------------------------------------------------------------

describe("parseRoleVariationsResponse — type filtering", () => {
  it("drops non-string entries from exact array", () => {
    const result = parseRoleVariationsResponse(
      JSON.stringify({ exact: ["Engineer", 42, null, true, "Developer"], adjacent: [] }),
    );
    expect(result.exact).toEqual(["Engineer", "Developer"]);
  });

  it("drops non-string entries from adjacent array", () => {
    const result = parseRoleVariationsResponse(
      JSON.stringify({ exact: [], adjacent: [null, "Tech Lead", {}, "PM"] }),
    );
    expect(result.adjacent).toEqual(["Tech Lead", "PM"]);
  });

  it("drops empty-string entries", () => {
    const result = parseRoleVariationsResponse(
      JSON.stringify({ exact: ["", "Engineer", "  "], adjacent: [] }),
    );
    expect(result.exact).toEqual(["Engineer"]);
  });
});

// ---------------------------------------------------------------------------
// Missing fields
// ---------------------------------------------------------------------------

describe("parseRoleVariationsResponse — missing fields", () => {
  it("returns empty exact when key is absent", () => {
    const result = parseRoleVariationsResponse(
      JSON.stringify({ adjacent: ["Tech Lead"] }),
    );
    expect(result.exact).toEqual([]);
    expect(result.adjacent).toEqual(["Tech Lead"]);
  });

  it("returns empty adjacent when key is absent", () => {
    const result = parseRoleVariationsResponse(
      JSON.stringify({ exact: ["Engineer"] }),
    );
    expect(result.exact).toEqual(["Engineer"]);
    expect(result.adjacent).toEqual([]);
  });

  it("returns both empty when object has unrelated keys", () => {
    const result = parseRoleVariationsResponse(
      JSON.stringify({ titles: ["Engineer"], roles: ["PM"] }),
    );
    expect(result.exact).toEqual([]);
    expect(result.adjacent).toEqual([]);
  });

  it("returns empty arrays for exact empty object", () => {
    const result = parseRoleVariationsResponse(JSON.stringify({}));
    expect(result).toEqual({ exact: [], adjacent: [] });
  });
});

// ---------------------------------------------------------------------------
// Malformed / unexpected input
// ---------------------------------------------------------------------------

describe("parseRoleVariationsResponse — malformed input", () => {
  it("returns safe defaults for invalid JSON", () => {
    const result = parseRoleVariationsResponse("not json");
    expect(result).toEqual({ exact: [], adjacent: [] });
  });

  it("returns safe defaults for empty string", () => {
    const result = parseRoleVariationsResponse("");
    expect(result).toEqual({ exact: [], adjacent: [] });
  });

  it("returns safe defaults when top-level is a JSON array", () => {
    const result = parseRoleVariationsResponse('["Engineer", "Developer"]');
    expect(result).toEqual({ exact: [], adjacent: [] });
  });

  it("returns safe defaults when top-level is null", () => {
    const result = parseRoleVariationsResponse("null");
    expect(result).toEqual({ exact: [], adjacent: [] });
  });

  it("returns safe defaults when top-level is a string literal", () => {
    const result = parseRoleVariationsResponse('"just a string"');
    expect(result).toEqual({ exact: [], adjacent: [] });
  });

  it("returns safe defaults when top-level is a number", () => {
    const result = parseRoleVariationsResponse("42");
    expect(result).toEqual({ exact: [], adjacent: [] });
  });

  it("handles markdown-wrapped JSON gracefully (returns empty, not throws)", () => {
    const result = parseRoleVariationsResponse("```json\n{}\n```");
    expect(result).toEqual({ exact: [], adjacent: [] });
  });

  it("returns safe defaults when exact is a string instead of array", () => {
    const result = parseRoleVariationsResponse(
      JSON.stringify({ exact: "Engineer", adjacent: ["PM"] }),
    );
    expect(result.exact).toEqual([]);
    expect(result.adjacent).toEqual(["PM"]);
  });

  it("returns safe defaults when adjacent is an object instead of array", () => {
    const result = parseRoleVariationsResponse(
      JSON.stringify({ exact: ["Engineer"], adjacent: { role: "PM" } }),
    );
    expect(result.exact).toEqual(["Engineer"]);
    expect(result.adjacent).toEqual([]);
  });
});
