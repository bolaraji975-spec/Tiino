/**
 * lib/planGates.ts — pure plan-gate helpers.
 *
 * Rate limits:
 *   Free      : 1 CV generation per calendar month
 *   Pro       : 20 CV generations per calendar month
 *   Pay-per-CV: 1 credit deducted per generation (credits never expire)
 *
 * Save limits:
 *   Free : max 3 saved jobs
 *   Pro  : unlimited
 *
 * Score visibility:
 *   Free : band label only
 *   Pro  : numeric score + signal breakdown
 *
 * Daily digest:
 *   Pro only
 */

export type UserPlan = {
  plan: "free" | "pro_monthly" | "pro_annual";
  payPerCvCredits: number;
  cvGenerationsThisMonth?: number;
};

function isPro(user: UserPlan): boolean {
  return user.plan === "pro_monthly" || user.plan === "pro_annual";
}

/** Returns true if the user is allowed to generate a CV right now. */
export function canGenerateCv(user: UserPlan): boolean {
  const used = user.cvGenerationsThisMonth ?? 0;
  if (isPro(user)) return used < 20;
  if (user.payPerCvCredits > 0) return true;
  return used < 1;
}

/** Returns the human-readable reason why CV generation is blocked, or null if allowed. */
export function cvBlockReason(user: UserPlan): string | null {
  if (canGenerateCv(user)) return null;
  if (isPro(user)) return "Monthly CV limit reached (20/month). Resets on the 1st.";
  if (user.payPerCvCredits === 0 && (user.cvGenerationsThisMonth ?? 0) >= 1) {
    return "Free plan allows 1 CV per month. Upgrade to Pro or buy a credit.";
  }
  return "CV generation limit reached.";
}

/** Returns true if the user can save another job. */
export function canSaveJob(user: UserPlan, currentSavedCount: number): boolean {
  if (isPro(user)) return true;
  return currentSavedCount < 3;
}

/** Returns true if the user can see the full numeric score and breakdown. */
export function canViewScore(user: UserPlan): boolean {
  return isPro(user);
}

/** Returns true if the user can receive the daily digest email. */
export function canAccessDigest(user: UserPlan): boolean {
  return isPro(user);
}
