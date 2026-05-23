/**
 * companyLogo.ts
 *
 * Pure utility functions for company logo display.
 * Safe to import in both frontend and backend contexts — no Convex deps.
 *
 * getLogoUrl     — Clearbit logo URL with hardcoded overrides for known employers
 * getInitials    — two-letter abbreviation from company name
 * getInitialsColor — deterministic brand-safe colour from company name hash
 */

// ---------------------------------------------------------------------------
// Domain override map — known UK / global employers
// ---------------------------------------------------------------------------

const DOMAIN_OVERRIDES: Record<string, string> = {
  // Retail
  "marks and spencer":    "marksandspencer.com",
  "m&s":                  "marksandspencer.com",
  "john lewis":           "johnlewis.com",
  "waitrose":             "waitrose.com",
  "tesco":                "tesco.com",
  "sainsbury":            "sainsburys.co.uk",
  "asda":                 "asda.com",
  "boots":                "boots.com",
  "next":                 "next.co.uk",

  // Telecom / Media
  "bt":                   "bt.com",
  "british telecom":      "bt.com",
  "british telecommunications": "bt.com",
  "sky":                  "sky.com",
  "sky uk":               "sky.com",
  "virgin media":         "virginmedia.com",
  "vodafone":             "vodafone.com",
  "three":                "three.co.uk",
  "o2":                   "o2.co.uk",
  "bbc":                  "bbc.co.uk",
  "itv":                  "itv.com",
  "channel 4":            "channel4.com",

  // Finance / Banking
  "lloyds":               "lloydsbank.com",
  "lloyds bank":          "lloydsbank.com",
  "barclays":             "barclays.com",
  "hsbc":                 "hsbc.com",
  "natwest":              "natwest.com",
  "rbs":                  "rbs.com",
  "royal bank of scotland": "rbs.com",
  "santander":            "santander.co.uk",
  "halifax":              "halifax.co.uk",
  "nationwide":           "nationwide.co.uk",
  "monzo":                "monzo.com",
  "revolut":              "revolut.com",
  "wise":                 "wise.com",
  "starling":             "starlingbank.com",
  "transferwise":         "wise.com",

  // Insurance
  "aviva":                "aviva.com",
  "axa":                  "axa.co.uk",
  "zurich":               "zurich.co.uk",
  "legal and general":    "legalandgeneral.com",
  "prudential":           "prudential.co.uk",

  // Consulting / Professional services
  "deloitte":             "deloitte.com",
  "pwc":                  "pwc.co.uk",
  "pricewaterhousecoopers": "pwc.co.uk",
  "ernst and young":      "ey.com",
  "ey":                   "ey.com",
  "kpmg":                 "kpmg.com",
  "accenture":            "accenture.com",
  "mckinsey":             "mckinsey.com",
  "bain":                 "bain.com",
  "bcg":                  "bcg.com",
  "boston consulting":    "bcg.com",
  "capita":               "capita.com",
  "serco":                "serco.com",
  "fujitsu":              "fujitsu.com",
  "ibm":                  "ibm.com",
  "wipro":                "wipro.com",
  "infosys":              "infosys.com",
  "tata consultancy":     "tcs.com",
  "tcs":                  "tcs.com",

  // Tech — global
  "google":               "google.com",
  "google deepmind":      "deepmind.com",
  "deepmind":             "deepmind.com",
  "meta":                 "meta.com",
  "apple":                "apple.com",
  "microsoft":            "microsoft.com",
  "amazon":               "amazon.co.uk",
  "aws":                  "aws.amazon.com",
  "netflix":              "netflix.com",
  "spotify":              "spotify.com",
  "uber":                 "uber.com",
  "airbnb":               "airbnb.com",
  "salesforce":           "salesforce.com",
  "oracle":               "oracle.com",
  "sap":                  "sap.com",
  "adobe":                "adobe.com",

  // Tech — UK
  "deliveroo":            "deliveroo.co.uk",
  "ocado":                "ocado.com",
  "bet365":               "bet365.com",
  "sky betting":          "skybettingandgaming.com",
  "funding circle":       "fundingcircle.com",
  "transfer wise":        "wise.com",
  "darktrace":            "darktrace.com",
  "arm":                  "arm.com",
  "sage":                 "sage.com",
  "autonomy":             "autonomy.com",

  // Pharma / Healthcare
  "nhs":                  "nhs.uk",
  "gsk":                  "gsk.com",
  "glaxosmithkline":      "gsk.com",
  "astrazeneca":          "astrazeneca.com",
  "pfizer":               "pfizer.com",
  "johnson and johnson":  "jnj.com",
  "roche":                "roche.com",
  "novartis":             "novartis.com",
  "bupa":                 "bupa.co.uk",
  "nuffield health":      "nuffieldhealth.com",

  // Defence / Government
  "bae systems":          "baesystems.com",
  "rolls royce":          "rolls-royce.com",
  "qinetiq":              "qinetiq.com",
  "leidos":               "leidos.com",
  "dxc technology":       "dxc.com",
};

