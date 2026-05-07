/**
 * applications/mutations.ts — tracker mutations.
 *
 * saveJob: idempotent — creates a "saved" application record for the current
 * user and job, or returns the existing one if already present.
 * Calling it again when the user has progressed past "saved" is a no-op.
 */

import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const saveJob = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated." });
    }

    // Check job exists
    const job = await ctx.db.get(args.jobId);
    if (!job || !job.isActive) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Job not found." });
    }

    // Idempotent: return existing application if already present
    const existing = await ctx.db
      .query("applications")
      .withIndex("byJob", (q) => q.eq("jobId", args.jobId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("applications", {
      userId,
      jobId: args.jobId,
      stage: "saved",
      stageHistory: [{ stage: "saved", at: Date.now() }],
    });
  },
});
