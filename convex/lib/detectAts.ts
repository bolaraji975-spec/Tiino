/**
 * detectAts.ts
 *
 * Identifies which ATS platform a careers URL belongs to and returns the
 * corresponding public API URL to fetch job listings from.
 *
 * Supported platforms (all use public, auth-free APIs):
 *   - Greenhouse   boards-api.greenhouse.io
 *   - Lever        api.lever.co
 *   - Workable     apply.workable.com
 *   - SmartRecruiters  api.smartrecruiters.com
 *   - Recruitee    <slug>.recruitee.com
 *   - Ashby        jobs.ashbyhq.com
 *   - Breezy       <slug>.breezy.hr
 *   - TeamTailor   careers.teamtailor.com (not currently mapped)
 *
 * Returns null if the URL doesn't match any known ATS pattern.
 */

export type AtsName =
  | "greenhouse"
  | "lever"
  | "workable"
  | "smartrecruiters"
  | "recruitee"
  | "ashby"
  | "breezy"
  | "teamtailor";

export type AtsMatch = {
  ats: AtsName;
  slug: string;
  apiUrl: string;
};

type AtsPattern = {
  regex: RegExp;
  ats: AtsName;
  api: (slug: string) => string;
};

const PATTERNS: AtsPattern[] = [
  // Greenhouse — three URL variants
  {
    regex: /boards\.greenhouse\.io\/([^\/\?#]+)/,
    ats: "greenhouse",
    api: (slug) =>
      `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
  },
  {
    regex: /boards\.eu\.greenhouse\.io\/([^\/\?#]+)/,
    ats: "greenhouse",
    api: (slug) =>
      `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
  },
  {
    regex: /jobs\.greenhouse\.io\/([^\/\?#]+)/,
    ats: "greenhouse",
    api: (slug) =>
      `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
  },

  // Lever
  {
    regex: /jobs\.lever\.co\/([^\/\?#]+)/,
    ats: "lever",
    api: (slug) =>
      `https://api.lever.co/v0/postings/${slug}?mode=json`,
  },

  // Workable — two URL variants
  {
    regex: /apply\.workable\.com\/([^\/\?#]+)/,
    ats: "workable",
    api: (slug) =>
      `https://apply.workable.com/api/v3/accounts/${slug}/jobs`,
  },
  {
    regex: /([a-z0-9-]+)\.workable\.com/,
    ats: "workable",
    api: (slug) =>
      `https://apply.workable.com/api/v3/accounts/${slug}/jobs`,
  },

  // SmartRecruiters
  {
    regex: /careers\.smartrecruiters\.com\/([^\/\?#]+)/,
    ats: "smartrecruiters",
    api: (slug) =>
      `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`,
  },

  // Recruitee
  {
    regex: /([a-z0-9-]+)\.recruitee\.com/,
    ats: "recruitee",
    api: (slug) =>
      `https://${slug}.recruitee.com/api/offers`,
  },

  // Ashby
  {
    regex: /jobs\.ashbyhq\.com\/([^\/\?#]+)/,
    ats: "ashby",
    api: (slug) =>
      `https://jobs.ashbyhq.com/api/non-user-facing/job-board/job-board-detail?organizationHostedJobsPageName=${slug}`,
  },

  // Breezy
  {
    regex: /([a-z0-9-]+)\.breezy\.hr/,
    ats: "breezy",
    api: (slug) =>
      `https://${slug}.breezy.hr/json`,
  },
];

/**
 * Detect which ATS a careers URL belongs to and return the matching API URL.
 * Returns null if no known ATS pattern matches.
 */
export function detectAts(careersUrl: string): AtsMatch | null {
  for (const pattern of PATTERNS) {
    const match = careersUrl.match(pattern.regex);
    if (match) {
      const slug = match[1];
      return {
        ats: pattern.ats,
        slug,
        apiUrl: pattern.api(slug),
      };
    }
  }
  return null;
}
