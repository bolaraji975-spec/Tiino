/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as applications_buildCvDocx from "../applications/buildCvDocx.js";
import type * as applications_generate from "../applications/generate.js";
import type * as applications_mutations from "../applications/mutations.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as jobs_ingest from "../jobs/ingest.js";
import type * as jobs_ingestMutations from "../jobs/ingestMutations.js";
import type * as jobs_queries from "../jobs/queries.js";
import type * as jobs_score from "../jobs/score.js";
import type * as jobs_sources_adzuna from "../jobs/sources/adzuna.js";
import type * as jobs_sources_civilservice from "../jobs/sources/civilservice.js";
import type * as jobs_sources_findajob from "../jobs/sources/findajob.js";
import type * as jobs_sources_jobsac from "../jobs/sources/jobsac.js";
import type * as jobs_sources_nhs from "../jobs/sources/nhs.js";
import type * as jobs_sources_reed from "../jobs/sources/reed.js";
import type * as jobs_types from "../jobs/types.js";
import type * as lib_alerts from "../lib/alerts.js";
import type * as lib_authRateLimit from "../lib/authRateLimit.js";
import type * as lib_companyLogo from "../lib/companyLogo.js";
import type * as lib_detectSponsorshipSignal from "../lib/detectSponsorshipSignal.js";
import type * as lib_fileValidation from "../lib/fileValidation.js";
import type * as lib_htmlUtils from "../lib/htmlUtils.js";
import type * as lib_inputValidation from "../lib/inputValidation.js";
import type * as lib_matchCompanyToSponsor from "../lib/matchCompanyToSponsor.js";
import type * as lib_matchRoleVariation from "../lib/matchRoleVariation.js";
import type * as lib_normaliseJob from "../lib/normaliseJob.js";
import type * as lib_normaliseName from "../lib/normaliseName.js";
import type * as lib_parseSponsorCsv from "../lib/parseSponsorCsv.js";
import type * as lib_parseSponsorRow from "../lib/parseSponsorRow.js";
import type * as lib_planGates from "../lib/planGates.js";
import type * as lib_stripeHelpers from "../lib/stripeHelpers.js";
import type * as lib_tenantGuard from "../lib/tenantGuard.js";
import type * as lib_validatePassword from "../lib/validatePassword.js";
import type * as profiles from "../profiles.js";
import type * as profiles_generateRoleVariations from "../profiles/generateRoleVariations.js";
import type * as profiles_parseCv from "../profiles/parseCv.js";
import type * as sponsors_refresh from "../sponsors/refresh.js";
import type * as sponsors_seedTradingNames from "../sponsors/seedTradingNames.js";
import type * as sponsors_tradingNames from "../sponsors/tradingNames.js";
import type * as stripe_checkout from "../stripe/checkout.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "applications/buildCvDocx": typeof applications_buildCvDocx;
  "applications/generate": typeof applications_generate;
  "applications/mutations": typeof applications_mutations;
  auth: typeof auth;
  crons: typeof crons;
  http: typeof http;
  "jobs/ingest": typeof jobs_ingest;
  "jobs/ingestMutations": typeof jobs_ingestMutations;
  "jobs/queries": typeof jobs_queries;
  "jobs/score": typeof jobs_score;
  "jobs/sources/adzuna": typeof jobs_sources_adzuna;
  "jobs/sources/civilservice": typeof jobs_sources_civilservice;
  "jobs/sources/findajob": typeof jobs_sources_findajob;
  "jobs/sources/jobsac": typeof jobs_sources_jobsac;
  "jobs/sources/nhs": typeof jobs_sources_nhs;
  "jobs/sources/reed": typeof jobs_sources_reed;
  "jobs/types": typeof jobs_types;
  "lib/alerts": typeof lib_alerts;
  "lib/authRateLimit": typeof lib_authRateLimit;
  "lib/companyLogo": typeof lib_companyLogo;
  "lib/detectSponsorshipSignal": typeof lib_detectSponsorshipSignal;
  "lib/fileValidation": typeof lib_fileValidation;
  "lib/htmlUtils": typeof lib_htmlUtils;
  "lib/inputValidation": typeof lib_inputValidation;
  "lib/matchCompanyToSponsor": typeof lib_matchCompanyToSponsor;
  "lib/matchRoleVariation": typeof lib_matchRoleVariation;
  "lib/normaliseJob": typeof lib_normaliseJob;
  "lib/normaliseName": typeof lib_normaliseName;
  "lib/parseSponsorCsv": typeof lib_parseSponsorCsv;
  "lib/parseSponsorRow": typeof lib_parseSponsorRow;
  "lib/planGates": typeof lib_planGates;
  "lib/stripeHelpers": typeof lib_stripeHelpers;
  "lib/tenantGuard": typeof lib_tenantGuard;
  "lib/validatePassword": typeof lib_validatePassword;
  profiles: typeof profiles;
  "profiles/generateRoleVariations": typeof profiles_generateRoleVariations;
  "profiles/parseCv": typeof profiles_parseCv;
  "sponsors/refresh": typeof sponsors_refresh;
  "sponsors/seedTradingNames": typeof sponsors_seedTradingNames;
  "sponsors/tradingNames": typeof sponsors_tradingNames;
  "stripe/checkout": typeof stripe_checkout;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
