/**
 * applications/generate.ts — "use node" action
 *
 * generateApplication: tailors a CV + cover letter for a specific job using
 * Claude Sonnet. Enforces plan gates, caches within 24 h, runs a hallucination
 * check, and stores the result on the applications row.
 *
 * Pure helpers (parseGeneratedCvResponse, detectHallucinations,
 * buildTailoringPrompt) are exported for unit testing.
 */

"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { canGenerateCv, cvBlockReason } from "../lib/planGates";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 4000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type GeneratedCvExperience = {
  title: string;
  company: string;
  startDate: string;
  endDate: string;
  bullets: string[];
};

export type GeneratedCvEducation = {
  degree: string;
  institution: string;
  year: string;
};

export type GeneratedCv = {
  name: string;
  email: string;
  phone?: string;
  summary: string;
  experience: GeneratedCvExperience[];
  skills: string[];
  education: GeneratedCvEducation[];
  coverLetter: string;
};

// ---------------------------------------------------------------------------
// Pure helpers — exported for unit tests
// ---------------------------------------------------------------------------

/** Parse Claude's JSON response into a GeneratedCv, returning null on failure. */
export function parseGeneratedCvResponse(text: string): GeneratedCv | null {
  // Strip possible markdown code fences
  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  let raw: unknown;
  try {
    raw = JSON.parse(stripped);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;

  const obj = raw as Record<string, unknown>;

  const str = (v: unknown, fallback = ""): string =>
    typeof v === "string" ? v.trim() : fallback;

  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  const experience: GeneratedCvExperience[] = Array.isArray(obj.experience)
    ? (obj.experience as unknown[]).flatMap((item) => {
        if (typeof item !== "object" || item === null) return [];
        const e = item as Record<string, unknown>;
        return [{
          title: str(e.title),
          company: str(e.company),
          startDate: str(e.startDate),
          endDate: str(e.endDate),
          bullets: strArr(e.bullets).slice(0, 5),
        }];
      })
    : [];

  const education: GeneratedCvEducation[] = Array.isArray(obj.education)
    ? (obj.education as unknown[]).flatMap((item) => {
        if (typeof item !== "object" || item === null) return [];
        const e = item as Record<string, unknown>;
        return [{
          degree: str(e.degree),
          institution: str(e.institution),
          year: str(e.year),
        }];
      })
    : [];

  const name = str(obj.name);
  const email = str(obj.email);
  if (!name || !email) return null;

  return {
    name,
    email,
    ...(typeof obj.phone === "string" && obj.phone.trim() ? { phone: obj.phone.trim() } : {}),
    summary: str(obj.summary),
    experience,
    skills: strArr(obj.skills),
    education,
    coverLetter: str(obj.coverLetter),
  };
}

/**
 * Checks for hallucinated content in the generated CV.
 * Returns a list of suspect values (empty array = clean).
 *
 * Strategy: each employer and institution in the output must appear
 * (case-insensitive) somewhere in the raw PDF text or source qualifications.
 * We use the first significant word (>4 chars) to tolerate abbreviation
 * differences (e.g. "Ltd" vs "Limited").
 */
export function detectHallucinations(
  cv: GeneratedCv,
  sourcePdfText: string,
  sourceQualifications: string[],
): string[] {
  const haystack = sourcePdfText.toLowerCase();
  const qualHaystack = sourceQualifications.join(" ").toLowerCase();
  const hallucinated: string[] = [];

  const appearsInSource = (name: string): boolean => {
    if (!name) return true; // can't check empty — pass
    // Use the last word longer than 4 chars as the anchor — it is typically the
    // most distinctive part (e.g. "Birmingham" not "University")
    const anchor = [...name.split(/\s+/)]
      .reverse()
      .find((w) => w.replace(/[^a-z0-9]/gi, "").length > 4)
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (!anchor) return true;
    return haystack.includes(anchor) || qualHaystack.includes(anchor);
  };

  for (const exp of cv.experience) {
    if (!appearsInSource(exp.company)) {
      hallucinated.push(`employer: ${exp.company}`);
    }
  }

  for (const edu of cv.education) {
    if (!appearsInSource(edu.institution)) {
      hallucinated.push(`institution: ${edu.institution}`);
    }
  }

  // Name sanity check
  if (cv.name && !appearsInSource(cv.name.split(" ")[0])) {
    hallucinated.push(`name: ${cv.name}`);
  }

  return hallucinated;
}

/** Build the user-turn prompt text for the Claude API call. */
export function buildTailoringPrompt(
  profile: { skills: string[]; qualifications: string[]; currentRoleTitle?: string },
  job: { title: string; company: string; description: string },
  strict = false,
): string {
  const strictWarning = strict
    ? `\nCRITICAL: Use ONLY the employer names, job titles, dates, and qualifications that appear verbatim in the attached CV. Do NOT add, modify, or invent any employer, company, institution, date, or qualification.\n`
    : "";

  return `${strictWarning}The candidate's CV is attached as a PDF document.

Please write a tailored CV and cover letter for the following role:

Job Title: ${job.title}
Company: ${job.company}
Job Description:
${job.description.slice(0, 3000)}

Candidate's known skills (for reference): ${profile.skills.slice(0, 20).join(", ")}
Candidate's qualifications (for reference): ${profile.qualifications.slice(0, 10).join(", ")}

Return a single JSON object with EXACTLY this structure (no markdown, no extra text):
{
  "name": "candidate full name from CV",
  "email": "candidate email from CV",
  "phone": "candidate phone if present",
  "summary": "2-3 sentences tailored to this specific job and company",
  "experience": [
    {
      "title": "job title",
      "company": "employer name",
      "startDate": "e.g. Jan 2021",
      "endDate": "e.g. Mar 2024 or Present",
      "bullets": ["3-5 achievement bullets rewritten to emphasise relevance to this role"]
    }
  ],
  "skills": ["skills reordered so job-relevant skills appear first"],
  "education": [
    {
      "degree": "degree name",
      "institution": "university or institution name",
      "year": "graduation year"
    }
  ],
  "coverLetter": "200-280 word cover letter specific to this job and company"
}`;
}

// ---------------------------------------------------------------------------
// PDF text extraction (best-effort, covers most text-based PDFs)
// ---------------------------------------------------------------------------

function extractPdfText(bytes: ArrayBuffer): string {
  // Decode as latin-1 to preserve byte values
  const raw = Buffer.from(bytes).toString("latin1");
  // Extract text operands from Tj and TJ operators
  const tjMatches = [...raw.matchAll(/\(([^)]{1,500})\)\s*Tj/g)].map((m) => m[1]);
  const tjArrMatches = [...raw.matchAll(/\[([^\]]+)\]\s*TJ/g)].map((m) => {
    const inner = m[1];
    return [...inner.matchAll(/\(([^)]{1,200})\)/g)].map((n) => n[1]).join(" ");
  });
  return [...tjMatches, ...tjArrMatches].join(" ");
}

