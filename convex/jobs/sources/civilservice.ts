/**
 * Civil Service Jobs RSS feed adapter
 *
 * Feed URL: https://www.civilservicejobs.service.gov.uk/csr/jobs.cgi
 *   ?action=search&type=search&display=100&format=rss
 *
 * Auth: none (public feed)
 * Format: RSS 2.0 with CDATA-wrapped descriptions
 *
 * Civil Service employers are government bodies — never recruitment agencies,
 * always eligible to sponsor via the Home Office register.
 */

import type { RawJob } from "../types";

const FEED_URL =
  "https://www.civilservicejobs.service.gov.uk/csr/jobs.cgi" +
  "?action=search&type=search&display=100&format=rss";

// ---------------------------------------------------------------------------
// Minimal RSS parser (no external dependencies)
// ---------------------------------------------------------------------------

type RssItem = {
  title: string;
  link: string;
  description: string;
  pubDate?: string;
  author?: string;
  guid?: string;
};

/** Extract text from a tag, handling CDATA and plain text */
function extractTag(xml: string, tag: string): string {
  const pattern = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))<\\/${tag}>`,
    "i",
  );
  const m = xml.match(pattern);
  if (!m) return "";
  return (m[1] ?? m[2] ?? "").trim();
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
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

/** Strip HTML tags and decode basic entities */
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

/** Extract department/company name from Civil Service job title or description */
function extractDepartment(item: RssItem): string {
  // Civil Service RSS items often have "Title - Department" format
  const dashIdx = item.title.lastIndexOf(" - ");
  if (dashIdx > 0) return item.title.slice(dashIdx + 3).trim();
  return item.author ?? "Civil Service";
}

function extractTitle(item: RssItem): string {
  const dashIdx = item.title.lastIndexOf(" - ");
  if (dashIdx > 0) return item.title.slice(0, dashIdx).trim();
  return item.title.trim();
}

/** Parse a salary string like "£30,000 - £40,000" → { min, max } */
function parseSalaryFromText(text: string): { min?: number; max?: number } {
  const pattern = /£([\d,]+)\s*(?:[-–to]+\s*£([\d,]+))?/i;
  const m = text.match(pattern);
  if (!m) return {};
  const parse = (s: string) => parseInt(s.replace(/,/g, ""), 10);
  return {
    min: parse(m[1]),
    max: m[2] ? parse(m[2]) : undefined,
  };
}

function externalId(item: RssItem): string {
  // Use guid if present, otherwise hash the link
  if (item.guid) return item.guid.replace(/\s+/g, "");
  // Extract job reference from URL query string if present
  const m = item.link.match(/[?&](?:jcode|id|ref)=([^&]+)/i);
  if (m) return `cs_${m[1]}`;
  // Fallback: last segment of URL
  const parts = item.link.replace(/\/$/, "").split("/");
  return `cs_${parts[parts.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Public adapter function
// ---------------------------------------------------------------------------

export async function fetchCivilServiceJobs(): Promise<RawJob[]> {
  const res = await fetch(FEED_URL, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
  });

  if (!res.ok) {
    throw new Error(`Civil Service Jobs RSS error (HTTP ${res.status})`);
  }

  const xml = await res.text();
  const items = parseRssItems(xml);
  const jobs: RawJob[] = [];

  for (const item of items) {
    if (!item.title || !item.link) continue;

    const desc = stripHtml(item.description);
    const salary = parseSalaryFromText(desc);
    const postedAt = item.pubDate
      ? new Date(item.pubDate).getTime()
      : Date.now();

    jobs.push({
      externalId: externalId(item),
      source: "civil_service",
      title: extractTitle(item),
      company: extractDepartment(item),
      location: "United Kingdom", // refined in normaliseJob
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

  return jobs;
}
