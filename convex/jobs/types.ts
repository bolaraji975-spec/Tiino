/**
 * Shared types for job ingestion pipeline.
 */

export type JobSource = "reed" | "adzuna" | "nhs" | "civil_service" | "jobs_ac" | "find_a_job" | "apprenticeships";

/**
 * Raw job as returned by a source adapter — before normalisation.
 * Salary is already numeric where the API provides it.
 */
export type RawJob = {
  externalId: string;
  source: JobSource;
  title: string;
  company: string;
  location: string;
  description: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: "year" | "month" | "day" | "hour";
  postedAt: number; // ms timestamp
  applyUrl: string;
  isAgency?: boolean;
  explicit?: boolean;
};

/**
 * Normalised job ready for DB upsert.
 * dedupeHash = SHA256(titleNorm|companyNorm|locationNorm|weekOf).
 */
export type CanonicalJob = {
  sourceId: { source: JobSource; externalId: string; applyUrl: string };
  dedupeHash: string;
  title: string;
  company: string;
  companyNormalised: string;
  location: string;
  locationCity?: string;
  salaryMin?: number;
  salaryMax?: number;
  description: string;
  postedAt: number;
  isAgency: boolean;
  isPublicSector: boolean;
};
