/**
 * parseCv.ts — "use node" action
 *
 * Reads the user's uploaded CV from Convex storage, sends it to Claude Haiku
 * as a base64-encoded PDF document, parses the structured JSON response, and
 * writes the extracted fields back onto the user's profile.
 *
 * Failures are non-fatal:
 *   - Storage or auth errors → record an error event, return without patching
 *   - Claude API errors      → record an error event, return without patching
 *   - JSON parse errors      → record an error event, return without patching
 *
 * Only PDF files are sent to Claude. DOCX files result in a recorded
 * UNSUPPORTED_FORMAT event (no profile patch) until DOCX parsing is added.
 */

"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParsedCvData = {
  currentRoleTitle?: string;
  yearsExperience?: number;
  skills: string[];
  qualifications: string[];
  industrySector?: string;
  languages: string[];
};

// ---------------------------------------------------------------------------
// Pure helper — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Parses the raw text returned by Claude into a validated ParsedCvData object.
 * Returns safe empty defaults on any parse or type error.
 */
export function parseClaudeResponse(text: string): ParsedCvData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { skills: [], qualifications: [], languages: [] };
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { skills: [], qualifications: [], languages: [] };
  }

  const obj = raw as Record<string, unknown>;

  const asStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  const asOptionalString = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;

  const asOptionalNumber = (v: unknown): number | undefined => {
    if (typeof v === "number" && isFinite(v) && v >= 0) return Math.round(v);
    if (typeof v === "string") {
      const n = parseFloat(v);
      if (isFinite(n) && n >= 0) return Math.round(n);
    }
    return undefined;
  };

  return {
    currentRoleTitle: asOptionalString(obj.currentRoleTitle),
    yearsExperience: asOptionalNumber(obj.yearsExperience),
    skills: asStringArray(obj.skills),
    qualifications: asStringArray(obj.qualifications),
    industrySector: asOptionalString(obj.industrySector),
    languages: asStringArray(obj.languages),
  };
}

// ---------------------------------------------------------------------------
// Claude API call
// ---------------------------------------------------------------------------

const CV_PARSE_PROMPT = `Extract structured information from this CV and return it as a single JSON object with exactly these keys:
- "currentRoleTitle": string — the candidate's most recent job title
- "yearsExperience": number — total years of professional experience (estimate if not stated)
- "skills": array of strings — technical and professional skills listed or evident in the CV
- "qualifications": array of strings — academic degrees, certifications, and professional qualifications
- "industrySector": string — the primary industry sector (e.g. "Financial Technology", "Healthcare", "Software Engineering")
- "languages": array of strings — spoken/written languages

Return only the JSON object, no markdown, no explanation.`;

async function callClaude(
  pdfBase64: string,
  apiKey: string,
): Promise<ParsedCvData> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            {
              type: "text",
              text: CV_PARSE_PROMPT,
            },
          ],
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
  return parseClaudeResponse(text);
}

// ---------------------------------------------------------------------------
// Exported action
// ---------------------------------------------------------------------------

export const parseCv = action({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; error?: string }> => {
    // --- 1. Auth ---
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated." });
    }

    // --- 2. Load profile ---
    const profile = await ctx.runQuery(internal.profiles._getProfileForUser, { userId });

    if (!profile) {
      return { ok: false, error: "No profile found. Upload a CV first." };
    }

    if (!profile.cvFileId) {
      return { ok: false, error: "No CV uploaded yet." };
    }

    // --- 3. Read file from storage ---
    const blob: Blob | null = await ctx.storage.get(profile.cvFileId);
    if (!blob) {
      await ctx.runMutation(internal.profiles._recordEvent, {
        userId,
        type: "cv_parse_error",
        payload: { code: "FILE_NOT_FOUND", cvFileId: profile.cvFileId },
      });
      return { ok: false, error: "Uploaded CV file not found in storage." };
    }

    // --- 4. Guard: PDF only ---
    const contentType = blob.type ?? "";
    if (contentType !== "application/pdf") {
      await ctx.runMutation(internal.profiles._recordEvent, {
        userId,
        type: "cv_parse_error",
        payload: { code: "UNSUPPORTED_FORMAT", contentType },
      });
      return {
        ok: false,
        error: "Only PDF files can be parsed automatically. Please re-upload as a PDF.",
      };
    }

    // --- 5. Call Claude ---
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.profiles._recordEvent, {
        userId,
        type: "cv_parse_error",
        payload: { code: "MISSING_ENV", message: "ANTHROPIC_API_KEY not set" },
      });
      return { ok: false, error: "CV parsing is not configured." };
    }

    let parsed: ParsedCvData;
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      parsed = await callClaude(base64, apiKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.profiles._recordEvent, {
        userId,
        type: "cv_parse_error",
        payload: { code: "CLAUDE_ERROR", message },
      });
      return { ok: false, error: "CV parsing failed. Please try again." };
    }

    // --- 6. Persist ---
    await ctx.runMutation(internal.profiles._applyParsedCv, {
      profileId: profile._id,
      data: parsed,
    });

    await ctx.runMutation(internal.profiles._recordEvent, {
      userId,
      type: "cv_parsed",
      payload: {
        skills: parsed.skills.length,
        qualifications: parsed.qualifications.length,
        languages: parsed.languages.length,
      },
    });

    return { ok: true };
  },
});