// ---------------------------------------------------------------------------
// Brand-safe colour palette (12 colours — deterministic from name hash)
// ---------------------------------------------------------------------------

const PALETTE = [
  "#1BAAC1", // teal (brand)
  "#0EA5E9", // sky
  "#6366F1", // indigo
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#EF4444", // red
  "#F97316", // orange
  "#F59E0B", // amber
  "#10B981", // emerald
  "#14B8A6", // teal variant
  "#06B6D4", // cyan
  "#84CC16", // lime
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simple djb2 hash — deterministic, fast, pure JS */
function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0; // keep as unsigned 32-bit
  }
  return h;
}

/** Normalise company name for override map lookup */
function normaliseForLookup(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(?:limited|ltd|plc|group|inc|llp|llc|corporation|corp|uk|the)\b/gi, "")
    .replace(/[^a-z0-9\s&]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Derive a domain from a company name (rough heuristic for unknowns) */
function deriveDomain(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/\s+(?:limited|ltd|plc|group|inc|llp|llc|corporation|corp|uk)\b/gi, "")
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 30) + ".com"
  );
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Returns the Clearbit logo URL for a company.
 *
 * Special-cased before the override map:
 *   NHS / Trust / Foundation Trust / Hospital names → nhs.uk logo
 *   (virtually all UK Foundation Trusts and NHS Trusts are NHS organisations)
 *
 * Then falls through to the domain override map, then derives a domain.
 */
export function getLogoUrl(companyName: string): string {
  // NHS pattern: any name containing "NHS", "Foundation Trust", standalone
  // "Trust" (NHS context), or "Hospital" / "Infirmary" is treated as NHS.
  if (
    /\bnhs\b/i.test(companyName) ||
    /foundation\s+trust/i.test(companyName) ||
    /\btrust\b/i.test(companyName) ||
    /\bhospital\b/i.test(companyName) ||
    /\binfirmary\b/i.test(companyName)
  ) {
    return "https://logo.clearbit.com/nhs.uk";
  }

  const key = normaliseForLookup(companyName);
  const domain = DOMAIN_OVERRIDES[key] ?? deriveDomain(companyName);
  return `https://logo.clearbit.com/${domain}`;
}

/**
 * Returns a two-letter abbreviation from the first letter of the first two words.
 * "KPMG Technology" → "KT"
 * "NHS" → "NH"
 * "Deliveroo" → "DE"
 */
export function getInitials(companyName: string): string {
  const words = companyName
    .trim()
    .split(/\s+/)
    .filter((w) => !/^(the|a|an|&|and|of|for|in|at|by)$/i.test(w));

  if (words.length === 0) return "??";
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Returns a deterministic brand-safe hex colour from the company name.
 * The same name always returns the same colour across renders.
 */
export function getInitialsColor(companyName: string): string {
  const idx = djb2(companyName.toLowerCase()) % PALETTE.length;
  return PALETTE[idx];
}
