import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  // Spread auth auxiliary tables (authSessions, authAccounts, authRefreshTokens,
  // authVerificationCodes, authVerifiers, authRateLimits). We override `users`
  // below to add our app-specific fields.
  ...authTables,

  // Override the users table: merge Convex Auth's required fields with our own.
  // email is optional per Convex Auth's convention (supports OAuth providers
  // that may not supply an email). For magic-link-only sign-in it is always set.
  users: defineTable({
    // ── Convex Auth fields ──────────────────────────────────────────────────
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),

    // ── App fields ──────────────────────────────────────────────────────────
    // visaStatus is set during onboarding, not at sign-up time
    visaStatus: v.optional(
      v.union(
        v.literal("graduate"),
        v.literal("skilled_worker"),
        v.literal("student"),
        v.literal("other"),
      ),
    ),
    location: v.optional(v.string()),
    salaryMin: v.optional(v.number()),
    salaryMax: v.optional(v.number()),
    rightToWork: v.optional(v.boolean()),

    // Set to "free" on first login via createOrUpdateUser callback
    plan: v.union(
      v.literal("free"),
      v.literal("pro_monthly"),
      v.literal("pro_annual"),
    ),
    stripeCustomerId: v.optional(v.string()),
    // Set to 0 on first login via createOrUpdateUser callback
    payPerCvCredits: v.number(),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    // "email" index name is required by @convex-dev/auth
    .index("email", ["email"])
    .index("byStripeCustomer", ["stripeCustomerId"]),

  profiles: defineTable({
    userId: v.id("users"),
    cvFileId: v.optional(v.id("_storage")),
    currentRoleTitle: v.optional(v.string()),
    yearsExperience: v.optional(v.number()),
    skills: v.array(v.string()),
    qualifications: v.array(v.string()),
    industrySector: v.optional(v.string()),
    languages: v.array(v.string()),
    roleVariations: v.object({
      exact: v.array(v.string()),
      adjacent: v.array(v.string()),
    }),
    updatedAt: v.number(),
  }).index("byUser", ["userId"]),

  sponsors: defineTable({
    legalName: v.string(),
    normalisedName: v.string(),
    town: v.optional(v.string()),
    county: v.optional(v.string()),
    rating: v.string(),      // "Worker (A-rated)", "Worker (B-rated)", etc.
    route: v.string(),       // "Skilled Worker", "Intra-Company Transfer", etc.
    isActive: v.boolean(),
    fetchedAt: v.number(),
  })
    .index("byNormalisedName", ["normalisedName"])
    .index("byActive", ["isActive"]),

  jobs: defineTable({
    sourceIds: v.array(
      v.object({
        source: v.union(
          v.literal("reed"),
          v.literal("adzuna"),
          v.literal("nhs"),
          v.literal("civil_service"),
          v.literal("jobs_ac"),
        ),
        externalId: v.string(),
        applyUrl: v.string(),
      }),
    ),
    dedupeHash: v.string(),
    title: v.string(),
    company: v.string(),
    companyNormalised: v.string(),
    location: v.string(),
    locationCity: v.optional(v.string()),
    salaryMin: v.optional(v.number()),
    salaryMax: v.optional(v.number()),
    description: v.string(),
    postedAt: v.number(),
    isAgency: v.boolean(),
    sponsorshipScore: v.number(),
    sponsorshipBand: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
      v.literal("very_low"),
    ),
    scoreBreakdown: v.array(
      v.object({
        signal: v.string(),
        weight: v.number(),
        matched: v.boolean(),
      }),
    ),
    sponsorId: v.optional(v.id("sponsors")),
    // true when the JD explicitly mentions visa sponsorship available
    explicit: v.optional(v.boolean()),
    // true for public-sector sources (nhs, civil_service, jobs_ac)
    isPublicSector: v.boolean(),
    // essential/desirable criteria extracted by Claude Haiku at ingest time
    // only populated for public-sector jobs
    extractedCriteria: v.optional(v.array(v.string())),
    isActive: v.boolean(),
    expiresAt: v.optional(v.number()),
  })
    .index("byDedupeHash", ["dedupeHash"])
    .index("byCompanyNormalised", ["companyNormalised"])
    .index("byBandPosted", ["sponsorshipBand", "postedAt"])
    .index("byActive", ["isActive"]),

  applications: defineTable({
    userId: v.id("users"),
    jobId: v.id("jobs"),
    stage: v.union(
      v.literal("saved"),
      v.literal("cv_generated"),
      v.literal("applied"),
      v.literal("acknowledged"),
      v.literal("interview_scheduled"),
      v.literal("interview_done"),
      v.literal("offer_received"),
      v.literal("closed"),
    ),
    stageHistory: v.array(
      v.object({
        stage: v.string(),
        at: v.number(),
      }),
    ),
    cvFileId: v.optional(v.id("_storage")),
    coverLetterFileId: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
    outcome: v.optional(
      v.union(
        v.literal("offer_accepted"),
        v.literal("offer_declined"),
        v.literal("rejected"),
        v.literal("ghosted"),
        v.literal("withdrawn"),
      ),
    ),
    sponsorshipConfirmed: v.optional(v.boolean()),
    salaryOffered: v.optional(v.number()),
    scoreAtApply: v.optional(v.number()),
  })
    .index("byUser", ["userId"])
    .index("byUserStage", ["userId", "stage"])
    .index("byJob", ["jobId"]),

  searches: defineTable({
    userId: v.id("users"),
    keywords: v.array(v.string()),
    location: v.optional(v.string()),
    salaryMin: v.optional(v.number()),
    isActive: v.boolean(),
    lastRunAt: v.optional(v.number()),
  }).index("byUserActive", ["userId", "isActive"]),

  events: defineTable({
    userId: v.optional(v.id("users")),
    type: v.string(),
    payload: v.any(),
    at: v.number(),
  }).index("byUserAt", ["userId", "at"]),

  sponsorSnapshots: defineTable({
    fetchedAt: v.number(),
    csvUrl: v.string(),
    totalRows: v.number(),
    activeCount: v.number(),
    addedSinceLast: v.optional(v.number()),
    removedSinceLast: v.optional(v.number()),
    status: v.union(v.literal("ok"), v.literal("error")),
    errorMessage: v.optional(v.string()),
  }).index("byFetchedAt", ["fetchedAt"]),

  tradingNames: defineTable({
    tradingName: v.string(),
    normalisedTrading: v.string(),
    legalName: v.string(),
    normalisedLegal: v.string(),
    source: v.union(
      v.literal("manual"),
      v.literal("companies_house"),
      v.literal("user_report"),
    ),
  })
    .index("byNormalisedTrading", ["normalisedTrading"])
    .index("byNormalisedLegal", ["normalisedLegal"]),

  webhookEvents: defineTable({
    stripeEventId: v.string(),
    type: v.string(),
    processedAt: v.number(),
    status: v.union(v.literal("ok"), v.literal("error")),
    errorMessage: v.optional(v.string()),
  }).index("byStripeEventId", ["stripeEventId"]),
});
