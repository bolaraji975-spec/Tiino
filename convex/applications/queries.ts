/**
 * applications/queries.ts
 *
 * listForUser: returns all applications for the authenticated user,
 * joined with job details, enriched with display helpers (logo initials,
 * days since applied, stats).
 */

import { query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getInitials, getInitialsColor } from "../lib/companyLogo";

export const listForUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const applications = await ctx.db
      .query("applications")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const results = await Promise.all(
      applications.map(async (app) => {
        const job = await ctx.db.get(app.jobId);
        if (!job) return null;

        // Find when the application was first marked "applied"
        const appliedEntry = app.stageHistory.find((h) => h.stage === "applied");
        const daysSinceApplied = appliedEntry
          ? Math.floor((Date.now() - appliedEntry.at) / 86_400_000)
          : null;

        // Find when it reached interview stage
        const interviewEntry = app.stageHistory.find(
          (h) => h.stage === "interview_scheduled",
        );
        const daysToInterview =
          appliedEntry && interviewEntry
            ? Math.floor((interviewEntry.at - appliedEntry.at) / 86_400_000)
            : null;

        const applyUrl = job.sourceIds[0]?.applyUrl ?? null;

        return {
          _id: app._id,
          jobId: app.jobId,
          stage: app.stage,
          outcome: app.outcome ?? null,
          stageHistory: app.stageHistory,
          notes: app.notes ?? null,
          scoreAtApply: app.scoreAtApply ?? null,
          generatedCvData: app.generatedCvData ?? null,
          // Job details
          jobTitle: job.title,
          company: job.company,
          location: job.location,
          sponsorshipBand: job.sponsorshipBand,
          sponsorshipScore: job.sponsorshipScore,
          salaryMin: job.salaryMin ?? null,
          salaryMax: job.salaryMax ?? null,
          applyUrl,
          // Logo helpers (computed server-side to avoid shipping the full map to the client)
          logoInitials: getInitials(job.company),
          logoColor: getInitialsColor(job.company),
          // Time helpers
          daysSinceApplied,
          daysToInterview,
          savedAt: app.stageHistory[0]?.at ?? null,
        };
      }),
    );

    return results.filter(<T>(x: T | null): x is T => x !== null);
  },
});
