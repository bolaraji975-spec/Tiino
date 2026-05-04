/**
 * profiles.ts
 *
 * Mutations for managing user CV uploads and profile data.
 */

import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const MAX_CV_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

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

    const contentType = metadata.contentType ?? "";
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      await ctx.storage.delete(storageId);
      throw new ConvexError({
        code: "VALIDATION",
        message: "Only PDF and DOCX files are accepted.",
      });
    }

    if (metadata.size > MAX_CV_BYTES) {
      await ctx.storage.delete(storageId);
      throw new ConvexError({
        code: "VALIDATION",
        message: "File exceeds the 10 MB limit.",
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
