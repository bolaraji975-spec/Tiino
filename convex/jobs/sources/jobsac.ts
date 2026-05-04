/**
 * jobs.ac.uk RSS feed adapter
 *
 * Feed URL: https://www.jobs.ac.uk/search/?keywords=&sort=date&rss=1
 *
 * Auth: none (public RSS)
 * Format: RSS 2.0 with CDATA content
 *
 * jobs.ac.uk lists academic, research, and professional services roles at
 * UK universities and research institutions — all legitimate Skilled Worker
 * sponsor licence holders.
 */

import type { RawJob } from "../types";

const FEED_BASE = "https://www.jobs.ac.uk/search/";

// We fetch a few topic-focused feeds to increase coverage
const FEED_QUERIES = [
  { keywords: "",               label: "all" },
  { keywords: "software",       label: "software" },
  { keywords: "data+science",   label: "data" },
  { keywords: "research",       label: "research" },
];

// ---------------------------------------------------------------------------
// Minimal RSS parser (shared pattern — same as civilservice.ts)
// ---------------------------------------------------------------------------

function extractTag(xml: string, tag: string): string {
  const pattern = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))<\\/${tag}>`,
    "i",
  );
  const m = xml.match(pattern);
  if (!m) return "";
  return (m[1] ?? m[2] ?? "").trim();
}

function parseRssItems(xml: string): Array<{
  title: string;
  link: string;
  description: string;
  pubDate?: string;
  author?: string;
  guid?: string;
}> {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    items.push({
      title: extractTag(block, "title"),
      link: extractTag(block, "link"),
      description: extractTag(block, "description"),
      pubDate: extractTag(block, "pubDate") || undefined,
      author: extractTag(block, "author") || extractTag(block, "dc:creator") || undefined,
      guid: extractTag(block, "guid") || undefined,
    });
  }

  return items;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSalaryFromText(text: string): { min?: number; max?: number } {
  const m = text.match(/£([\d,]+)\s*(?:[-–to]+\s*£([\d,]+))?/i);
  if (!m) return {};
  const parse = (s: string) => parseInt(s.replace(/,/g, ""), 10);
  return { min: parse(m[1]), max: m[2] ? parse(m[2]) : undefined };
}

/** Extract institution name from jobs.ac.uk description or author field */
function extractInstitution(item: {
  author?: string;
  description: string;
  title: string;
}): string {
  if (item.author && item.author.length > 0) return item.author;
  // jobs.ac.uk often includes "Organisation: X" in the description
  const orgMatch = item.description.match(/(?:organisation|employer|institution):?\s*([^\n,<]+)/i);
  if (orgMatch) return orgMatch[1].trim();
  return "University / Research Institution";
}

/** Extract location from description if available */
function extractLocation(description: string): string {
  const locMatch = description.match(/(?:location|based in|based at):?\s*([^\n,<]+)/i);
  if (locMatch) return locMatch[1].trim();
  return "United Kingdom";
}

function externalId(item: { guid?: string; link: string }): string {
  if (item.guid) return item.guid.replace(/\s+/g, "");
  const m = item.link.match(/[?&](?:id|job_id|ref)=([^&]+)/i);
  if (m) return `jac_${m[1]}`;
  const parts = item.link.replace(/\/$/, "").split("/");
  return `jac_${parts[parts.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Public adapter function
// ---------------------------------------------------------------------------

export async function fetchJobsAc(): Promise<RawJob[]> {
  const seen = new Set<string>();
  const jobs: RawJob[] = [];

  for (const query of FEED_QUERIES) {
    const params = new URLSearchParams({
      keywords: query.keywords,
      sort: "date",
      rss: "1",
    });

    let res: Response;
    try {
      res = await fetch(`${FEED_BASE}?${params}`, {
        headers: { Accept: "application/rss+xml, application/xml, text/xml" },
      });
    } catch {
      // Network error on one feed shouldn't abort the whole run
      continue;
    }

    if (!res.ok) continue;

    const xml = await res.text();
    const items = parseRssItems(xml);

    for (const item of items) {
      if (!item.title || !item.link) continue;

      const id = externalId(item);
      if (seen.has(id)) continue;
      seen.add(id);

      const desc = stripHtml(item.description);
      const salary = parseSalaryFromText(desc);
      const postedAt = item.pubDate
        ? new Date(item.pubDate).getTime()
        : Date.now();

      jobs.push({
        externalId: id,
        source: "jobs_ac",
        title: item.title.trim(),
        company: extractInstitution({ ...item, description: desc }),
        location: extractLocation(desc),
        description: desc,
        salaryMin: salary.min,
        salaryMax: salary.max,
        salaryCurrency: "GBP",
        salaryPeriod: "year",
        postedAt,
        applyUrl: item.link,
        isAgency: false,
      });
    }
  }

  return jobs;
}