// ---------------------------------------------------------------------------
// Claude API call
// ---------------------------------------------------------------------------

async function callClaude(
  pdfBase64: string,
  promptText: string,
  apiKey: string,
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system:
        "You are an expert UK CV writer specialising in visa sponsorship roles. " +
        "You tailor CVs to specific job descriptions while preserving complete " +
        "accuracy — never inventing employers, qualifications, or dates. " +
        "Respond with valid JSON only.",
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
            { type: "text", text: promptText },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude API error ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  return data.content?.find((c) => c.type === "text")?.text ?? "{}";
}

// ---------------------------------------------------------------------------
// Public action
// ---------------------------------------------------------------------------

export const generateApplication = action({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }): Promise<{
    applicationId: string;
    generatedCv: GeneratedCv;
    fromCache: boolean;
  }> => {
    // --- 1. Auth ---
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated." });
    }

    // --- 2. Load user, profile, job, and existing application in parallel ---
    const [user, profile, job, existingApplication, cvGenerationsThisMonth] =
      await Promise.all([
        ctx.runQuery(internal.users._getUserById, { userId }),
        ctx.runQuery(internal.profiles._getProfileForUser, { userId }),
        ctx.runQuery(internal.jobs.queries._getJobForGenerate, { jobId }),
        ctx.runQuery(internal.applications.mutations._getApplicationForUserJob, {
          userId,
          jobId,
        }),
        ctx.runQuery(internal.applications.mutations._getCvGenerationsThisMonth, {
          userId,
        }),
      ]);

    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found." });
    }
    if (!job) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Job not found." });
    }

    // --- 3. Plan gate ---
    const planData = {
      plan: user.plan,
      payPerCvCredits: user.payPerCvCredits,
      cvGenerationsThisMonth,
    };
    if (!canGenerateCv(planData)) {
      throw new ConvexError({
        code: "UPGRADE_REQUIRED",
        message: cvBlockReason(planData) ?? "CV generation limit reached.",
      });
    }

    // --- 4. Cache check: same (userId, jobId) generated within 24 h ---
    if (existingApplication?.generatedCvData) {
      const lastGen = [...(existingApplication.stageHistory ?? [])]
        .reverse()
        .find((h) => h.stage === "cv_generated");
      if (lastGen && Date.now() - lastGen.at < CACHE_TTL_MS) {
        return {
          applicationId: existingApplication._id,
          generatedCv: existingApplication.generatedCvData as GeneratedCv,
          fromCache: true,
        };
      }
    }

    // --- 5. Profile and CV file checks ---
    if (!profile) {
      throw new ConvexError({
        code: "PRECONDITION",
        message: "No profile found. Upload a CV first.",
      });
    }
    if (!profile.cvFileId) {
      throw new ConvexError({
        code: "PRECONDITION",
        message: "No CV uploaded yet. Upload a CV before generating.",
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new ConvexError({ code: "MISSING_ENV", message: "ANTHROPIC_API_KEY not set." });
    }

    // --- 6. Read CV PDF from storage ---
    const blob = await ctx.storage.get(profile.cvFileId);
    if (!blob) {
      throw new ConvexError({ code: "NOT_FOUND", message: "CV file not found in storage." });
    }

    const arrayBuffer = await blob.arrayBuffer();
    const pdfBase64 = Buffer.from(arrayBuffer).toString("base64");
    const pdfText = extractPdfText(arrayBuffer);

    // --- 7. First Claude call ---
    const promptText = buildTailoringPrompt(
      {
        skills: profile.skills,
        qualifications: profile.qualifications,
        currentRoleTitle: profile.currentRoleTitle,
      },
      { title: job.title, company: job.company, description: job.description },
    );

    let rawText = await callClaude(pdfBase64, promptText, apiKey);
    let generatedCv = parseGeneratedCvResponse(rawText);

    if (!generatedCv) {
      throw new ConvexError({
        code: "PARSE_ERROR",
        message: "CV generation produced invalid output. Please try again.",
      });
    }

    // --- 8. Hallucination check → regenerate once with stricter prompt ---
    const suspects = detectHallucinations(generatedCv, pdfText, profile.qualifications);
    if (suspects.length > 0) {
      const strictPrompt = buildTailoringPrompt(
        {
          skills: profile.skills,
          qualifications: profile.qualifications,
          currentRoleTitle: profile.currentRoleTitle,
        },
        { title: job.title, company: job.company, description: job.description },
        true, // strict mode
      );
      rawText = await callClaude(pdfBase64, strictPrompt, apiKey);
      const retry = parseGeneratedCvResponse(rawText);
      if (retry) generatedCv = retry;
    }

    // --- 9. Persist to applications table ---
    const applicationId = await ctx.runMutation(
      internal.applications.mutations._upsertApplicationCv,
      {
        userId,
        jobId,
        generatedCvData: generatedCv,
        scoreAtApply: job.sponsorshipScore,
      },
    );

    // --- 10. Record event + deduct credit ---
    await ctx.runMutation(internal.profiles._recordEvent, {
      userId,
      type: "cv_generated",
      payload: {
        jobId,
        jobTitle: job.title,
        company: job.company,
        hallucinationSuspectsFound: suspects.length,
      },
    });

    // Deduct one pay-per-CV credit if that's how this generation was permitted
    const isPro = user.plan === "pro_monthly" || user.plan === "pro_annual";
    if (!isPro && user.payPerCvCredits > 0) {
      await ctx.runMutation(internal.users._decrementCvCredits, { userId });
    }

    return { applicationId, generatedCv, fromCache: false };
  },
});
