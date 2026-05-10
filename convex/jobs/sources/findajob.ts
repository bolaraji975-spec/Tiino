/**
 * GOV.UK Find a Job (DWP) RSS adapter
 *
 * Fetches two RSS feeds:
 *   - "visa sponsorship" keyword search
 *   - "certificate of sponsorship" keyword search
 *
 * XML is parsed manually (no external library) via regex extraction of
 * RSS <item> elements.
 *
 * All results are marked explicit: true since we only search for
 * sponsorship-specific keywords.
 */

import type { RawJob } from "../types";

const FEEDS = [
  "https://findajob.dwp.gov.uk/search.rss?q=visa+sponsorship&sb=pd&sd=down",
  "https://findajob.dwp.gov.uk/search.rss?q=certificate+of+sponsorship&sb=pd&sd=down",
];

// ---------------------------------------------------------------------------
// RSS XML parsing helpers (no external dependency)
// ---------------------------------------------------------------------------

function extractField(itemXml: string, field: string): string {
  // CDATA variant: <field><![CDATA[value]]></field>
  const cdataRe = new RegExp(
    `<${field}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${field}>`,
    "i",
  );
  const cdataMatch = itemXml.match(cdataRe);
  if (cdataMatch) return cdataMatch[1].trim();

  // Plain text variant: <field>value</field>
  const plainRe = new RegExp(`<${field}[^>]*>([\\s\\S]*?)</${field}>`, "i");
  const plainMatch = itemXml.match(plainRe);
  if (plainMatch) return plainMatch[1].trim();

  return "";
}

type RssItem = {
  title: string;
  description: string;
  link: string;
  pubDate: string;
};

function parseItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRe.exec(xml)) !== null) {
    const raw = match[1];
    const title = extractField(raw, "title");
    const link = extractField(raw, "link");
    if (!title || !link) continue;
    items.push({
      title,
      description: extractField(raw, "description"),
      link,
      pubDate: extractField(raw, "pubDate"),
    });
  }

  return items;
}

/**
 * Splits "Job Title at Employer Name" → { jobTitle, employer }.
 * Falls back to the full title as jobTitle and "Unknown" as employer.
 */
function splitTitleEmployer(title: string): { jobTitle: string; employer: string } {
  // Use last occurrence of " at " to handle titles like "Lead Engineer at Scale at Acme Ltd"
  const idx = title.lastIndexOf(" at ");
  if (idx > 0) {
    return {
      jobTitle: title.slice(0, idx).trim(),
      employer: title.slice(idx + 4).trim(),
    };
  }
  return { jobTitle: title, employer: "Unknown" };
}

/** Extracts the numeric job ID from a Find a Job detail URL. */
function extractId(link: string): string {
  const m = link.match(/\/details\/(\d+)/);
  return m ? m[1] : link;
}

function toRawJob(item: RssItem): RawJob {
  const { jobTitle, employer } = splitTitleEmployer(item.title);
  const postedAt = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();

  return {
    externalId: extractId(item.link),
    source: "find_a_job",
    title: jobTitle,
    company: employer,
    location: "United Kingdom",
    description: item.description,
    salaryCurrency: "GBP",
    salaryPeriod: "year",
    postedAt: isNaN(postedAt) ? Date.now() : postedAt,
    applyUrl: item.link,
    isAgency: false,
    explicit: true,
  };
}

// ---------------------------------------------------------------------------
// Public adapter function
// ---------------------------------------------------------------------------

export async function fetchFindAJob(): Promise<RawJob[]> {
  const responses = await Promise.all(
    FEEDS.map((url) =>
      fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Tino/1.0; +https://tiino.app)",
          "Accept": "application/rss+xml, application/xml, text/xml",
        },
      }).then(async (res) => {
        if (!res.ok) {
          throw new Error(`Find a Job RSS fetch failed (HTTP ${res.status}): ${url}`);
        }
        return res.text();
      }),
    ),
  );

  const seen = new Set<string>();
  const jobs: RawJob[] = [];

  for (const xml of responses) {
    for (const item of parseItems(xml)) {
      const id = extractId(item.link);
      if (!seen.has(id)) {
        seen.add(id);
        jobs.push(toRawJob(item));
      }
    }
  }

  return jobs;
}
