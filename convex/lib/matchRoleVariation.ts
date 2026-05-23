/**
 * matchRoleVariation.ts
 *
 * Two matching functions for the feed:
 *
 * matchesRoleVariation (strict) — bidirectional token-set subset check.
 *   Used for the "Matches your profile" signal on the job detail panel.
 *   "Software Engineer" ⊆ "Senior Software Engineer" → match
 *   "Platform Engineer" vs "Software Engineer" → no match (shares "engineer"
 *   but subset check fails both ways).
 *
 * matchesRoleVariationLoose — ANY significant word from ANY variation appears
 *   in the job title. Used for the feed filter so that e.g. a user with
 *   "Data Analyst" sees "Business Analyst" jobs too. Falls back to all jobs
 *   if fewer than 5 results (handled in listForUser).
 *
 * When variations is empty every job matches in both functions.
 */

// Words excluded from loose matching to avoid noise
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "of", "in", "at", "for", "with",
  "to", "is", "are", "by", "as", "on", "it", "be", "its", "from",
  "up", "out", "role", "job", "work", "based",
]);

/**
 * Loose feed filter: job title matches if ANY significant word from ANY
 * variation appears in the title. Min word length 3 to skip noise.
 */
export function matchesRoleVariationLoose(
  jobTitle: string,
  variations: string[],
): boolean {
  if (variations.length === 0) return true;

  // Collect all significant words across all variations
  const variationWords = new Set(
    variations.flatMap((v) =>
      tokenize(v).filter((t) => t.length >= 3 && !STOP_WORDS.has(t)),
    ),
  );

  if (variationWords.size === 0) return true;

  const titleTokens = tokenize(jobTitle);
  return [...variationWords].some((w) => titleTokens.includes(w));
}

export function matchesRoleVariation(
  jobTitle: string,
  variations: string[],
): boolean {
  if (variations.length === 0) return true;

  const titleTokens = tokenize(jobTitle);
  if (titleTokens.length === 0) return false;

  return variations.some((variation) => {
    const varTokens = tokenize(variation);
    if (varTokens.length === 0) return false;

    // All variation tokens present in title (e.g. "Software Engineer" ⊆ "Senior Software Engineer")
    const varSubsetOfTitle = varTokens.every((t) => titleTokens.includes(t));
    // All title tokens present in variation (e.g. "Software Engineer" ⊆ "Senior Software Engineer" variation)
    const titleSubsetOfVar = titleTokens.every((t) => varTokens.includes(t));

    return varSubsetOfTitle || titleSubsetOfVar;
  });
}

function tokenize(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}
