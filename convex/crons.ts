import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

/**
 * Weekly sponsor register refresh — Monday 02:00 UTC.
 * Fetches the Home Office CSV, upserts ~130k sponsor rows,
 * deactivates removed employers, records a sponsorSnapshots row.
 */
crons.weekly(
  "refresh sponsor register",
  { dayOfWeek: "monday", hourUTC: 2, minuteUTC: 0 },
  api.sponsors.refresh.refreshSponsorRegister,
  {},
);

export default crons;
