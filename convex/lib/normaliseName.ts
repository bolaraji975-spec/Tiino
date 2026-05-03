/**
 * normaliseName.ts
 *
 * Normalises a company name for matching against the Home Office sponsor register.
 * Both sides of a match (job feed company name AND register legal name) must be
 * normalised using this same function before comparison.
 *
 * Rules applied in order:
 * 1. Trim leading/trailing whitespace (register has leading spaces on every row)
 * 2. Lowercase
 * 3. Handle T/A (trading as) — strip the trading name portion
 * 4. Expand / standardise legal-form abbreviations
 * 5. Strip leading articles (the, a, an)
 * 6. Strip punctuation (except internal hyphens in compound words)
 * 7. Collapse whitespace
 * 8. Trim again
 */

const LEGAL_FORM_MAP: Record<string, string> = {
    " ltd": " limited",
    " ltd.": " limited",
    " plc": " plc",
    " plc.": " plc",
    " llp": " llp",
    " llp.": " llp",
    " llc": " llc",
    " inc": " incorporated",
    " inc.": " incorporated",
    " corp": " corporation",
    " corp.": " corporation",
    " co": " company",
    " co.": " company",
    " & co": " and company",
    " & co.": " and company",
    " cic": " cic",
    " cio": " cio",
    " lp": " lp",
  };
  
  const LEADING_ARTICLES = /^(the|an)\s+/i;  const STRIP_PUNCTUATION = /[^\w\s-]|(?<=\s)-|-(?=\s)/g;
  const COLLAPSE_WHITESPACE = /\s+/g;
  const AMPERSAND = /\s*&\s*/g;
  const TA_PATTERN = /\s+t\/a\s+.*/i;
  
  /**
   * Normalise a company name for matching.
   *
   * @example
   * normaliseName(" A KARIM PHARMA LTD") // "a karim pharma limited"
   * normaliseName("A4 RETAIL LIMITED T/A Braes Of Kirriemuir") // "a4 retail limited"
   * normaliseName("The Walt Disney Company Ltd.") // "walt disney company limited"
   */
  export function normaliseName(name: string): string {
    if (!name || typeof name !== "string") return "";
  
    let n = name.trim().toLowerCase();
    n = n.replace(TA_PATTERN, "");
    n = n.replace(AMPERSAND, " and ");
  
    const sortedForms = Object.entries(LEGAL_FORM_MAP).sort(
      ([a], [b]) => b.length - a.length,
    );
    for (const [abbr, expanded] of sortedForms) {
      if (n.endsWith(abbr)) {
        n = n.slice(0, n.length - abbr.length) + expanded;
        break;
      }
    }
  
    n = n.replace(LEADING_ARTICLES, "");
    n = n.replace(STRIP_PUNCTUATION, " ");
    n = n.replace(COLLAPSE_WHITESPACE, " ").trim();
  
    return n;
  }
  
  /**
   * Extract the trading name from a T/A pattern if present.
   *
   * @example
   * extractTradingName("A4 RETAIL LIMITED T/A Braes Of Kirriemuir")
   * // "Braes Of Kirriemuir"
   */
  export function extractTradingName(name: string): string | undefined {
    if (!name) return undefined;
    const match = name.match(/\bt\/a\s+(.+)/i);
    return match ? match[1].trim() : undefined;
  }
  
  /**
   * Normalise a name and return its tokens for token-set matching.
   */
  export function tokenise(name: string): string[] {
    return normaliseName(name)
      .split(" ")
      .filter(Boolean)
      .sort();
  }
  
  /**
   * Token-set ratio — measures how many tokens the two names share.
   * Returns 0–100 (100 = identical token sets).
   */
  export function tokenSetRatio(a: string, b: string): number {
    const tokensA = new Set(tokenise(a));
    const tokensB = new Set(tokenise(b));
  
    if (tokensA.size === 0 && tokensB.size === 0) return 100;
    if (tokensA.size === 0 || tokensB.size === 0) return 0;
  
    const intersection = new Set([...tokensA].filter((t) => tokensB.has(t)));
    const union = new Set([...tokensA, ...tokensB]);
  
    return Math.round((intersection.size / union.size) * 100);
  }