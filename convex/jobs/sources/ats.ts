/**
 * ats.ts — Universal ATS job fetcher
 *
 * Takes a company name + careers URL, detects the ATS platform via
 * detectAts(), fetches job listings from the platform's public API,
 * and normalises them into RawJob[].
 *
 * Supported: Greenhouse, Lever, Workable, SmartRecruiters, Recruitee,
 *            Ashby, Breezy
 *
 * Returns [] if:
 *   - No ATS pattern matches the URL
 *   - The fetch fails (network error, 404, etc.)
 *   - The response shape is unexpected
 *
 * All returned jobs are marked explicit: true — callers should only pass
 * companies that are confirmed UKVI sponsor licence holders.
 */

import type { RawJob } from "../types";
import { detectAts, type AtsName } from "../../lib/detectAts";

// ---------------------------------------------------------------------------
// HTML stripper (shared)
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Per-ATS response parsers
// ---------------------------------------------------------------------------

function parseGreenhouse(
  data: unknown,
  company: string,
  apiUrl: string,
): RawJob[] {
  const body = data as { jobs?: unknown[] };
  if (!Array.isArray(body?.jobs)) return [];

  return body.jobs
    .filter((j): j is Record<string, unknown> => j !== null && typeof j === "object")
    .map((j): RawJob | null => {
      const id = j.id;
      const title = typeof j.title === "string" ? j.title : null;
      if (!id || !title) return null;
      const loc = j.location as { name?: string } | undefined;
      const content = typeof j.content === "string" ? stripHtml(j.content) : "";
      const updatedAt = typeof j.updated_at === "string" ? Date.parse(j.updated_at) : NaN;
      return {
        externalId: String(id),
        source: "greenhouse",
        title,
        company,
        location: loc?.name ?? "United Kingdom",
        description: content,
        postedAt: isNaN(updatedAt) ? Date.now() : updatedAt,
        applyUrl: typeof j.absolute_url === "string" ? j.absolute_url : apiUrl,
        isAgency: false,
        explicit: true,
      };
    })
    .filter((j): j is RawJob => j !== null);
}

function parseLever(
  data: unknown,
  company: string,
  apiUrl: string,
): RawJob[] {
  if (!Array.isArray(data)) return [];

  return data
    .filter((p): p is Record<string, unknown> => p !== null && typeof p === "object")
    .map((p): RawJob | null => {
      const id = typeof p.id === "string" ? p.id : null;
      const title = typeof p.text === "string" ? p.text : null;
      if (!id || !title) return null;
      const categories = p.categories as { location?: string } | undefined;
      const desc = typeof p.descriptionPlain === "string"
        ? stripHtml(p.descriptionPlain)
        : "";
      const createdAt = typeof p.createdAt === "number" ? p.createdAt : Date.now();
      return {
        externalId: id,
        source: "lever",
        title,
        company,
        location: categories?.location ?? "United Kingdom",
        description: desc,
        postedAt: createdAt,
        applyUrl: typeof p.hostedUrl === "string" ? p.hostedUrl : apiUrl,
        isAgency: false,
        explicit: true,
      };
    })
    .filter((j): j is RawJob => j !== null);
}

function parseWorkable(
  data: unknown,
  company: string,
  apiUrl: string,
): RawJob[] {
  const body = data as { results?: unknown[] };
  if (!Array.isArray(body?.results)) return [];

  return body.results
    .filter((j): j is Record<string, unknown> => j !== null && typeof j === "object")
    .map((j): RawJob | null => {
      const id = typeof j.shortcode === "string" ? j.shortcode : null;
      const title = typeof j.title === "string" ? j.title : null;
      if (!id || !title) return null;
      const loc = j.location as { city?: string; country?: string } | undefined;
      const desc = typeof j.description === "string" ? stripHtml(j.description) : "";
      const publishedOn = typeof j.published_on === "string"
        ? Date.parse(j.published_on)
        : NaN;
      return {
        externalId: id,
        source: "workable",
        title,
        company,
        location: loc?.city ?? loc?.country ?? "United Kingdom",
        description: desc,
        postedAt: isNaN(publishedOn) ? Date.now() : publishedOn,
        applyUrl: typeof j.url === "string" ? j.url : apiUrl,
        isAgency: false,
        explicit: true,
      };
    })
    .filter((j): j is RawJob => j !== null);
}

function parseSmartRecruiters(
  data: unknown,
  company: string,
  apiUrl: string,
): RawJob[] {
  const body = data as { content?: unknown[] };
  if (!Array.isArray(body?.content)) return [];

  return body.content
    .filter((j): j is Record<string, unknown> => j !== null && typeof j === "object")
    .map((j): RawJob | null => {
      const id = typeof j.id === "string" ? j.id : null;
      const title = typeof j.name === "string" ? j.name : null;
      if (!id || !title) return null;
      const loc = j.location as { city?: string; country?: { code?: string } } | undefined;
      const city = loc?.city ?? loc?.country?.code ?? "United Kingdom";
      const relPath = typeof j.relativeUri === "string" ? j.relativeUri : "";
      const applyUrl = relPath
        ? `https://careers.smartrecruiters.com${relPath}`
        : apiUrl;
      return {
        externalId: id,
        source: "smartrecruiters",
        title,
        company,
        location: city,
        description: "",
        postedAt: Date.now(),
        applyUrl,
        isAgency: false,
        explicit: true,
      };
    })
    .filter((j): j is RawJob => j !== null);
}

