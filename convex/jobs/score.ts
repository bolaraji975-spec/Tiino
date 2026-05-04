/**
 * score.ts — pure sponsorship scoring function
 *
 * scoreJob combines sponsor register data, JD signal detection, and
 * job metadata into a 0-100 score and a band label.
 *
 * Signals (applied in order, then clamped to 0–100):
 *   +40  JD explicitly mentions visa sponsorship (signal.explicit)
 *   +25  Sponsor on register with A rating
 *   +15  Sponsor on register with B rating
 *   +20  Public sector employer (nhs / civil_service / jobs_ac)
 *   +10  Sponsor on register but JD is silent on sponsorship
 *   −50  JD says no sponsorship / must have RTW (signal.negative)
 *   −30  Not on sponsor register and no explicit JD signal
 *
 * Band thresholds:
 *   score >= 60  →  "high"
 *   score >= 30  →  "medium"
 *   score >= 1   →  "low"
 *   score <= 0   →  "unknown"
 */

import type { CanonicalJob } from "./types";
import type { SponsorshipSignal } from "../lib/detectSponsorshipSignal";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ScoreBand = "high" | "medium" | "low" | "unknown";

export type ScoreSignal = {
  signal: string;
  weight: number;
  matched: boolean;
};

export type SponsorRow = {
  rating: string; // e.g. "Worker (A-rated)", "Skilled Worker (B-rated)"
};

export type ScoreResult = {
  score: number;
  band: ScoreBand;
  breakdown: ScoreSignal[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isARating(rating: string): boolean {
  return /a[- ]rat/i.test(rating) || /a\s+rating/i.test(rating);
}

function isBRating(rating: string): boolean {
  return /b[- ]rat/i.test(rating) || /b\s+rating/i.test(rating);
}

function toBand(score: number): ScoreBand {
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  if (score >= 1) return "low";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function scoreJob(
  job: CanonicalJob,
  sponsor: SponsorRow | null,
  signal: SponsorshipSignal,
): ScoreResult {
  const aRated = sponsor !== null && isARating(sponsor.rating);
  const bRated = sponsor !== null && isBRating(sponsor.rating);
  const sponsorSilent = sponsor !== null && !signal.explicit && !signal.negative;

  const breakdown: ScoreSignal[] = [
    { signal: "explicit_jd_signal",       weight: +40, matched: signal.explicit },
    { signal: "sponsor_a_rating",         weight: +25, matched: aRated },
    { signal: "sponsor_b_rating",         weight: +15, matched: bRated },
    { signal: "public_sector",            weight: +20, matched: job.isPublicSector },
    { signal: "sponsor_on_register",      weight: +10, matched: sponsorSilent },
    { signal: "negative_jd_signal",       weight: -50, matched: signal.negative },
    { signal: "not_on_register_no_signal",weight: -30, matched: sponsor === null && !signal.explicit },
  ];

  const raw = breakdown.reduce(
    (sum, s) => (s.matched ? sum + s.weight : sum),
    0,
  );
  const score = Math.max(0, Math.min(100, raw));

  return { score, band: toBand(score), breakdown };
}
