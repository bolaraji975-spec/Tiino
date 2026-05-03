import { describe, it, expect } from "vitest";
import { normaliseName, tokenise, tokenSetRatio, extractTradingName } from "../../convex/lib/normaliseName";

describe("normaliseName — basic rules", () => {
  it("lowercases input", () => {
    expect(normaliseName("HSBC BANK PLC")).toBe("hsbc bank plc");
  });

  it("trims leading whitespace (register has leading spaces on every row)", () => {
    expect(normaliseName(" A KARIM PHARMA LTD")).toBe("a karim pharma limited");
    expect(normaliseName("  DOUBLE SPACE LTD")).toBe("double space limited");
  });

  it("expands Ltd to limited", () => {
    expect(normaliseName("Acme Solutions Ltd")).toBe("acme solutions limited");
    expect(normaliseName("Acme Solutions Ltd.")).toBe("acme solutions limited");
  });

  it("standardises plc", () => {
    expect(normaliseName("J. Sainsbury PLC")).toBe("j sainsbury plc");
  });

  it("standardises llp", () => {
    expect(normaliseName("Deloitte LLP")).toBe("deloitte llp");
  });

  it("strips leading article 'the'", () => {
    expect(normaliseName("The Walt Disney Company")).toBe("walt disney company");
  });

  it("normalises ampersand to and", () => {
    expect(normaliseName("Marks & Spencer PLC")).toBe("marks and spencer plc");
  });

  it("strips punctuation", () => {
    expect(normaliseName("Smith, Jones & Brown Ltd.")).toBe("smith jones and brown limited");
  });

  it("collapses multiple spaces", () => {
    expect(normaliseName("KPMG   LLP")).toBe("kpmg llp");
  });

  it("handles empty string", () => {
    expect(normaliseName("")).toBe("");
  });

  it("handles null-ish input gracefully", () => {
    expect(normaliseName(undefined as unknown as string)).toBe("");
  });

  it("does not mangle hyphens in compound names", () => {
    expect(normaliseName("Rolls-Royce Holdings PLC")).toContain("rolls-royce");
  });
});

describe("normaliseName — T/A pattern (real register data)", () => {
  it("strips T/A trading name, keeps legal name", () => {
    expect(normaliseName("A4 RETAIL LIMITED T/A Braes Of Kirriemuir")).toBe("a4 retail limited");
  });

  it("strips T/A with lower case t/a", () => {
    expect(normaliseName("ANCHOR CATERING LIMITED t/a The Kitchen")).toBe("anchor catering limited");
  });

  it("handles T/A with no trailing space variations", () => {
    expect(normaliseName("AbleCare (Menwinnion) Ltd T/A Menwinnion Country House Care Home")).toBe("ablecare menwinnion limited");
  });

  it("leaves names without T/A unchanged", () => {
    expect(normaliseName("Amazon UK Services Ltd")).toBe("amazon uk services limited");
  });
});

describe("normaliseName — real register names", () => {
  const cases: Array<[string, string]> = [
    [" A KARIM PHARMA LTD", "a karim pharma limited"],
    [" A M ELECTRICAL INSTALLATIONS LIMITED", "a m electrical installations limited"],
    [" A-Z LIVE LTD", "a-z live limited"],
    [" Aaban Partnership Limited", "aaban partnership limited"],
    ["Tesco PLC", "tesco plc"],
    ["Amazon UK Services Ltd", "amazon uk services limited"],
    ["PricewaterhouseCoopers LLP", "pricewaterhousecoopers llp"],
    ["BBC Studios Ltd", "bbc studios limited"],
  ];

  for (const [input, expected] of cases) {
    it(`normalises "${input.trim()}"`, () => {
      expect(normaliseName(input)).toBe(expected);
    });
  }
});

describe("extractTradingName", () => {
  it("extracts trading name after T/A", () => {
    expect(extractTradingName("A4 RETAIL LIMITED T/A Braes Of Kirriemuir")).toBe("Braes Of Kirriemuir");
  });

  it("returns undefined when no T/A present", () => {
    expect(extractTradingName("Amazon UK Services Ltd")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(extractTradingName("")).toBeUndefined();
  });

  it("handles long trading names", () => {
    const result = extractTradingName(
      "AbleCare (Menwinnion) Ltd T/A Menwinnion Country House Care Home",
    );
    expect(result).toBe("Menwinnion Country House Care Home");
  });
});

describe("tokenise", () => {
  it("returns sorted tokens", () => {
    expect(tokenise("Barclays Bank PLC")).toEqual(["bank", "barclays", "plc"]);
  });

  it("returns empty array for empty string", () => {
    expect(tokenise("")).toEqual([]);
  });
});

describe("tokenSetRatio", () => {
  it("returns 100 for identical names", () => {
    expect(tokenSetRatio("hsbc bank plc", "hsbc bank plc")).toBe(100);
  });

  it("returns 100 for same tokens in different order", () => {
    expect(tokenSetRatio("bank hsbc plc", "hsbc bank plc")).toBe(100);
  });

  it("returns 0 for completely different names", () => {
    expect(tokenSetRatio("apple inc", "microsoft corporation")).toBe(0);
  });

  it("returns partial ratio for overlapping names", () => {
    const ratio = tokenSetRatio("amazon web services", "amazon logistics");
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(100);
  });

  it("handles empty strings", () => {
    expect(tokenSetRatio("", "")).toBe(100);
    expect(tokenSetRatio("", "amazon")).toBe(0);
  });
});