function parseRecruitee(
  data: unknown,
  company: string,
  apiUrl: string,
): RawJob[] {
  const body = data as { offers?: unknown[] };
  const offers = Array.isArray(body?.offers) ? body.offers : (Array.isArray(data) ? data : []);

  return (offers as unknown[])
    .filter((j): j is Record<string, unknown> => j !== null && typeof j === "object")
    .map((j): RawJob | null => {
      const id = j.id !== undefined ? String(j.id) : null;
      const title = typeof j.title === "string" ? j.title : null;
      if (!id || !title) return null;
      const location = typeof j.city === "string" ? j.city : "United Kingdom";
      const desc = typeof j.description === "string" ? stripHtml(j.description) : "";
      return {
        externalId: id,
        source: "recruitee",
        title,
        company,
        location,
        description: desc,
        postedAt: Date.now(),
        applyUrl: typeof j.careers_url === "string" ? j.careers_url : apiUrl,
        isAgency: false,
        explicit: true,
      };
    })
    .filter((j): j is RawJob => j !== null);
}

function parseAshby(
  data: unknown,
  company: string,
  apiUrl: string,
): RawJob[] {
  const body = data as { jobPostings?: unknown[] };
  if (!Array.isArray(body?.jobPostings)) return [];

  return body.jobPostings
    .filter((j): j is Record<string, unknown> => j !== null && typeof j === "object")
    .map((j): RawJob | null => {
      const id = typeof j.id === "string" ? j.id : null;
      const title = typeof j.title === "string" ? j.title : null;
      if (!id || !title) return null;
      const loc = j.primaryLocation as { city?: string; region?: string } | undefined;
      const location = loc?.city ?? loc?.region ?? "United Kingdom";
      return {
        externalId: id,
        source: "ashby",
        title,
        company,
        location,
        description: "",
        postedAt: Date.now(),
        applyUrl: typeof j.jobUrl === "string" ? j.jobUrl : apiUrl,
        isAgency: false,
        explicit: true,
      };
    })
    .filter((j): j is RawJob => j !== null);
}

function parseBreezy(
  data: unknown,
  company: string,
  apiUrl: string,
): RawJob[] {
  if (!Array.isArray(data)) return [];

  return (data as unknown[])
    .filter((j): j is Record<string, unknown> => j !== null && typeof j === "object")
    .map((j): RawJob | null => {
      const id = typeof j.id === "string" ? j.id : null;
      const title = typeof j.name === "string" ? j.name : null;
      if (!id || !title) return null;
      const loc = j.location as { country?: { name?: string }; city?: string } | undefined;
      const location = loc?.city ?? loc?.country?.name ?? "United Kingdom";
      return {
        externalId: id,
        source: "breezy",
        title,
        company,
        location,
        description: "",
        postedAt: Date.now(),
        applyUrl: typeof j.url === "string" ? j.url : apiUrl,
        isAgency: false,
        explicit: true,
      };
    })
    .filter((j): j is RawJob => j !== null);
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

function parseByAts(
  ats: AtsName,
  data: unknown,
  company: string,
  apiUrl: string,
): RawJob[] {
  switch (ats) {
    case "greenhouse":     return parseGreenhouse(data, company, apiUrl);
    case "lever":         return parseLever(data, company, apiUrl);
    case "workable":      return parseWorkable(data, company, apiUrl);
    case "smartrecruiters": return parseSmartRecruiters(data, company, apiUrl);
    case "recruitee":     return parseRecruitee(data, company, apiUrl);
    case "ashby":         return parseAshby(data, company, apiUrl);
    case "breezy":        return parseBreezy(data, company, apiUrl);
    default:              return [];
  }
}

// ---------------------------------------------------------------------------
// Fetch helpers per ATS (some need POST, most need GET)
// ---------------------------------------------------------------------------

const WORKABLE_BODY = JSON.stringify({
  query: "",
  location: [],
  department: [],
  worktype: [],
  remote: [],
});

async function fetchApi(ats: AtsName, apiUrl: string): Promise<unknown> {
  const isPost = ats === "workable";
  const res = await fetch(apiUrl, {
    method: isPost ? "POST" : "GET",
    headers: {
      Accept: "application/json",
      ...(isPost ? { "Content-Type": "application/json" } : {}),
    },
    ...(isPost ? { body: WORKABLE_BODY } : {}),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

/**
 * Fetch jobs for a single company given its careers URL.
 * Returns [] on any error — callers should treat failures as non-fatal.
 */
export async function fetchAtsJobs(
  companyName: string,
  careersUrl: string,
): Promise<RawJob[]> {
  const match = detectAts(careersUrl);
  if (!match) return [];

  try {
    const data = await fetchApi(match.ats, match.apiUrl);
    return parseByAts(match.ats, data, companyName, match.apiUrl);
  } catch (err) {
    console.error(
      `ATS fetch failed for ${companyName} (${match.ats} / ${match.apiUrl}): ${String(err)}`,
    );
    return [];
  }
}
