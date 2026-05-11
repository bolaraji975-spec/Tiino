/**
 * applications/mutations.ts — tracker mutations.
 *
 * saveJob:   idempotent — creates a "saved" application record for the current
 *            user and job, or returns the existing one. Free users capped at 3.
 * unsaveJob: removes a "saved"-stage application. No-op if not found or past saved.
 */

import { ConvexError, v } from "convex/values";
import { mutation, internalQuery, internalMutation } from "../_generated/server";
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

// ---------------------------------------------------------------------------
// Internal helpers for generateApplication action
// ---------------------------------------------------------------------------

/** Count CV generation events in the current calendar month for a user. */
export const _getCvGenerationsThisMonth = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const events = await ctx.db
      .query("events")
      .withIndex("byUserAt", (q) =>
        q.eq("userId", userId).gte("at", start.getTime()),
      )
      .filter((q) => q.eq(q.field("type"), "cv_generated"))
      .collect();
    return events.length;
  },
});

/** Return existing application for a (userId, jobId) pair, or null. */
export const _getApplicationForUserJob = internalQuery({
  args: { userId: v.id("users"), jobId: v.id("jobs") },
  handler: async (ctx, { userId, jobId }) =>
    ctx.db
      .query("applications")
      .withIndex("byJob", (q) => q.eq("jobId", jobId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first(),
});

/**
 * Create or update an application with cv_generated stage and inline CV data.
 * - If existing application is at "saved": advance stage to "cv_generated".
 * - If already past "saved" (applied, interview…): keep existing stage, just
 *   update cvData so the user can re-generate without resetting progress.
 */
export const _upsertApplicationCv = internalMutation({
  args: {
    userId: v.id("users"),
    jobId: v.id("jobs"),
    generatedCvData: v.any(),
    scoreAtApply: v.optional(v.number()),
  },
  handler: async (ctx, { userId, jobId, generatedCvData, scoreAtApply }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("applications")
      .withIndex("byJob", (q) => q.eq("jobId", jobId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (existing) {
      const advanceStage = existing.stage === "saved";
      await ctx.db.patch(existing._id, {
        ...(advanceStage ? { stage: "cv_generated" as const } : {}),
        stageHistory: [
          ...existing.stageHistory,
          { stage: "cv_generated", at: now },
        ],
        generatedCvData,
        ...(scoreAtApply !== undefined ? { scoreAtApply } : {}),
      });
      return existing._id;
    }

    return ctx.db.insert("applications", {
      userId,
      jobId,
      stage: "cv_generated",
      stageHistory: [
        { stage: "saved", at: now },
        { stage: "cv_generated", at: now },
      ],
      generatedCvData,
      ...(scoreAtApply !== undefined ? { scoreAtApply } : {}),
    });
  },
});

// ---------------------------------------------------------------------------
// Internal helpers for buildCvDocx action
// ---------------------------------------------------------------------------

/** Fetch a single application by ID (no auth — caller must verify ownership). */
export const _getApplicationById = internalQuery({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, { applicationId }) => ctx.db.get(applicationId),
});

/** Write CV and cover letter storage IDs back to an application record. */
export const _setDocxFileIds = internalMutation({
  args: {
    applicationId: v.id("applications"),
    cvFileId: v.id("_storage"),
    coverLetterFileId: v.id("_storage"),
  },
  handler: async (ctx, { applicationId, cvFileId, coverLetterFileId }) => {
    await ctx.db.patch(applicationId, { cvFileId, coverLetterFileId });
  },
});
