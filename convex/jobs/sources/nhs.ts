/**
 * NHS Jobs XML API adapter
 *
 * Endpoint: https://www.jobs.nhs.uk/api/v1/search_xml
 * Auth: none (public API)
 *
 * Runs three keyword searches in parallel (visa sponsorship, certificate of
 * sponsorship, skilled worker visa), paginates each up to RESULTS_CAP, then
 * deduplicates by NHS job ID.
 *
 * All NHS employers are public-sector bodies. None are recruitment agencies.
 */

import type { RawJob } from "../types";

const BASE_URL = "https://www.jobs.nhs.uk/api/v1/search_xml";
const PAGE_SIZE = 100; // one page per keyword — keeps action well within timeout

const KEYWORDS = [
  "visa sponsorship",
  "certificate of sponsorship",
  "skilled worker visa",
];

// ---------------------------------------------------------------------------
// XML parsing helpers (no external dependency)
// ---------------------------------------------------------------------------

/** Extract the text content of the first matching tag. */
function tag(xml: string, name: string): string {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

/** Extract all <vacancyDetails> blocks from a full API response. */
function extractVacancies(xml: string): string[] {
  const blocks: string[] = [];
  const re = /<vacancyDetails>([\s\S]*?)<\/vacancyDetails>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    blocks.push(m[1]);
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Salary parsing
// "£25,760.00 to £27,476.00" → { min: 25760, max: 27476 }
// "£25,272.00"                → { min: 25272 }
// "Depending on experience"   → {}
// ---------------------------------------------------------------------------

function parseSalary(raw: string): { min?: number; max?: number } {
  const nums = [...raw.matchAll(/£([\d,]+(?:\.\d+)?)/g)]
    .map((m) => parseFloat(m[1].replace(/,/g, "")))
    .filter((n) => !isNaN(n) && n > 0);

  if (nums.length === 0) return {};
  if (nums.length === 1) return { min: Math.round(nums[0]) };
  return { min: Math.round(nums[0]), max: Math.round(nums[1]) };
}

// ---------------------------------------------------------------------------
// Convert a <vacancyDetails> block to RawJob
// ---------------------------------------------------------------------------

function toRawJob(block: string): RawJob | null {
  const id = tag(block, "id");
  const title = tag(block, "title");
  const applyUrl = tag(block, "url");

  if (!id || !title || !applyUrl) return null;

  const salary = parseSalary(tag(block, "salary"));
  const postDateStr = tag(block, "postDate");
  const postedAt = postDateStr ? new Date(postDateStr).getTime() : Date.now();

  // First <location> inside <locations>
  const locationsBlock = tag(block, "locations");
  const location = tag(locationsBlock, "location") || "United Kingdom";

  return {
    externalId: id,
    source: "nhs",
    title: title,
    company: tag(block, "employer") || "NHS",
    location,
    description: tag(block, "description"),
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryCurrency: "GBP",
    salaryPeriod: "year",
    postedAt: isNaN(postedAt) ? Date.now() : postedAt,
    applyUrl,
    isAgency: false,
    explicit: true,
  };
}

// ---------------------------------------------------------------------------
// Fetch one page for one keyword
// ---------------------------------------------------------------------------

async function fetchKeyword(keyword: string): Promise<RawJob[]> {
  const params = new URLSearchParams({
    keyword,
    limit: String(PAGE_SIZE),
    sort: "publicationDateDesc",
  });

  const res = await fetch(`${BASE_URL}?${params}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Tino/1.0; +https://tiino.app)",
      "Accept": "application/xml, text/xml",
      "Accept-Language": "en-GB,en;q=0.9",
    },
  });

  if (!res.ok) {
    throw new Error(`NHS Jobs XML API error (HTTP ${res.status}) for keyword "${keyword}"`);
  }

  const xml = await res.text();
  const jobs: RawJob[] = [];
  for (const block of extractVacancies(xml)) {
    const job = toRawJob(block);
    if (job) jobs.push(job);
  }
  return jobs;
}

// ---------------------------------------------------------------------------
// Public adapter function
// ---------------------------------------------------------------------------

export async function fetchNhsJobs(): Promise<RawJob[]> {
  const results = await Promise.all(KEYWORDS.map((kw) => fetchKeyword(kw)));

  // Deduplicate by externalId across all keyword searches
  const seen = new Set<string>();
  const jobs: RawJob[] = [];
  for (const batch of results) {
    for (const job of batch) {
      if (!seen.has(job.externalId)) {
        seen.add(job.externalId);
        jobs.push(job);
      }
    }
  }

  return jobs;
}
