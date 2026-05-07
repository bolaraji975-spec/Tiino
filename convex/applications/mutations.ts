/**
 * applications/mutations.ts — tracker mutations.
 *
 * saveJob:   idempotent — creates a "saved" application record for the current
 *            user and job, or returns the existing one. Free users capped at 3.
 * unsaveJob: removes a "saved"-stage application. No-op if not found or past saved.
 */

import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { canSaveJob } from "../lib/planGates";

export const saveJob = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated." });
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found." });
    }

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

    // Plan gate — count current saved-stage applications for free cap
    const savedCount = await ctx.db
      .query("applications")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("stage"), "saved"))
      .collect()
      .then((rows) => rows.length);

    if (!canSaveJob({ plan: user.plan, payPerCvCredits: user.payPerCvCredits }, savedCount)) {
      throw new ConvexError({
        code: "UPGRADE_REQUIRED",
        message: "Free plan allows 3 saved jobs. Upgrade to Pro for unlimited saves.",
      });
    }

    return await ctx.db.insert("applications", {
      userId,
      jobId: args.jobId,
      stage: "saved",
      stageHistory: [{ stage: "saved", at: Date.now() }],
    });
  },
});

export const unsaveJob = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated." });
    }

    const application = await ctx.db
      .query("applications")
      .withIndex("byJob", (q) => q.eq("jobId", args.jobId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    // No-op if not found or already progressed past "saved"
    if (!application || application.stage !== "saved") return null;

    await ctx.db.delete(application._id);
    return application._id;
  },
});
