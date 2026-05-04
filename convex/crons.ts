import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// ---------------------------------------------------------------------------
// Sponsor register refresh — Monday 02:00 UTC
// ---------------------------------------------------------------------------

crons.weekly(
  "refresh sponsor register",
  { dayOfWeek: "monday", hourUTC: 2, minuteUTC: 0 },
  api.sponsors.refresh.refreshSponsorRegister,
  {},
);

// ---------------------------------------------------------------------------
// Job ingestion — explicit sponsorship listings
// Daily 04:00 UTC — Reed "visa sponsorship" keyword search
// ---------------------------------------------------------------------------

crons.daily(
  "ingest reed explicit",
  { hourUTC: 4, minuteUTC: 0 },
  api.jobs.ingest.ingestFromSource,
  { source: "reed", mode: "explicit" },
);

// ---------------------------------------------------------------------------
// Job ingestion — public sector feeds
// Daily 04:30 UTC — NHS Jobs, Civil Service, jobs.ac.uk
// ---------------------------------------------------------------------------

crons.daily(
  "ingest nhs jobs",
  { hourUTC: 4, minuteUTC: 30 },
  api.jobs.ingest.ingestFromSource,
  { source: "nhs", mode: "explicit" },
);

crons.daily(
  "ingest civil service jobs",
  { hourUTC: 4, minuteUTC: 35 },
  api.jobs.ingest.ingestFromSource,
  { source: "civil_service", mode: "explicit" },
);

crons.daily(
  "ingest jobs.ac.uk",
  { hourUTC: 4, minuteUTC: 40 },
  api.jobs.ingest.ingestFromSource,
  { source: "jobs_ac", mode: "explicit" },
);

// ---------------------------------------------------------------------------
// Job ingestion — broad search (wider net, weekly)
// Sunday 03:00 UTC — Reed broad + Adzuna broad
// ---------------------------------------------------------------------------

crons.weekly(
  "ingest reed broad",
  { dayOfWeek: "sunday", hourUTC: 3, minuteUTC: 0 },
  api.jobs.ingest.ingestFromSource,
  { source: "reed", mode: "broad" },
);

crons.weekly(
  "ingest adzuna broad",
  { dayOfWeek: "sunday", hourUTC: 3, minuteUTC: 30 },
  api.jobs.ingest.ingestFromSource,
  { source: "adzuna", mode: "broad" },
);

export default crons;
