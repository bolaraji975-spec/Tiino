/**
 * profiles.ts
 *
 * Mutations for managing user CV uploads and profile data.
 */

import { ConvexError, v } from "convex/values";
import { mutation, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { validateCvUpload } from "./lib/fileValidation";

// ---------------------------------------------------------------------------
// _applyParsedCv — internal: write Claude-extracted fields onto a profile
// ---------------------------------------------------------------------------

export const _applyParsedCv = internalMutation({
  args: {
    profileId: v.id("profiles"),
    data: v.object({
      currentRoleTitle: v.optional(v.string()),
      yearsExperience: v.optional(v.number()),
      skills: v.array(v.string()),
      qualifications: v.array(v.string()),
      industrySector: v.optional(v.string()),
      languages: v.array(v.string()),
    }),
  },
  handler: async (ctx, { profileId, data }) => {
    await ctx.db.patch(profileId, { ...data, updatedAt: Date.now() });
  },
});

// ---------------------------------------------------------------------------
// _recordEvent — internal: insert into the events audit log
// ---------------------------------------------------------------------------

export const _recordEvent = internalMutation({
  args: {
    userId: v.id("users"),
    type: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, { userId, type, payload }) => {
    await ctx.db.insert("events", { userId, type, payload, at: Date.now() });
  },
});

// ---------------------------------------------------------------------------
// _applyRoleVariations — internal: write generated role variation arrays
// ---------------------------------------------------------------------------

export const _applyRoleVariations = internalMutation({
  args: {
    profileId: v.id("profiles"),
    roleVariations: v.object({
      exact: v.array(v.string()),
      adjacent: v.array(v.string()),
    }),
  },
  handler: async (ctx, { profileId, roleVariations }) => {
    await ctx.db.patch(profileId, { roleVariations, updatedAt: Date.now() });
  },
});

// ---------------------------------------------------------------------------
// _getProfileForUser — internal: load profile by userId (used by parseCv action)
// ---------------------------------------------------------------------------

export const _getProfileForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("profiles")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .first();
  },
});

// ---------------------------------------------------------------------------
// generateUploadUrl
// ---------------------------------------------------------------------------

/**
 * Returns a short-lived Convex storage upload URL.
 * The client POSTs the file body directly to this URL, then calls saveCv
 * with the returned storageId.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated." });
    }
    return await ctx.storage.generateUploadUrl();
  },
});

// ---------------------------------------------------------------------------
// saveCv
// ---------------------------------------------------------------------------

/**
 * Persists an uploaded CV to the user's profile.
 *
 * Server-side guards:
 *   - Must be authenticated
 *   - File must be PDF or DOCX (checked via storage metadata)
 *   - File must be ≤ 10 MB (checked via storage metadata)
 *   - If the user already has a CV, the old file is deleted from storage
 *
 * If the user has no profile row yet, one is created with empty arrays.
 */
export const saveCv = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated." });
    }

    // Validate via storage metadata
    const metadata = await ctx.storage.getMetadata(storageId);
    if (metadata === null) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Uploaded file not found." });
    }

    try {
      validateCvUpload(metadata.size, metadata.contentType ?? "");
    } catch (err: unknown) {
      await ctx.storage.delete(storageId);
      throw new ConvexError({
        code: "VALIDATION",
        message: err instanceof Error ? err.message : "File validation failed.",
      });
    }

    // Find existing profile
    const existing = await ctx.db
      .query("profiles")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      // Delete old CV file before replacing
      if (existing.cvFileId !== undefined) {
        await ctx.storage.delete(existing.cvFileId);
      }
      await ctx.db.patch(existing._id, {
        cvFileId: storageId,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("profiles", {
        userId,
        cvFileId: storageId,
        skills: [],
        qualifications: [],
        languages: [],
        roleVariations: { exact: [], adjacent: [] },
        updatedAt: Date.now(),
      });
    }
  },
});
