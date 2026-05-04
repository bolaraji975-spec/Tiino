/**
 * detectSponsorshipSignal.ts
 *
 * Scans a job description for explicit positive or negative visa sponsorship
 * signals. Used during ingestion to set the `explicit` flag and adjust scores.
 *
 * Returns:
 *   explicit        – true when a positive sponsorship pattern matched
 *   negative        – true when a negative / exclusion pattern matched
 *   confidence      – 0–1 reliability estimate
 *   matchedPattern  – the pattern label that triggered (for debugging)
 *
 * If both positive and negative patterns match (contradictory JD), the
 * negative signal takes precedence (conservative — false positives are costly).
 */

export type SponsorshipSignal = {
  explicit: boolean;
  negative: boolean;
  confidence: number;
  matchedPattern?: string;
};

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

type PatternEntry = { label: string; re: RegExp };

const POSITIVE_PATTERNS: PatternEntry[] = [
  { label: "visa_sponsorship_available",   re: /visa\s+sponsorship\s+(?:is\s+)?(?:available|provided|offered|included)/i },
  { label: "certificate_of_sponsorship",   re: /certificate\s+of\s+sponsorship/i },
  { label: "we_can_sponsor",               re: /we\s+(?:can|are\s+able\s+to|will)\s+sponsor/i },
  { label: "happy_to_sponsor",             re: /happy\s+to\s+sponsor/i },
  { label: "able_to_provide_sponsorship",  re: /able\s+to\s+provide\s+(?:visa\s+)?sponsorship/i },
  { label: "sponsorship_provided",         re: /sponsorship\s+(?:is\s+)?(?:provided|available|offered|possible)/i },
  { label: "sponsor_visa",                 re: /sponsor(?:ing|ed|s)?\s+(?:your\s+)?(?:visa|work\s+permit)/i },
  { label: "skilled_worker_sponsorship",   re: /skilled\s+worker\s+(?:visa\s+)?sponsor/i },
  { label: "tier_2_sponsor",               re: /tier\s*[-–]?\s*2\s+(?:visa\s+)?sponsor/i },
  { label: "we_offer_sponsorship",         re: /we\s+(?:do\s+)?offer\s+(?:visa\s+)?sponsorship/i },
  { label: "cos_available",                re: /\bcos\b.{0,40}available/i },
  { label: "relocation_and_sponsorship",   re: /relocation\s+and\s+(?:visa\s+)?sponsorship/i },
];

const NEGATIVE_PATTERNS: PatternEntry[] = [
  { label: "cannot_sponsor",               re: /cannot\s+(?:offer\s+|provide\s+)?(?:visa\s+)?sponsor/i },
  { label: "cant_sponsor",                 re: /can(?:'t|\s+not)\s+(?:offer\s+|provide\s+)?(?:visa\s+)?sponsor/i },
  { label: "unable_to_sponsor",            re: /unable\s+to\s+(?:offer\s+|provide\s+)?(?:visa\s+)?sponsor/i },
  { label: "does_not_sponsor",             re: /do(?:es)?\s+not\s+(?:offer\s+|provide\s+)?(?:visa\s+)?sponsor/i },
  { label: "no_visa_sponsorship",          re: /no\s+visa\s+sponsorship/i },
  { label: "sponsorship_not_available",    re: /sponsorship\s+(?:is\s+)?not\s+(?:available|provided|offered|possible)/i },
  { label: "must_have_right_to_work",      re: /must\s+(?:already\s+)?(?:have|hold|possess)\s+(?:the\s+)?right\s+to\s+work/i },
  { label: "right_to_work_required",       re: /right\s+to\s+work\s+(?:in\s+the\s+uk\s+)?(?:is\s+)?required/i },
  { label: "must_be_eligible_to_work",     re: /must\s+be\s+(?:eligible|authoris(?:ed|z)ed|permitted)\s+to\s+work\s+in\s+the\s+uk/i },
  { label: "no_work_permit",               re: /(?:no|not)\s+(?:able\s+to\s+|in\s+a\s+position\s+to\s+)?provide\s+(?:a\s+)?work\s+permit/i },
  { label: "we_do_not_sponsor",            re: /we\s+do\s+not\s+sponsor/i },
  { label: "not_eligible_to_sponsor",      re: /not\s+(?:a\s+)?(?:licensed\s+)?sponsor(?:ing)?\s+(?:employer|organisation|organization|company)/i },
];

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function detectSponsorshipSignal(description: string): SponsorshipSignal {
  if (!description) {
    return { explicit: false, negative: false, confidence: 0 };
  }

  let positiveMatch: PatternEntry | undefined;
  let negativeMatch: PatternEntry | undefined;

  for (const entry of POSITIVE_PATTERNS) {
    if (entry.re.test(description)) {
      positiveMatch = entry;
      break; // first match is enough
    }
  }

  for (const entry of NEGATIVE_PATTERNS) {
    if (entry.re.test(description)) {
      negativeMatch = entry;
      break;
    }
  }

  // Contradictory: negative wins (false positives are the costly error)
  if (negativeMatch && positiveMatch) {
    return {
      explicit: false,
      negative: true,
      confidence: 0.70,
      matchedPattern: negativeMatch.label,
    };
  }

  if (negativeMatch) {
    return {
      explicit: false,
      negative: true,
      confidence: 0.95,
      matchedPattern: negativeMatch.label,
    };
  }

  if (positiveMatch) {
    return {
      explicit: true,
      negative: false,
      confidence: 0.90,
      matchedPattern: positiveMatch.label,
    };
  }

  return { explicit: false, negative: false, confidence: 0 };
}
