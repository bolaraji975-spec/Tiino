/**
 * matchRoleVariation.ts
 *
 * Pure helper: returns true when a job title matches at least one of the user's
 * role variation strings (exact or adjacent titles from their profile).
 *
 * Matching rule: tokenise both strings (lowercase, split on non-alphanumeric),
 * then check bidirectional token-set subset — i.e. all variation tokens appear
 * in the title OR all title tokens appear in the variation. This lets:
 *   - "Software Engineer" match "Senior Software Engineer"  (var ⊆ title)
 *   - "Senior Software Engineer" match "Software Engineer"  (title ⊆ var)
 *
 * When variations is empty (profile not yet set up) every job matches.
 */

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
