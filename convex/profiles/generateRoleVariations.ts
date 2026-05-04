/**
 * generateRoleVariations.ts — "use node" internal action
 *
 * Reads the user's currentRoleTitle and skills from their profile, calls
 * Claude Haiku to generate 6–10 role title variations, and writes them back
 * onto the profile as roleVariations.exact and roleVariations.adjacent.
 *
 * Triggered by parseCv after a successful CV parse. Also suitable for
 * manual re-generation via a future UI action.
 *
 * Failures are non-fatal — leaves roleVariations arrays empty and records
 * a role_variations_error event.
 */

"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RoleVariations = {
  exact: string[];
  adjacent: string[];
};

// ---------------------------------------------------------------------------
// Pure helper — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Parses the raw text returned by Claude into validated RoleVariations.
 * Each array is capped at 10 entries and non-string items are dropped.
 * Returns safe empty defaults on any parse or type error.
 */
export function parseRoleVariationsResponse(text: string): RoleVariations {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { exact: [], adjacent: [] };
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { exact: [], adjacent: [] };
  }

  const obj = raw as Record<string, unknown>;

  const asStringArray = (v: unknown): string[] =>
    Array.isArray(v)
      ? v
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim())
          .slice(0, 10)
      : [];

  return {
    exact: asStringArray(obj.exact),
    adjacent: asStringArray(obj.adjacent),
  };
}

// ---------------------------------------------------------------------------
// Claude API call
// ---------------------------------------------------------------------------

function buildPrompt(roleTitle: string, skills: string[]): string {
  const skillsList =
    skills.length > 0 ? skills.slice(0, 20).join(", ") : "not specified";

  return `You are helping match a job seeker with relevant UK job listings.

Candidate's current role title: ${roleTitle}
Candidate's skills: ${skillsList}

Generate role title variations in two categories:

1. "exact" — 3 to 5 alternative titles for the same level of role (same seniority, different common wording)
2. "adjacent" — 3 to 5 related roles the candidate could credibly apply for (closely related domain or slight step up)

Return a JSON object with exactly this shape:
{
  "exact": ["Title 1", "Title 2", ...],
  "adjacent": ["Title A", "Title B", ...]
}

Rules:
- Use realistic UK job board titles
- No seniority inflation beyond one level for adjacent roles
- Return only the JSON object, no markdown, no explanation`;
}

async function callClaude(
  roleTitle: string,
  skills: string[],
  apiKey: string,
): Promise<RoleVariations> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: buildPrompt(roleTitle, skills),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude API error ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };

  const text = data.content?.find((c) => c.type === "text")?.text ?? "{}";
  return parseRoleVariationsResponse(text);
}

// ---------------------------------------------------------------------------
// Exported internal action
// ---------------------------------------------------------------------------

export const generateRoleVariations = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<{ ok: boolean; error?: string }> => {
    // --- 1. Load profile ---
    const profile = await ctx.runQuery(internal.profiles._getProfileForUser, { userId });

    if (!profile) {
      return { ok: false, error: "No profile found." };
    }

    if (!profile.currentRoleTitle) {
      // No role title yet — nothing to vary; silently skip without error event
      return { ok: false, error: "No role title on profile." };
    }

    // --- 2. Call Claude ---
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.profiles._recordEvent, {
        userId,
        type: "role_variations_error",
        payload: { code: "MISSING_ENV", message: "ANTHROPIC_API_KEY not set" },
      });
      return { ok: false, error: "Role variation generation is not configured." };
    }

    let variations: RoleVariations;
    try {
      variations = await callClaude(profile.currentRoleTitle, profile.skills, apiKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.profiles._recordEvent, {
        userId,
        type: "role_variations_error",
        payload: { code: "CLAUDE_ERROR", message },
      });
      return { ok: false, error: "Role variation generation failed." };
    }

    // --- 3. Persist ---
    await ctx.runMutation(internal.profiles._applyRoleVariations, {
      profileId: profile._id,
      roleVariations: variations,
    });

    await ctx.runMutation(internal.profiles._recordEvent, {
      userId,
      type: "role_variations_generated",
      payload: {
        exact: variations.exact.length,
        adjacent: variations.adjacent.length,
        roleTitle: profile.currentRoleTitle,
      },
    });

    return { ok: true };
  },
});
